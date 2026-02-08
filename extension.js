import * as vscode from 'vscode';
import { Server } from './app/server.js';
import { needsInstall, install, getBinaryPath } from './app/installer.js';

let lspServer = null;

export async function activate(context) {
    console.log('Activating ExtendedSharp...');

    vscode.window.showInformationMessage('ExtendedSharp LSP: Activating');

    try {
        // Step 1: Ensure binary is installed
        if (needsInstall()) {
            vscode.window.showInformationMessage('Installing InlineXML binary...');
            await install();
            vscode.window.showInformationMessage('InlineXML binary installed successfully!');
        } else {
            const binPath = getBinaryPath();
            console.log(`InlineXML binary already installed at ${binPath}`);
        }

        // Step 2: Start LSP server
        lspServer = new Server();
        await lspServer.listen();

        // Step 3: Command to restart LSP
        let restartCommand = vscode.commands.registerCommand('csharpxml.restartLSP', async () => {
            if (lspServer) {
                await lspServer.disconnect();
                await lspServer.listen();
            }
        });

        context.subscriptions.push(restartCommand);
    } catch (err) {
        console.error('Failed to initialize ExtendedSharp:', err);
        vscode.window.showErrorMessage(`ExtendedSharp failed to start: ${err.message}`);
    }
}

export async function deactivate() {
    if (lspServer) await lspServer.disconnect();
}
