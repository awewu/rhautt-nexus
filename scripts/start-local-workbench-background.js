const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, '.logs');
const tmpDir = path.join(logDir, '.tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const out = fs.openSync(path.join(logDir, 'dealer-5000.log'), 'a');
const err = fs.openSync(path.join(logDir, 'dealer-5000.err.log'), 'a');

const child = spawn(process.execPath, ['../../node_modules/next/dist/bin/next', 'dev', '--port', '5000'], {
  cwd: path.join(root, 'apps', 'dealer-workbench'),
  detached: true,
  stdio: ['ignore', out, err],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NEXT_PUBLIC_API_URL: 'http://localhost:5500',
    HOME: tmpDir,
    USERPROFILE: tmpDir,
    TMP: tmpDir,
    TEMP: tmpDir,
    XDG_CACHE_HOME: tmpDir,
    APPDATA: tmpDir,
    LOCALAPPDATA: tmpDir,
  },
  windowsHide: true,
});

child.unref();
console.log(child.pid);
