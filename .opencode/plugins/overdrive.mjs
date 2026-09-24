// overdrive — OpenCode plugin: registers skills/ and appends the harness context to the system prompt.
import { fileURLToPath } from 'node:url';
import { buildContext } from '../../hooks/lib.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skillsDir = fileURLToPath(new URL('../../skills', import.meta.url));

export default async () => ({
  config: async (config) => {
    config.skills = config.skills || {};
    config.skills.paths = config.skills.paths || [];
    if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);
  },
  'experimental.chat.system.transform': async (_input, output) => {
    output.system.push(buildContext(root));
  },
});
