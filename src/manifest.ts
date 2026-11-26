import fs from 'fs';
import path from 'path';
import { isCaseModifier, CASE_MODIFIERS } from './casing.js';
import type { ScaffoldOptions } from './scaffold.js';

/** Kind of value a prompt collects. */
export type PromptType = 'text' | 'confirm' | 'select' | 'multiselect' | 'number';

/** One input a generator asks for. */
export interface PromptDefinition {
  /** Variable name used in templates and paths, and as the CLI flag (`--name`). */
  name: string;
  /** Kind of value. */
  type: PromptType;
  /** Question shown to the user (defaults to `name`). */
  message?: string;
  /** Value used when nothing else provides one. */
  default?: unknown;
  /** Allowed values for `select` and `multiselect`. */
  choices?: string[];
  /** If `true`, generation fails when no value is provided. */
  required?: boolean;
  /** If `true`, the value can be given as the positional argument (`scg new pack Value`). */
  positional?: boolean;
  /** Regular expression a `text` value must match. */
  pattern?: string;
  /** Extra help shown in listings and error messages. */
  description?: string;
}

/** A scaffold manifest with metadata and typed prompts. */
export interface GeneratorManifest extends ScaffoldOptions {
  /** Generator name (defaults to the folder name). */
  name?: string;
  /** One-line description shown by `scg list`. */
  description?: string;
  /** Inputs the generator asks for. */
  prompts?: PromptDefinition[];
}

/** CLI flags that cannot be used as prompt names. */
export const RESERVED_FLAGS = ['yes', 'dry-run', 'force', 'vars', 'manifest'];

const PROMPT_TYPES: PromptType[] = [
  'text',
  'confirm',
  'select',
  'multiselect',
  'number'
];

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Matches `{{name}}` and `{{name:modifier}}` tokens in paths.
 * Group 1 is the variable name, group 2 the optional modifier.
 */
export const PATH_TOKEN = /\{\{\s*([A-Za-z_$][\w$]*)(?::([A-Za-z]+))?\s*\}\}/g;

/** Thrown when a manifest is invalid. `problems` lists every issue found. */
export class ManifestError extends Error {
  constructor(
    source: string,
    public readonly problems: string[]
  ) {
    super(
      `Invalid manifest ${source}:\n${problems.map((p) => `  - ${p}`).join('\n')}`
    );
    this.name = 'ManifestError';
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks a parsed manifest and returns it typed. Collects every problem
 * (with its JSON path) before throwing a single {@link ManifestError}.
 *
 * @param raw - The parsed JSON value
 * @param source - Where the manifest came from, used in error messages
 */
export function validateManifest(raw: unknown, source: string): GeneratorManifest {
  const problems: string[] = [];
  if (!isObject(raw)) {
    throw new ManifestError(source, ['the manifest must be a JSON object']);
  }

  for (const key of ['name', 'description'] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') {
      problems.push(`${key}: must be a string`);
    }
  }
  if (typeof raw.engine !== 'string' || !raw.engine) {
    problems.push('engine: required (e.g. "EJS")');
  }
  if (raw.templateDir !== undefined && typeof raw.templateDir !== 'string') {
    problems.push('templateDir: must be a string');
  }
  if (typeof raw.outputDir !== 'string') {
    problems.push('outputDir: required');
  } else {
    checkPathTokens(raw.outputDir, 'outputDir', problems);
  }
  if (raw.variables !== undefined && !isObject(raw.variables)) {
    problems.push('variables: must be an object');
  }

  const known = new Set<string>(
    isObject(raw.variables) ? Object.keys(raw.variables) : []
  );
  validatePrompts(raw.prompts, known, problems);

  if (!Array.isArray(raw.structure)) {
    problems.push('structure: required (an array of { template, output })');
  } else {
    raw.structure.forEach((file, i) => {
      const at = `structure[${i}]`;
      if (!isObject(file)) {
        problems.push(`${at}: must be an object`);
        return;
      }
      if (typeof file.template !== 'string' || !file.template) {
        problems.push(`${at}.template: required`);
      }
      if (typeof file.output !== 'string' || !file.output) {
        problems.push(`${at}.output: required`);
      } else {
        checkPathTokens(file.output, `${at}.output`, problems);
      }
      if (file.when !== undefined) {
        const name =
          typeof file.when === 'string' ? file.when.replace(/^!/, '') : '';
        if (!IDENTIFIER.test(name)) {
          problems.push(`${at}.when: must be a variable name or "!name"`);
        } else if (!known.has(name)) {
          problems.push(`${at}.when: unknown variable "${name}"`);
        }
      }
    });
  }

  if (problems.length > 0) {
    throw new ManifestError(source, problems);
  }

  return {
    ...(raw as unknown as GeneratorManifest),
    variables: { ...((raw.variables as Record<string, unknown>) ?? {}) },
    templateDir: (raw.templateDir as string | undefined) ?? '.'
  };
}

function validatePrompts(
  prompts: unknown,
  known: Set<string>,
  problems: string[]
): void {
  if (prompts === undefined) return;
  if (!Array.isArray(prompts)) {
    problems.push('prompts: must be an array');
    return;
  }

  let positionalCount = 0;
  const seen = new Set<string>();
  prompts.forEach((prompt, i) => {
    const at = `prompts[${i}]`;
    if (!isObject(prompt)) {
      problems.push(`${at}: must be an object`);
      return;
    }

    const name = prompt.name;
    if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
      problems.push(`${at}.name: must be an identifier (letters, digits, _ or $)`);
    } else if (RESERVED_FLAGS.includes(name)) {
      problems.push(`${at}.name: "${name}" is reserved for a CLI flag`);
    } else if (seen.has(name)) {
      problems.push(`${at}.name: duplicate prompt "${name}"`);
    } else {
      seen.add(name);
      known.add(name);
    }

    const type = prompt.type as PromptType;
    if (!PROMPT_TYPES.includes(type)) {
      problems.push(`${at}.type: must be one of ${PROMPT_TYPES.join(', ')}`);
    }

    const needsChoices = type === 'select' || type === 'multiselect';
    const choices = prompt.choices;
    if (needsChoices) {
      if (
        !Array.isArray(choices) ||
        choices.length === 0 ||
        !choices.every((c) => typeof c === 'string')
      ) {
        problems.push(`${at}.choices: required for type "${type}" (array of strings)`);
      } else if (
        type === 'select' &&
        prompt.default !== undefined &&
        !choices.includes(prompt.default as string)
      ) {
        problems.push(`${at}.default: must be one of the choices`);
      }
    } else if (choices !== undefined) {
      problems.push(`${at}.choices: only allowed for select and multiselect`);
    }

    if (prompt.pattern !== undefined) {
      if (type !== 'text') {
        problems.push(`${at}.pattern: only allowed for type "text"`);
      } else {
        try {
          new RegExp(String(prompt.pattern));
        } catch {
          problems.push(`${at}.pattern: invalid regular expression`);
        }
      }
    }

    for (const key of ['message', 'description'] as const) {
      if (prompt[key] !== undefined && typeof prompt[key] !== 'string') {
        problems.push(`${at}.${key}: must be a string`);
      }
    }
    if (prompt.positional === true) positionalCount++;
  });

  if (positionalCount > 1) {
    problems.push('prompts: only one prompt can be positional');
  }
}

function checkPathTokens(value: string, at: string, problems: string[]): void {
  for (const match of value.matchAll(PATH_TOKEN)) {
    const modifier = match[2];
    if (modifier && !isCaseModifier(modifier)) {
      problems.push(
        `${at}: unknown modifier "${modifier}" (use ${CASE_MODIFIERS.join(', ')})`
      );
    }
  }
}

/**
 * Reads and validates a manifest file. A relative `templateDir` is resolved
 * against the manifest's own folder; `outputDir` stays relative to the cwd.
 *
 * @param manifestPath - Path to `scaffold.json`
 * @throws If the file is missing, is not valid JSON, or fails validation
 */
export function loadManifest(manifestPath: string): GeneratorManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Invalid JSON in manifest ${manifestPath}: ${(error as Error).message}`
    );
  }

  const manifest = validateManifest(raw, manifestPath);
  const manifestDir = path.dirname(path.resolve(manifestPath));
  return {
    ...manifest,
    templateDir: path.resolve(manifestDir, manifest.templateDir)
  };
}
