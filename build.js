import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
    entryPoints: ['./app/index.ts'],
    bundle: true,
    outfile: './extension.cjs',
    // 'vscode' is provided by the host; AWS is ignored to fix unzipper error
    external: ['vscode', '@aws-sdk/client-s3'], 
    format: 'cjs',             // Changed from 'esm' to 'cjs'
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    minify: !isWatch,
    logLevel: 'info',
};

async function run() {
    if (isWatch) {
        let ctx = await esbuild.context(config);
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await esbuild.build(config);
        console.log('Build complete (CommonJS).');
    }
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});