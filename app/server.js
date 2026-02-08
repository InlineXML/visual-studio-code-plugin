import * as vscode from 'vscode';
import { LanguageClient, RevealOutputChannelOn } from 'vscode-languageclient/node.js';
import Executor from './executor.js';
import { PassThrough } from 'stream';
import { URI } from 'vscode-uri';

export class Server {
    executor;
    client;
    outputChannel;
    childProcess;
    responseStream;
    isReady = false;

    // ELI5: When false, the output channel will remain completely empty.
    static DEBUG_MODE = false;

    constructor() {
        this.executor = new Executor();
        this.client = null;
        this.outputChannel = vscode.window.createOutputChannel("InlineXML LSP");
    }

    normalizeUri(rawUri) {
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

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || null;
        if (!workspaceFolder) return;

        const details = this.executor.getExecutionDetails(workspaceFolder);
        
        const serverOptions = async () => {
            const cp = await import('child_process');
            
            this.childProcess = cp.spawn(details.command, details.args, { 
                cwd: details.cwd, 
                shell: true, 
                stdio: ['pipe', 'pipe', 'pipe'] 
            });

            this.childProcess.stderr.on('data', (data) => {
                // Silenced stderr unless debugging
                if (Server.DEBUG_MODE) {
                    this.outputChannel.appendLine(`[C# STDERR]: ${data.toString().trim()}`);
                }
            });

            const requestStream = new PassThrough();
            this.responseStream = new PassThrough();

            requestStream.on('data', (data) => {
                if (Server.DEBUG_MODE) {
                    this.outputChannel.appendLine(`[TX -> C#]: LSP Request Sent (${data.length} bytes)`);
                }
            });

            requestStream.pipe(this.childProcess.stdin);

            let buffer = Buffer.alloc(0);

            this.childProcess.stdout.on('data', (data) => {
                if (Server.DEBUG_MODE) {
                    this.outputChannel.appendLine(`[STDOUT RAW]: ${data.toString().trim()}`);
                }
                
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
                        
                        if (Server.DEBUG_MODE) {
                            const isNotification = msg.method !== undefined && msg.id === undefined;
                            const isResponse = msg.id !== undefined;
                            const typeLabel = isNotification ? 'Notification' : (isResponse ? 'Response' : 'Request');
                            this.outputChannel.appendLine(`[LSP DETECTED]: ${typeLabel} | Method: ${msg.method || 'N/A'} (ID: ${msg.id ?? 'N/A'})`);
                        }

                        if (msg.method === 'textDocument/publishDiagnostics' && msg.params?.uri) {
                            const oldUri = msg.params.uri;
                            msg.params.uri = this.normalizeUri(oldUri);
                            
                            if (Server.DEBUG_MODE) {
                                this.outputChannel.appendLine(`[DIAGNOSTICS] Remapped: ${oldUri} -> ${msg.params.uri}`);
                            }
                        }

                        const body = JSON.stringify(msg);
                        const header = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n`;
                        
                        this.responseStream.write(header + body);
                    } catch (e) {
                        if (Server.DEBUG_MODE) {
                            this.outputChannel.appendLine(`[JS ERROR] JSON Parse failure: ${e.message}`);
                        }
                    }
                    
                    buffer = buffer.slice(headerLength + contentLength);
                }
            });

            return { writer: requestStream, reader: this.responseStream };
        };

        this.client = new LanguageClient('inlinexmlLSP', 'InlineXML', serverOptions, {
            documentSelector: [
                { scheme: 'file', language: 'inlinexml' },
                { scheme: 'file', language: 'csharp' },
                { scheme: 'file', pattern: '**/*.xcs' }
            ],
            diagnosticCollectionName: 'inlinexml',
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            outputChannel: this.outputChannel
        });

        await this.client.start();
        this.isReady = true;
    }
}