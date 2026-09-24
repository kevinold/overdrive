import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import overdriveExtension from '../.pi/extensions/overdrive.js';
import { buildContext } from '../hooks/lib.js';

const root = fileURLToPath(new URL('../', import.meta.url));

function createPiHarness() {
  const events = new Map();
  overdriveExtension({ on: (name, handler) => events.set(name, handler) });
  return events;
}

test('before_agent_start appends context to the base prompt', async () => {
  const { systemPrompt } = await createPiHarness().get('before_agent_start')({ systemPrompt: 'BASE' });
  assert.ok(systemPrompt.startsWith('BASE'));
  assert.ok(systemPrompt.endsWith(buildContext(root)));
});

test('resources_discover returns the skills dir', async () => {
  const { skillPaths } = await createPiHarness().get('resources_discover')({});
  assert.ok(skillPaths.some((p) => p.endsWith('skills')));
});
