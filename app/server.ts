import * as vscode from 'vscode';
import { 
    LanguageClient, 
    LanguageClientOptions, 
    ServerOptions, 
    RevealOutputChannelOn 
} from 'vscode-languageclient/node.js';
import { PassThrough } from 'stream';
import { URI } from 'vscode-uri';
import Executor from './executor.js';
import * as cp from 'child_process';

/**
 * Orchestrates the connection between VS Code and the C# Language Server.
 * Handles the raw Stdio stream to allow for custom URI remapping.
 */
export class Server {
    private executor: Executor;
    private client: LanguageClient | null = null;
    private outputChannel: vscode.OutputChannel;
    private childProcess?: cp.ChildProcess;
    private responseStream?: PassThrough;
    public isReady = false;

    // ELI5: When false, the output channel will remain quiet.
    public static DEBUG_MODE = false;

    constructor() {
        this.executor = new Executor();
        this.outputChannel = vscode.window.createOutputChannel("InlineXML LSP");
    }

    /**
     * Ensures URIs coming back from the C# server match exactly what VS Code expects,
     * specifically handling case-sensitivity and open document instances.
     */
    private normalizeUri(rawUri: string): string {
        try {
            const parsed = URI.parse(rawUri);
            const fsPath = parsed.fsPath.toLowerCase();
            const openDoc = vscode.workspace.textDocuments.find(doc => 
                doc.uri.fsPath.toLowerCase() === fsPath
            );
            return openDoc ? openDoc.uri.toString() : URI.file(parsed.fsPath).toString();
        } catch (e) {
            return rawUri;
        }
    }

    async listen() {
        if (this.client) return; 
        
        if (Server.DEBUG_MODE) {
            this.outputChannel.show(true);
            this.outputChannel.appendLine("[SYSTEM] --- STARTING LSP ORCHESTRA ---");
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const details = this.executor.getExecutionDetails(workspaceFolder);
        
        const serverOptions: ServerOptions = async () => {
            this.childProcess = cp.spawn(details.command, details.args, { 
                cwd: details.cwd, 
                shell: true, 
                stdio: ['pipe', 'pipe', 'pipe'] 
            });

            this.childProcess.stderr?.on('data', (data) => {
                if (Server.DEBUG_MODE) {
                    this.outputChannel.appendLine(`[C# STDERR]: ${data.toString().trim()}`);
                }
            });

            const requestStream = new PassThrough();
            this.responseStream = new PassThrough();

            // Pipe VS Code's requests into the C# process stdin
            requestStream.pipe(this.childProcess.stdin!);

            let buffer = Buffer.alloc(0);

            // Listen to C# process stdout and parse LSP messages
            this.childProcess.stdout!.on('data', (data: Buffer) => {
                buffer = Buffer.concat([buffer, data]);

                while (true) {
                    const str = buffer.toString('utf8');
                    const headerToken = "Content-Length:";
                    const index = str.indexOf(headerToken);

                    if (index === -1) break; 

                    if (index > 0) {
                        buffer = buffer.slice(index);
                        continue;
                    }

                    const headerMatch = str.match(/Content-Length: (\d+)\r\n\r\n/);
                    if (!headerMatch) break; 
                    
                    const contentLength = parseInt(headerMatch[1]);
                    const headerLength = headerMatch[0].length;

                    if (buffer.length < headerLength + contentLength) break; 

                    const jsonPart = buffer.slice(headerLength, headerLength + contentLength).toString('utf8');
                    
                    try {
                        let msg = JSON.parse(jsonPart);
                        
                        // Remap Diagnostics URIs (The "Broken Link" fix)
                        if (msg.method === 'textDocument/publishDiagnostics' && msg.params?.uri) {
                            msg.params.uri = this.normalizeUri(msg.params.uri);
                        }

                        const body = JSON.stringify(msg);
                        const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`;
                        
                        // Push the (potentially modified) message back to VS Code
                        this.responseStream?.write(header + body);
                    } catch (e: any) {
                        if (Server.DEBUG_MODE) {
                            this.outputChannel.appendLine(`[JS ERROR] JSON Parse failure: ${e.message}`);
                        }
                    }
                    
                    buffer = buffer.slice(headerLength + contentLength);
                }
            });

            return { writer: requestStream, reader: this.responseStream };
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'inlinexml' },
                { scheme: 'file', language: 'csharp' },
                { scheme: 'file', pattern: '**/*.xcs' }
            ],
            diagnosticCollectionName: 'inlinexml',
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            outputChannel: this.outputChannel
        };

        this.client = new LanguageClient('inlinexmlLSP', 'InlineXML', serverOptions, clientOptions);

        await this.client.start();
        this.isReady = true;
    }

    async disconnect() {
        this.isReady = false;
        if (this.client) {
            await this.client.stop();
            this.client = null;
        }
        if (this.childProcess) {
            this.childProcess.kill();
        }
    }
}