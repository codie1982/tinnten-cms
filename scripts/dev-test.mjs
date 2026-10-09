// CMS UI runs locally; API and auth run on the isolated test server.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const server = process.env.TINNTEN_TEST_SSH_HOST || 'root@5.133.102.107';
const api = 'http://localhost:15001/api/v10';
const auth = 'http://localhost:18080/realms/tinnten-realm/.well-known/openid-configuration';
const issuer = 'http://auth.tinnten.localhost:18080/realms/tinnten-realm';
const port = process.env.PORT || '3002';
let tunnel;
let ui;
let closing = false;

function stop(code = 0) {
  if (closing) return;
  closing = true;
  ui?.kill('SIGTERM');
  tunnel?.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());

async function servicesReady() {
  try {
    const [apiResponse, authResponse] = await Promise.all([
      fetch(`${api}/auth/login`, { method: 'OPTIONS', signal: AbortSignal.timeout(2500) }),
      fetch(auth, { signal: AbortSignal.timeout(2500) }),
    ]);
    return apiResponse.ok && authResponse.ok && (await authResponse.json()).issuer === issuer;
  } catch {
    return false;
  }
}

if (!await servicesReady()) {
  console.log(`Connecting CMS to test services on ${server}...`);
  tunnel = spawn('ssh', [
    '-N', '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
    '-L', '127.0.0.1:15001:127.0.0.1:15001',
    '-L', '127.0.0.1:18080:127.0.0.1:18080', server,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  tunnel.on('error', error => { console.error(error.message); stop(1); });
  tunnel.on('exit', code => {
    if (!closing) { console.error(`Test SSH connection closed (${code}).`); stop(1); }
  });
}
let ready = false;
for (let attempt = 0; attempt < 20 && !closing; attempt++) {
  if (await servicesReady()) { ready = true; break; }
  await delay(1000);
}
if (!ready && !closing) {
  console.error('Test API/auth unavailable or issuer mismatch. CMS was not started.');
  stop(1);
}
if (ready && !closing) {
  console.log(`CMS test API: ${api}; auth issuer: ${issuer}`);
  ui = spawn(process.execPath, [
    'node_modules/next/dist/bin/next', 'dev', '--turbopack',
    '--hostname', '127.0.0.1', '--port', port,
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BACKEND_URL: api,
      BACKEND_URL: api,
      NEXTAUTH_URL: `http://localhost:${port}`,
    },
  });
  ui.on('error', error => { console.error(error.message); stop(1); });
  ui.on('exit', code => stop(code || 0));
}
