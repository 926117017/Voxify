const { spawn } = require('child_process');
const path = require('path');

const next = spawn('npx', ['next', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});

let launched = false;

next.stdout?.on('data', (d) => {
  const s = d.toString();
  process.stdout.write(s);
  if (!launched && (s.includes('Ready') || s.includes('localhost:3000'))) {
    launched = true;
    const electron = spawn('npx', ['electron', '.', '--dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
    electron.on('close', () => { next.kill(); process.exit(); });
  }
});

next.stderr?.on('data', (d) => process.stderr.write(d));
next.on('close', () => process.exit());
