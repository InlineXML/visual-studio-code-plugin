// ./app/installer.js
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';
import * as unzipper from 'unzipper';
import * as child_process from 'child_process';

const Binaries = {
    macos: {
        zip: "https://github.com/InlineXML/binary/releases/download/v1.0.17/InlineXML-osx-x64.zip"
    },
    windows: {
        zip: "https://github.com/InlineXML/binary/releases/download/v1.0.17/InlineXML-win-x64.zip"
    },
    ubuntu: {
        zip: "https://github.com/InlineXML/binary/releases/download/v1.0.17/InlineXML-linux-x64.zip"
    }
};

const INSTALL_DIR = path.join(os.homedir(), '.inlinexml-bin');

const getPlatform = () => {
    const plat = os.platform();
    if (plat === 'darwin') return 'macos';
    if (plat === 'win32') return 'windows';
    if (plat === 'linux') return 'ubuntu';
    throw new Error(`Unsupported platform: ${plat}`);
}

export const getBinaryPath = () => {
    const platform = getPlatform();
    const binaryName = platform === 'windows' ? 'InlineXML.exe' : 'InlineXML';
    return path.join(INSTALL_DIR, binaryName);
}

export const needsInstall = () => {
    const binPath = getBinaryPath();
    return !fs.existsSync(binPath);
}

export const install = async () => {
    const platform = getPlatform();
    const { zip } = Binaries[platform];

    // Ensure clean start
    if (fs.existsSync(INSTALL_DIR)) {
        fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(INSTALL_DIR, { recursive: true });

    console.log(`Downloading all components from ${zip}...`);
    const response = await fetch(zip);
    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
    
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const directory = await unzipper.Open.buffer(zipBuffer);
    
    // ELI5: We walk through every single file in the zip (EXE, DLLs, JSON configs)
    // and save them all into the install directory.
    for (const file of directory.files) {
        // Skip directories themselves, we'll create them via path.join
        if (file.type === 'Directory') continue;

        // Flatten the structure: we want everything in the root of INSTALL_DIR
        // If your zip has a subfolder (like 'publish/'), path.basename removes it.
        const fileName = path.basename(file.path);
        const filePath = path.join(INSTALL_DIR, fileName);
        
        const content = await file.buffer();
        
        // Write the file. We use 0o755 for everything just to be safe, 
        // ensuring the main binary is executable on Mac/Linux.
        fs.writeFileSync(filePath, content, { mode: 0o755 });
    }

    const finalBin = getBinaryPath();
    if (!fs.existsSync(finalBin)) {
        throw new Error(`Installation failed: Executable not found in the extracted files.`);
    }

    console.log(`Installed all components to ${INSTALL_DIR}`);
    return finalBin;
}

export const runBinary = (args = []) => {
    const binPath = getBinaryPath();
    if (!fs.existsSync(binPath)) {
        throw new Error('Binary not installed yet. Call install() first.');
    }
    return child_process.spawnSync(binPath, args, { stdio: 'inherit' });
}