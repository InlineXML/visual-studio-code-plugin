import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// ELI5: We import getBinaryPath so we don't have to guess where the file is.
// The installer knows exactly where it put the binary in the user's home folder.
import { getBinaryPath } from './installer.js'; 

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Manages the execution context for the InlineXML Language Server.
 * Switches between local 'dotnet run' for development and the downloaded 
 * native binary for production/distribution.
 */
export default class Executor {
    /**
     * Set to true to use local source code via 'dotnet run'.
     * Set to false to use the optimized binary downloaded by installer.js.
     */
    static IS_DEBUG = false; 
    
    /** Local path used only when IS_DEBUG is true */
    static LOCAL_REPO_PATH = 'C:/Users/John/Desktop/Projects/LanguageServer/InlineXML/InlineXML';
    static PROJECT_FILE = 'InlineXML.csproj';

    /**
     * Generates the command and arguments required to start the Language Server.
     * @param {string} workspaceFolder - The root path of the project being edited.
     * @returns {Object} An object containing the command, args, and cwd.
     */
    getExecutionDetails(workspaceFolder) {
        // Normalize the workspace path to use forward slashes for cross-platform consistency
        const targetWorkspace = workspaceFolder.replace(/\\/g, '/');

        // --- DEBUG MODE (Local Development) ---
        // Used by the developer to test changes in the C# source code immediately.
        if (Executor.IS_DEBUG) {
            const sourceRepo = Executor.LOCAL_REPO_PATH.replace(/\\/g, '/');
            const projectPath = `${sourceRepo}/${Executor.PROJECT_FILE}`;

            return {
                command: 'dotnet',
                args: [
                    'run', 
                    '--project', projectPath,
                    '--',                     // CRITICAL: Tells dotnet to stop parsing and pass following args to our app
                    '--lsp', 
                    '--workspace', targetWorkspace 
                ],
                cwd: sourceRepo
            };
        }

        // --- PRODUCTION MODE (Downloaded Binary) ---
        // This uses the standalone executable (InlineXML or InlineXML.exe).
        // It's much faster because it doesn't require the .NET SDK or a 'dotnet build' step.
        const downloadedBinPath = getBinaryPath().replace(/\\/g, '/');
        
        return {
            command: downloadedBinPath,
            args: [
                '--lsp', 
                '--workspace', targetWorkspace
            ],
            // We set the current working directory to the binary's folder
            // to ensure it can load any companion .dll or .json files.
            cwd: dirname(downloadedBinPath)
        };
    }
}