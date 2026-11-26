import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadManifest } from './manifest.js';

/** A generator that `scg new <name>` can run. */
export interface GeneratorInfo {
  /** Name used on the command line (the folder name). */
  name: string;
  /** One-line description from the manifest. */
  description?: string;
  /** `project` for `.scg/<name>/`, `built-in` for packs shipped with SCG. */
  source: 'project' | 'built-in';
  /** Absolute path to the generator's `scaffold.json`. */
  manifestPath: string;
  /** `true` for a built-in generator hidden by a project generator with the same name. */
  overridden?: boolean;
}

const PACKAGE_NAME = '@tiveor/scg';

/** Folder, relative to the project root, that holds project generators. */
export const PROJECT_GENERATORS_DIR = '.scg';

/**
 * Returns the root folder of the installed SCG package (where `templates/` lives).
 * Works from the source tree, the ESM build and the CJS build.
 */
export function packageRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === PACKAGE_NAME) return dir;
      } catch {
        // Unreadable package.json: keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Cannot find the ${PACKAGE_NAME} package root`);
    }
    dir = parent;
  }
}

function scanDir(dir: string, source: GeneratorInfo['source']): GeneratorInfo[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name, 'scaffold.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map((manifestPath) => {
      const name = path.basename(path.dirname(manifestPath));
      let description: string | undefined;
      try {
        description = loadManifest(manifestPath).description;
      } catch {
        // Invalid manifests are still listed; running them shows the error
        description = '(invalid manifest)';
      }
      return { name, description, source, manifestPath };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Lists project generators (`<cwd>/.scg/*`) followed by built-in ones.
 * Built-ins hidden by a project generator with the same name are marked `overridden`.
 *
 * @param cwd - Project folder (defaults to `process.cwd()`)
 */
export function listGenerators(cwd: string = process.cwd()): GeneratorInfo[] {
  const project = scanDir(path.join(cwd, PROJECT_GENERATORS_DIR), 'project');
  const projectNames = new Set(project.map((g) => g.name));
  const builtIn = scanDir(path.join(packageRoot(), 'templates'), 'built-in').map(
    (g) => (projectNames.has(g.name) ? { ...g, overridden: true } : g)
  );
  return [...project, ...builtIn];
}

/**
 * Finds a generator by name: project generators first, then built-in ones.
 *
 * @throws If no generator has that name; the message lists the available
 *   generators and suggests the closest name
 */
export function resolveGenerator(
  name: string,
  cwd: string = process.cwd()
): GeneratorInfo {
  const all = listGenerators(cwd).filter((g) => !g.overridden);
  const found = all.find((g) => g.name === name);
  if (found) return found;

  const names = all.map((g) => g.name);
  const hint = suggest(name, names);
  throw new Error(
    [
      `Unknown generator "${name}".${hint ? ` Did you mean "${hint}"?` : ''}`,
      `Available generators: ${names.join(', ') || '(none)'}`
    ].join('\n')
  );
}

/** Returns the closest candidate within an edit distance of 3, if any. */
export function suggest(name: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 4;
  for (const candidate of candidates) {
    const distance = levenshtein(name, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[b.length];
}
