const fs = require('fs');
const path = require('path');
const net = require('net');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, '.logs');
fs.mkdirSync(logDir, { recursive: true });

const postgres = 'D:\\Soft\\PostgreSQL18\\pgsql\\bin\\postgres.exe';
const pgCtl = 'D:\\Soft\\PostgreSQL18\\pgsql\\bin\\pg_ctl.exe';
const data = 'D:\\Soft\\PostgreSQL18\\data';
const port = 5432;
const pidFile = path.join(logDir, 'postgresql.pid');
const stdoutLog = path.join(logDir, 'postgresql.out.log');
const stderrLog = path.join(logDir, 'postgresql.err.log');
const pgCtlLog = path.join(logDir, 'postgresql.pg_ctl.log');
const postmasterPid = path.join(data, 'postmaster.pid');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortListening() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 800 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

function isPidAlive(pid) {
  if (!pid || !/^\d+$/.test(String(pid))) return false;
  try {
    const output = execFileSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return output.includes(`"${pid}"`);
  } catch {
    return false;
  }
}

function tail(file, maxChars = 4000) {
  if (!fs.existsSync(file)) return '';
  const content = fs.readFileSync(file, 'utf8');
  return content.slice(-maxChars).trim();
}

function readPostmasterPid() {
  if (!fs.existsSync(postmasterPid)) return null;
  const firstLine = fs.readFileSync(postmasterPid, 'utf8').split(/\r?\n/)[0]?.trim();
  return /^\d+$/.test(firstLine || '') ? firstLine : null;
}

function moveStalePostmasterPidIfNeeded() {
  if (!fs.existsSync(postmasterPid)) return;

  const firstLine = readPostmasterPid();
  if (isPidAlive(firstLine)) {
    throw new Error(
      `PostgreSQL lock file exists and PID ${firstLine} is still alive. ` +
        'If a foreground PostgreSQL window is open, close it first or stop that process.'
    );
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const stalePath = `${postmasterPid}.stale-${stamp}`;
  fs.renameSync(postmasterPid, stalePath);
  console.log(`Moved stale PostgreSQL lock file to: ${stalePath}`);
}

async function waitUntilReady(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortListening()) return true;
    await sleep(500);
  }
  return false;
}

async function main() {
  if (!fs.existsSync(postgres)) {
    throw new Error(`postgres.exe not found: ${postgres}`);
  }
  if (!fs.existsSync(pgCtl)) {
    throw new Error(`pg_ctl.exe not found: ${pgCtl}`);
  }
  if (!fs.existsSync(data)) {
    throw new Error(`PostgreSQL data directory not found: ${data}`);
  }

  if (await isPortListening()) {
    console.log(`PostgreSQL already running on 127.0.0.1:${port}`);
    const existingPid = readPostmasterPid();
    if (existingPid) {
      fs.writeFileSync(pidFile, existingPid, 'ascii');
      console.log(`pid=${existingPid}`);
    }
    return;
  }

  moveStalePostmasterPidIfNeeded();

  const output = execFileSync(
    pgCtl,
    ['start', '-D', data, '-w', '-l', pgCtlLog, '-o', `-p ${port}`],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
    }
  );
  if (output.trim()) process.stdout.write(output);

  if (await waitUntilReady()) {
    const startedPid = readPostmasterPid();
    if (startedPid) fs.writeFileSync(pidFile, startedPid, 'ascii');
    console.log(`PostgreSQL started in background. pid=${startedPid || 'unknown'}, port=${port}`);
    console.log(`Logs: ${pgCtlLog} / ${stdoutLog} / ${stderrLog}`);
    return;
  }

  const recentError = [tail(pgCtlLog), tail(stderrLog)].filter(Boolean).join('\n');
  throw new Error(
    `PostgreSQL did not become ready on 127.0.0.1:${port}.\n` +
      `Recent stderr:\n${recentError || '(empty)'}`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
