import path from 'path';
import { styleText } from 'util';
import type { ScaffoldResult } from './scaffold.js';

type Style = Parameters<typeof styleText>[0];

/**
 * Formats a scaffold result as one line per file, with paths relative to `cwd`:
 *
 * ```
 * ✔ created    src/components/Button/Button.tsx
 * = unchanged  src/components/Button/index.ts
 * ! skipped    src/components/Button/Button.test.tsx  (local changes, use --force)
 * ```
 *
 * @param result - The result returned by `Scaffold.from()`
 * @param cwd - Folder the paths are shown relative to
 * @param color - Whether to add ANSI colors
 */
export function formatResult(
  result: ScaffoldResult,
  cwd: string,
  color: boolean
): string[] {
  const paint = (style: Style, text: string) =>
    color ? styleText(style, text, { validateStream: false }) : text;
  const rel = (file: string) => path.relative(cwd, path.resolve(cwd, file)) || '.';

  return [
    ...result.files.map(
      (file) =>
        `${paint('green', result.dryRun ? '+ would create' : '✔ created  ')}  ${rel(file)}`
    ),
    ...result.unchanged.map(
      (file) => `${paint('dim', '= unchanged')}  ${rel(file)}`
    ),
    ...result.skipped.map(
      (file) =>
        `${paint('yellow', '! skipped  ')}  ${rel(file)}  ${paint('dim', '(local changes, use --force)')}`
    )
  ];
}
