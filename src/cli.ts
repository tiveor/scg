#!/usr/bin/env node

import { runCli } from './cli_runner.js';

runCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
