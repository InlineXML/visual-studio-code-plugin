import * as vscode from 'vscode';
import { Server } from './server';
import { needsInstall, install } from './installation/installer';

let lspServer: Server | null = null;

export async function activate(context: vscode.ExtensionContext) {
    // THIS is where your first log goes. 
    // If you don't see this in the "Developer Tools" console, 
    // the extension isn't loading at all.
    console.log("!!! InlineXML: Activate function triggered !!!");

    const logger = vscode.window.createOutputChannel("InlineXML Boot");
    logger.show(true);
    logger.appendLine('🚀 [System] Activation sequence initiated...');

    try {
        if (needsInstall()) {
            await install();
        }

        lspServer = new Server();
        await lspServer.listen();

        const restartCommand = vscode.commands.registerCommand('inlinexml.restartLSP', async () => {
            if (lspServer) {
                await lspServer.disconnect();
                await lspServer.listen();
            }
        });

        context.subscriptions.push(restartCommand);
    } catch (err: any) {
        console.error("Critical Startup Error:", err);
        logger.appendLine(`❌ Error: ${err.message}`);
    }
}

export async function deactivate() {
    if (lspServer) {
        await lspServer.disconnect();
    }
}