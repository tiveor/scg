#!/usr/bin/env node

import { runCli } from './cli_runner.js';
import { createClackPrompter } from './prompter.js';

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

runCli(process.argv.slice(2), undefined, {
  interactive,
  prompter: interactive ? createClackPrompter() : undefined,
  color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
}).then((code) => {
  process.exitCode = code;
});
