import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start Hardhat Node
const nodeProcess = spawn('npx', ['hardhat', 'node'], {
  cwd: path.join(__dirname, '..'),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'] // Pipe stdout/stderr to read output
});

console.log('Starting Hardhat Node...');

let deployed = false;

nodeProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // Forward output to console

  // Check if node is ready
  if (!deployed && output.includes('Started HTTP and WebSocket JSON-RPC server')) {
    console.log('\nHardhat Node is ready. Deploying contracts...\n');
    deployed = true;
    deployContracts();
  }
});

nodeProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

function deployContracts() {
  const deployProcess = spawn('npx', ['hardhat', 'run', 'scripts/deploy-local.ts', '--network', 'localhost'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'inherit'
  });

  deployProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\nDeployment successful! Local environment is ready.');
      console.log('Press Ctrl+C to stop the node.');
    } else {
      console.error('\nDeployment failed.');
      // Don't kill the node, maybe user wants to debug
    }
  });
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\nStopping Hardhat Node...');
  // On Windows, tree-kill might be needed, but nodeProcess.kill() usually works for direct spawn
  // However, with shell: true, it spawns a shell which spawns the process.
  // Let's try simple kill first.
  nodeProcess.kill();
  process.exit();
});
