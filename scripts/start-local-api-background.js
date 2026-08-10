const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, '.logs');
fs.mkdirSync(logDir, { recursive: true });

const out = fs.openSync(path.join(logDir, 'api-5500.log'), 'a');
const err = fs.openSync(path.join(logDir, 'api-5500.err.log'), 'a');

const child = spawn(process.execPath, ['scripts/start-api.js'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', out, err],
  env: {
    ...process.env,
    API_START_MODE: 'typescript',
    NODE_ENV: 'development',
    PORT: '5500',
  },
  windowsHide: true,
});

child.unref();
console.log(child.pid);
