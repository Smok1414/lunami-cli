import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('dist/index.js')) {
  process.exit(0);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 1);
}

if (existsSync('node_modules/typescript/package.json')) {
  run('npm', ['run', 'build']);
}

run('npx', ['--yes', '-p', 'typescript@5.7.2', 'tsc']);
