import { dirname } from 'path';
import { getBinaryPath } from './installation/installer';

console.log('[executor.ts] Loading...');

/**
 * Interface representing the command line details needed 
 * to spawn the Language Server process.
 */
export interface ExecutionDetails {
    command: string;
    args: string[];
    cwd: string;
}

/**
 * Manages the execution context for the InlineXML Language Server.
 * Switches between local 'dotnet run' for development and the downloaded 
 * native binary for production/distribution.
 */
export default class Executor {
    /**
     * Set to true to use local source code via 'dotnet run'.
     * Set to false to use the optimized binary downloaded by installer.ts.
     */
    public static IS_DEBUG = false; 
    
    /** Local path used only when IS_DEBUG is true */
    private static readonly LOCAL_REPO_PATH = 'C:/Users/John/Desktop/Projects/LanguageServer/InlineXML/InlineXML';
    private static readonly PROJECT_FILE = 'InlineXML.csproj';

    /**
     * Generates the command and arguments required to start the Language Server.
     * @param workspaceFolder - The root path of the project being edited.
     * @returns An object containing the command, args, and cwd.
     */
    public getExecutionDetails(workspaceFolder: string): ExecutionDetails {
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
        const downloadedBinPath = getBinaryPath();
        const downloadedBinDir = dirname(downloadedBinPath);
        
        return {
            command: downloadedBinPath,
            args: [
                '--lsp', 
                '--workspace', targetWorkspace
            ],
            // We set the current working directory to the binary's folder
            // to ensure it can load any companion .dll or .json files.
            cwd: downloadedBinDir
        };
    }
}