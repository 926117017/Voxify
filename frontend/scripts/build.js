const { spawn, execSync } = require('child_process');
const path = require('path');

// 生成桌面图标
console.log('[build] Generating app icon...');
execSync('node scripts/gen-icon.js', { stdio: 'inherit', cwd: __dirname + '/..' });

// 构建前端静态文件
console.log('[build] Building frontend...');
execSync('npm run build', { stdio: 'inherit', cwd: __dirname + '/..' });

// 设置环境变量并打包
process.env.HTTP_PROXY = '';
process.env.HTTPS_PROXY = '';
process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/';

console.log('[build] Packaging Electron app...');
const child = spawn(
  path.join(__dirname, '..', 'node_modules', '.bin', 'electron-builder'),
  ['--win', 'nsis'],
  { stdio: 'inherit', shell: true }
);
child.on('exit', (code) => process.exit(code));
