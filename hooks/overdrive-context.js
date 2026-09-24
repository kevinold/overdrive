#!/usr/bin/env node
// overdrive — SessionStart hook for Claude Code and Codex.
import { fileURLToPath } from 'node:url';
import { buildContext, writeHookOutput } from './lib.js';

try {
  writeHookOutput('SessionStart', buildContext(fileURLToPath(new URL('../', import.meta.url))));
} catch {
  // Silent fail — stdout closed/EPIPE at hook exit must not surface as a hook failure
}
