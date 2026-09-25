import { test } from 'node:test';
import assert from 'node:assert/strict';
import overdrivePlugin from '../.opencode/plugins/overdrive.mjs';

test('config adds the skills path exactly once', async () => {
  const hooks = await overdrivePlugin({});
  const config = {};
  await hooks.config(config);
  await hooks.config(config);
  assert.equal(config.skills.paths.length, 1);
  assert.ok(config.skills.paths[0].endsWith('skills'));
});

test('system transform appends one context entry', async () => {
  const hooks = await overdrivePlugin({});
  const output = { system: ['BASE'] };
  await hooks['experimental.chat.system.transform']({}, output);
  assert.equal(output.system.length, 2);
  assert.ok(output.system[1].includes('OVERDRIVE HARNESS ACTIVE'));
});
