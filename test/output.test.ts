import { describe, it, expect } from 'vitest';
import path from 'path';
import { formatResult } from '../src/output.js';

const cwd = path.resolve('/project');
const result = {
  files: [path.join(cwd, 'src', 'a.ts')],
  unchanged: ['src/b.ts'],
  skipped: [path.join(cwd, 'src', 'c.ts')],
  dryRun: false
};

describe('formatResult', () => {
  it('prints one aligned line per file, relative to cwd', () => {
    expect(formatResult(result, cwd, false)).toEqual([
      `✔ created    ${path.join('src', 'a.ts')}`,
      `= unchanged  ${path.join('src', 'b.ts')}`,
      `! skipped    ${path.join('src', 'c.ts')}  (local changes, use --force)`
    ]);
  });

  it('says "would create" in dry runs', () => {
    expect(formatResult({ ...result, dryRun: true }, cwd, false)[0]).toBe(
      `+ would create  ${path.join('src', 'a.ts')}`
    );
  });

  it('adds ANSI colors only when asked', () => {
    const [line] = formatResult(result, cwd, true);
    expect(line).toContain('\u001b[');
  });
});
