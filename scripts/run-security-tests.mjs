import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const securityTestDirectory = fileURLToPath(new URL('../src/security/', import.meta.url));
const testFiles = (await readdir(securityTestDirectory))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => fileURLToPath(new URL(name, new URL('../src/security/', import.meta.url))));

if (testFiles.length === 0) {
  throw new Error('No Node.js security test files were found in src/security.');
}

const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...testFiles], {
  stdio: 'inherit',
  windowsHide: true
});

if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
