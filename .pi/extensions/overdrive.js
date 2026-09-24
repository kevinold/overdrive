// overdrive — Pi extension: registers skills/ and appends the harness context to the system prompt.
import { fileURLToPath } from 'node:url';
import { buildContext } from '../../hooks/lib.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skillsDir = fileURLToPath(new URL('../../skills', import.meta.url));

export default function overdriveExtension(pi) {
  pi.on('resources_discover', async () => ({ skillPaths: [skillsDir] }));
  pi.on('before_agent_start', async (event) => ({ systemPrompt: `${event.systemPrompt}\n\n${buildContext(root)}` }));
}
