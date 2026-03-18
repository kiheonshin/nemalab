import { spawn } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rendererUrl = 'http://127.0.0.1:4173';

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

function killChild(child) {
  if (!child?.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  killChild(electronProcess);
  killChild(viteProcess);

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

async function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return;
    } catch {
      // Keep polling until the dev server is available.
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Timed out waiting for Vite dev server at ${url}`);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => shutdown(0));

viteProcess = spawn(
  npmCommand,
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      BROWSER: 'none',
    },
  },
);

viteProcess.on('exit', (code) => {
  if (!shuttingDown) {
    shutdown(code ?? 1);
  }
});

try {
  await waitForServer(rendererUrl);

  electronProcess = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
      NODE_ENV: 'development',
    },
  });

  electronProcess.on('exit', (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error('[electron:dev] Failed to start Electron app.');
  console.error(error);
  shutdown(1);
}
