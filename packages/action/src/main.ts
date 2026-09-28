import { runAction } from './dispatch.js';

process.exitCode = await runAction(process.argv.slice(2), {
  env: process.env,
  stdout: (text) => {
    process.stdout.write(text);
  },
});
