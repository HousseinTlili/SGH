// Starts the mock backend: six Prism servers (8081-8086, one per OpenAPI file) and the mock gateway (8080).
// Usage: npm run mock   (from the repository root)
// The OpenAPI files come from tools/mock/specs by default. Set MOCK_SPEC_DIR to use another folder,
// for example contracts/openapi once the contracts phase is done.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { SERVICES } from './gateway.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.resolve(process.env.MOCK_SPEC_DIR ?? path.join(here, 'specs'));
const require = createRequire(import.meta.url);
const prismBin = path.join(path.dirname(require.resolve('@stoplight/prism-cli/package.json')), 'dist', 'index.js');

const children = [];

function run(name, args) {
  const child = spawn(process.execPath, args, { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', (line) => console.log(`[${name}] ${line}`));
  }
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[${name}] stopped (${signal ?? `exit code ${code}`})`);
    }
  });
}

let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  children.forEach((child) => child.kill());
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const [name, { port }] of Object.entries(SERVICES)) {
  // --cors=false: only the gateway adds CORS headers, otherwise the browser sees them twice
  run(`prism:${name}`, [prismBin, 'mock', '-p', String(port), '--cors=false', '-v', 'warn', path.join(specDir, `${name}.yaml`)]);
}
run('gateway', [path.join(here, 'gateway.mjs')]);

console.log('Mock backend starting (7 processes):');
console.log('  mock gateway        http://localhost:8080   (the only address the Angular app uses)');
for (const [name, { port }] of Object.entries(SERVICES)) {
  console.log(`  prism ${name.padEnd(13)} http://localhost:${port}`);
}
console.log(`  specs from          ${specDir}`);
console.log('Simulate a crash:     curl -X POST http://localhost:8080/gateway/mock/down/lab   (and /up/lab)');
