#!/usr/bin/env node
// `npx github:kevinold/overdrive <bootstrap flags>`: run bootstrap.sh from the fetched package, no clone needed.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/bootstrap.sh', import.meta.url));
const r = spawnSync('bash', [script, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
