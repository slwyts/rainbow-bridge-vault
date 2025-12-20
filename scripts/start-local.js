#!/usr/bin/env node

/**
 * 本地开发环境一键启动脚本
 * 
 * 功能：
 * 1. 启动 Hardhat 节点（后台运行）
 * 2. 等待节点就绪
 * 3. 部署合约
 * 4. 更新 env/localnet.env
 * 5. 启动前端
 * 
 * 使用: npm run dev:local
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const RPC_URL = 'http://127.0.0.1:8545';

// ANSI 颜色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// 检查端口是否被占用
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -i:${port}`;
    
    exec(cmd, (error, stdout) => {
      resolve(!!stdout.trim());
    });
  });
}

// 杀死占用端口的进程
async function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do @taskkill /F /PID %a 2>nul`, resolve);
    } else {
      exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, resolve);
    }
  });
}

// RPC 调用
async function rpcCall(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await response.json();
  return data.result;
}

// 等待节点启动
async function waitForNode(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await rpcCall('eth_blockNumber');
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

// 启动 Hardhat 节点
function startHardhatNode() {
  return new Promise((resolve, reject) => {
    log('⛏️  启动 Hardhat 节点...', 'cyan');
    
    const nodeProcess = spawn('npx', ['hardhat', 'node'], {
      cwd: rootDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // Unix 下分离进程
    });

    // 保存 PID
    const pidFile = path.join(rootDir, '.hardhat-node.pid');
    fs.writeFileSync(pidFile, String(nodeProcess.pid));

    // 监听输出，检测启动完成
    let started = false;
    
    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // 输出 account 信息（灰色）
      if (output.includes('Account #') || output.includes('Private Key')) {
        process.stdout.write(colors.gray + output + colors.reset);
      }
      
      if (!started && output.includes('Started HTTP and WebSocket JSON-RPC server')) {
        started = true;
        log('✅ Hardhat 节点启动成功', 'green');
        resolve(nodeProcess);
      }
    });

    nodeProcess.stderr.on('data', (data) => {
      // 忽略一些警告
      const output = data.toString();
      if (!output.includes('ExperimentalWarning')) {
        process.stderr.write(colors.red + output + colors.reset);
      }
    });

    nodeProcess.on('error', reject);
    
    // 超时检测
    setTimeout(() => {
      if (!started) {
        reject(new Error('Hardhat 节点启动超时'));
      }
    }, 30000);
  });
}

// 部署合约
function deployContracts() {
  return new Promise((resolve, reject) => {
    log('📋 部署合约...', 'cyan');
    
    const deployProcess = spawn('npx', ['hardhat', 'run', 'scripts/deploy-local.ts', '--network', 'localhost'], {
      cwd: rootDir,
      shell: true,
      stdio: 'inherit',
    });

    deployProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ 合约部署成功', 'green');
        resolve();
      } else {
        reject(new Error(`部署失败，退出码: ${code}`));
      }
    });

    deployProcess.on('error', reject);
  });
}

// 更新 localnet.env 文件
function updateEnvFile() {
  const envLocalPath = path.join(rootDir, '.env.local');
  const envLocalnetPath = path.join(rootDir, 'env', 'localnet.env');
  
  if (fs.existsSync(envLocalPath)) {
    log('🔄 更新 env/localnet.env...', 'cyan');
    
    // 读取部署生成的 .env.local
    const newEnv = fs.readFileSync(envLocalPath, 'utf8');
    const newVars = {};
    newEnv.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) newVars[key.trim()] = value.trim();
    });
    
    // 读取现有的 localnet.env
    let existingContent = '';
    if (fs.existsSync(envLocalnetPath)) {
      existingContent = fs.readFileSync(envLocalnetPath, 'utf8');
    }
    
    // 更新或添加变量
    let updatedContent = existingContent;
    for (const [key, value] of Object.entries(newVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(updatedContent)) {
        updatedContent = updatedContent.replace(regex, `${key}=${value}`);
      } else {
        updatedContent += `\n${key}=${value}`;
      }
    }
    
    fs.writeFileSync(envLocalnetPath, updatedContent.trim() + '\n');
    
    // 删除临时文件
    fs.unlinkSync(envLocalPath);
    
    log('✅ 环境变量已更新', 'green');
    
    // 打印合约地址
    console.log('');
    log('📝 合约地址:', 'cyan');
    for (const [key, value] of Object.entries(newVars)) {
      if (key.includes('ADDRESS')) {
        console.log(`   ${key.replace('NEXT_PUBLIC_LOCALNET_', '')}: ${value}`);
      }
    }
  }
}

// 启动前端
function startFrontend(nodeProcess) {
  log('\n🌐 启动前端开发服务器...', 'cyan');
  
  const devProcess = spawn('npm', ['run', 'dev'], {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
  });

  // 处理退出
  const cleanup = () => {
    log('\n🛑 停止服务...', 'yellow');
    devProcess.kill();
    nodeProcess.kill();
    
    // Windows 下需要额外杀进程
    if (process.platform === 'win32') {
      exec('taskkill /F /IM node.exe /T 2>nul', () => {});
    }
    
    // 删除 PID 文件
    const pidFile = path.join(rootDir, '.hardhat-node.pid');
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// 主函数
async function main() {
  console.log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🚀 启动本地开发环境', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  console.log('');

  // 检查并清理端口
  if (await isPortInUse(8545)) {
    log('⚠️  端口 8545 被占用，正在清理...', 'yellow');
    await killPort(8545);
    await new Promise(r => setTimeout(r, 1000));
  }

  try {
    // 1. 启动节点
    const nodeProcess = await startHardhatNode();
    
    // 2. 等待节点完全就绪
    await new Promise(r => setTimeout(r, 1000));
    
    // 3. 部署合约
    await deployContracts();
    
    // 4. 更新环境变量
    updateEnvFile();
    
    // 5. 启动前端
    console.log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🎉 本地环境启动完成！', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    console.log('');
    log('📊 节点信息:', 'cyan');
    console.log('   RPC URL: http://localhost:8545');
    console.log('   Chain ID: 31337');
    console.log('');
    log('🔧 常用操作:', 'cyan');
    console.log('   时间加速: npm run time 7  (加速 7 天)');
    console.log('   按 Ctrl+C 停止所有服务');
    console.log('');
    
    startFrontend(nodeProcess);
    
  } catch (error) {
    log(`❌ 启动失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
