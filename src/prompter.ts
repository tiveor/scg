import * as clack from '@clack/prompts';

/**
 * Asks the user for values. The CLI uses a terminal implementation; tests and
 * other front ends (an editor, an MCP client) can provide their own.
 */
export interface Prompter {
  text(options: {
    message: string;
    initialValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  confirm(options: { message: string; initialValue?: boolean }): Promise<boolean>;
  select(options: {
    message: string;
    options: string[];
    initialValue?: string;
  }): Promise<string>;
  multiselect(options: {
    message: string;
    options: string[];
    initialValues?: string[];
  }): Promise<string[]>;
}

/** Thrown when the user cancels a prompt (Ctrl+C or Esc). */
export class PromptCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'PromptCancelledError';
  }
}

function unwrap<T>(value: T): Exclude<T, symbol> {
  if (clack.isCancel(value)) {
    throw new PromptCancelledError();
  }
  return value as Exclude<T, symbol>;
}

/** Terminal prompter built on `@clack/prompts`. */
export function createClackPrompter(): Prompter {
  return {
    async text({ message, initialValue, validate }) {
      return unwrap(
        await clack.text({
          message,
          initialValue,
          validate: validate ? (value) => validate(value ?? '') : undefined
        })
      );
    },
    async confirm({ message, initialValue }) {
      return unwrap(await clack.confirm({ message, initialValue }));
    },
    async select({ message, options, initialValue }) {
      return unwrap(
        await clack.select({
          message,
          options: options.map((value) => ({ value })),
          initialValue
        })
      );
    },
    async multiselect({ message, options, initialValues }) {
      return unwrap(
        await clack.multiselect({
          message,
          options: options.map((value) => ({ value })),
          initialValues,
          required: false
        })
      );
    }
  };
}
