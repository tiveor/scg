import type { GeneratorManifest, PromptDefinition } from './manifest.js';
import type { Prompter } from './prompter.js';

/** Options for {@link resolveInputs}. */
export interface ResolveOptions {
  /** Generator name, used in error messages. */
  generatorName: string;
  /** Value of the positional argument (`scg new <generator> <value>`). */
  positional?: string;
  /** Whether missing values may be asked for. `false` in CI, with `--yes`, or from agents. */
  interactive: boolean;
  /** Asks for missing values when `interactive` is `true`. */
  prompter?: Prompter;
}

/** Thrown when required inputs are missing and they cannot be asked for. */
export class MissingInputError extends Error {
  constructor(
    generatorName: string,
    public readonly missing: PromptDefinition[]
  ) {
    const flags = missing.map((p) => `--${p.name}=<${placeholder(p)}>`);
    const width = Math.max(...flags.map((f) => f.length)) + 3;
    super(
      [
        `Missing required input for "${generatorName}":`,
        ...missing.map(
          (p, i) =>
            `  ${flags[i].padEnd(width)}${p.description ?? p.message ?? p.name}`
        ),
        'Pass the values as flags, or run in an interactive terminal.'
      ].join('\n')
    );
    this.name = 'MissingInputError';
  }
}

function placeholder(prompt: PromptDefinition): string {
  if (prompt.choices) return prompt.choices.join('|');
  return prompt.type === 'confirm' ? 'true|false' : prompt.type;
}

function invalid(prompt: PromptDefinition, raw: unknown, expected: string): Error {
  return new Error(
    `Invalid value for --${prompt.name}: ${JSON.stringify(raw)}. Expected ${expected}.`
  );
}

const TRUE = ['true', 'yes', 'y', '1'];
const FALSE = ['false', 'no', 'n', '0'];

/**
 * Converts a provided value (usually a string from a CLI flag) to the prompt's type.
 *
 * @throws If the value is not valid for the prompt
 */
export function coerce(prompt: PromptDefinition, raw: unknown): unknown {
  switch (prompt.type) {
    case 'confirm': {
      if (typeof raw === 'boolean') return raw;
      const text = String(raw).trim().toLowerCase();
      if (TRUE.includes(text)) return true;
      if (FALSE.includes(text)) return false;
      throw invalid(prompt, raw, 'true/false, yes/no, y/n or 1/0');
    }
    case 'number': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (String(raw).trim() === '' || !Number.isFinite(value)) {
        throw invalid(prompt, raw, 'a number');
      }
      return value;
    }
    case 'select': {
      const value = String(raw);
      if (!prompt.choices?.includes(value)) {
        throw invalid(prompt, raw, `one of: ${prompt.choices?.join(', ')}`);
      }
      return value;
    }
    case 'multiselect': {
      const values = Array.isArray(raw)
        ? raw.map(String)
        : String(raw)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
      if (!values.every((v) => prompt.choices?.includes(v))) {
        throw invalid(
          prompt,
          raw,
          `a comma-separated list of: ${prompt.choices?.join(', ')}`
        );
      }
      return values;
    }
    default: {
      const value = String(raw);
      if (prompt.pattern && !new RegExp(prompt.pattern).test(value)) {
        throw invalid(prompt, raw, `text matching /${prompt.pattern}/`);
      }
      return value;
    }
  }
}

/** Returns a validation message for a value typed interactively, or `undefined`. */
function validateTyped(prompt: PromptDefinition, value: string): string | undefined {
  if (value === '') {
    return prompt.required ? 'Required' : undefined;
  }
  try {
    coerce(prompt, value);
    return undefined;
  } catch (error) {
    return (error as Error).message.replace(/^Invalid value for --\S+: /, '');
  }
}

async function ask(
  prompt: PromptDefinition,
  fallback: unknown,
  prompter: Prompter
): Promise<unknown> {
  const message = prompt.message ?? prompt.name;
  switch (prompt.type) {
    case 'confirm':
      return prompter.confirm({
        message,
        initialValue: fallback === undefined ? undefined : Boolean(fallback)
      });
    case 'select':
      return prompter.select({
        message,
        options: prompt.choices ?? [],
        initialValue: fallback as string | undefined
      });
    case 'multiselect':
      return prompter.multiselect({
        message,
        options: prompt.choices ?? [],
        initialValues: Array.isArray(fallback) ? fallback.map(String) : undefined
      });
    default: {
      const answer = await prompter.text({
        message,
        initialValue: fallback === undefined ? undefined : String(fallback),
        validate: (value) => validateTyped(prompt, value)
      });
      if (answer === '') return emptyValue(prompt);
      return coerce(prompt, answer);
    }
  }
}

function emptyValue(prompt: PromptDefinition): unknown {
  if (prompt.type === 'confirm') return false;
  if (prompt.type === 'multiselect') return [];
  return undefined;
}

/**
 * Collects the values for a generator. For each prompt the first available
 * source wins: explicit value, positional argument, interactive answer,
 * default. Legacy `variables` act as defaults, and provided keys that are not
 * prompts are passed through to the templates.
 *
 * @param manifest - The generator manifest
 * @param provided - Values given explicitly (e.g. CLI flags), usually strings
 * @param options - See {@link ResolveOptions}
 * @returns Template variables, typed according to the prompts
 * @throws {@link MissingInputError} if required values are missing and cannot be asked for
 */
export async function resolveInputs(
  manifest: GeneratorManifest,
  provided: Record<string, unknown>,
  options: ResolveOptions
): Promise<Record<string, unknown>> {
  const prompts = manifest.prompts ?? [];
  const promptNames = new Set(prompts.map((p) => p.name));
  const values: Record<string, unknown> = { ...(manifest.variables ?? {}) };

  for (const [key, value] of Object.entries(provided)) {
    if (!promptNames.has(key)) values[key] = value;
  }

  const missing: PromptDefinition[] = [];
  const canAsk = options.interactive && options.prompter !== undefined;

  for (const prompt of prompts) {
    const fallback = prompt.default ?? manifest.variables?.[prompt.name];

    if (prompt.name in provided) {
      values[prompt.name] = coerce(prompt, provided[prompt.name]);
    } else if (prompt.positional && options.positional !== undefined) {
      values[prompt.name] = coerce(prompt, options.positional);
    } else if (canAsk) {
      values[prompt.name] = await ask(prompt, fallback, options.prompter!);
    } else if (fallback !== undefined) {
      values[prompt.name] = fallback;
    } else if (prompt.required) {
      missing.push(prompt);
    } else {
      values[prompt.name] = emptyValue(prompt);
    }
  }

  if (missing.length > 0) {
    throw new MissingInputError(options.generatorName, missing);
  }
  return values;
}
