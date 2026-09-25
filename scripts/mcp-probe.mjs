#!/usr/bin/env node
// Probe every MCP server an agent's config registers, the way that agent would launch it:
// stdio servers are spawned in --cwd and sent an MCP `initialize`; http servers get the same
// request POSTed. Usage:
//   node scripts/mcp-probe.mjs --cwd <dir> <agent>=<format>:<file> ...
// Formats: mcpServers (Claude, Cursor, Gemini, Pi, omp), opencode, codex-get (`codex mcp get --json`).
// Prints one line per (agent, server); exits 1 if any probe fails. OVERDRIVE_MCP_OFFLINE=1 skips http probes.
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TIMEOUT_MS = Number(process.env.OVERDRIVE_MCP_TIMEOUT_MS || 45000);
const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'overdrive-check', version: '0' } },
};

// One agent config → [{ name, command, args } | { name, url }].
export function serversFrom(format, text) {
  const j = JSON.parse(text);
  const fromEntry = (name, s) => (s.url || s.httpUrl ? { name, url: s.url || s.httpUrl } : { name, command: s.command, args: s.args || [] });
  switch (format) {
    case 'mcpServers':
      return Object.entries(j.mcpServers || {}).map(([name, s]) => fromEntry(name, s));
    case 'opencode':
      return Object.entries(j.mcp || {}).map(([name, s]) => (s.url ? { name, url: s.url } : { name, command: s.command[0], args: s.command.slice(1) }));
    case 'codex-get': {
      const t = j.transport || {};
      return [t.command ? { name: j.name, command: t.command, args: t.args || [] } : { name: j.name, url: t.url }];
    }
    default:
      throw new Error(`unknown format: ${format}`);
  }
}

function probeStdio({ command, args }, cwd) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    const finish = (ok, detail) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve({ ok, detail });
    };
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => finish(false, `no initialize response in ${TIMEOUT_MS / 1000}s${err ? `: ${err.trim().split('\n').pop()}` : ''}`), TIMEOUT_MS);
    child.on('error', (e) => finish(false, `cannot launch ${command}: ${e.message}`));
    child.stderr.on('data', (d) => (err += d));
    child.stdout.on('data', (d) => {
      out += d;
      for (const line of out.split('\n')) {
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.result) return finish(true, msg.result.serverInfo ? `${msg.result.serverInfo.name} ${msg.result.serverInfo.version || ''}`.trim() : 'initialized');
        if (msg.error) return finish(false, msg.error.message);
      }
    });
    child.on('exit', (code) => finish(false, `exited ${code} before initialize${err ? `: ${err.trim().split('\n').pop()}` : ''}`));
    child.stdin.on('error', () => {});
    child.stdin.write(`${JSON.stringify(INIT)}\n`);
  });
}

async function probeHttp({ url }) {
  if (process.env.OVERDRIVE_MCP_OFFLINE === '1') return { ok: true, detail: 'skipped (offline)' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(INIT),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    return /"result"/.test(body) ? { ok: true, detail: `HTTP ${res.status}` } : { ok: false, detail: `HTTP ${res.status}: ${body.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

export async function main(argv) {
  const cwdAt = argv.indexOf('--cwd');
  const cwd = cwdAt >= 0 ? argv[cwdAt + 1] : process.cwd();
  const specs = argv.filter((a, i) => a !== '--cwd' && i !== cwdAt + 1);
  const cache = new Map(); // identical launch specs are probed once
  let failed = 0;
  for (const spec of specs) {
    const [agent, rest] = spec.split(/=(.*)/s);
    const [format, file] = rest.split(/:(.*)/s);
    let servers;
    try {
      servers = serversFrom(format, readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`FAIL ${agent}: cannot read ${file}: ${e.message}`);
      failed++;
      continue;
    }
    if (servers.length === 0) {
      console.log(`FAIL ${agent}: no MCP servers in ${file}`);
      failed++;
    }
    for (const s of servers) {
      const key = JSON.stringify(s.url ? [s.url] : [s.command, ...s.args]);
      if (!cache.has(key)) cache.set(key, await (s.url ? probeHttp(s) : probeStdio(s, cwd)));
      const r = cache.get(key);
      if (!r.ok) failed++;
      console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${agent} ${s.name}: ${r.detail}`);
    }
  }
  return failed ? 1 : 0;
}

// realpath: import.meta.url is symlink-resolved (macOS /var -> /private/var, npx caches), argv[1] is not.
if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
