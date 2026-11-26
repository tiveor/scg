import { describe, it, expect } from 'vitest';

import {
  resolveInputs,
  coerce,
  MissingInputError
} from '../src/inputs.js';
import type { GeneratorManifest, PromptDefinition } from '../src/manifest.js';
import { PromptCancelledError, type Prompter } from '../src/prompter.js';

function manifest(
  prompts: PromptDefinition[],
  variables: Record<string, unknown> = {}
): GeneratorManifest {
  return {
    engine: 'EJS',
    templateDir: '.',
    outputDir: 'out',
    structure: [],
    variables,
    prompts
  };
}

/** Fake prompter: answers by prompt message and records what was asked. */
function fakePrompter(answers: Record<string, unknown>) {
  const asked: string[] = [];
  const answer = (message: string) => {
    asked.push(message);
    if (answers[message] instanceof Error) throw answers[message];
    return answers[message];
  };
  const prompter: Prompter = {
    text: async ({ message, validate }) => {
      const value = String(answer(message));
      const problem = validate?.(value);
      if (problem) throw new Error(`validation: ${problem}`);
      return value;
    },
    confirm: async ({ message }) => answer(message) as boolean,
    select: async ({ message }) => answer(message) as string,
    multiselect: async ({ message }) => answer(message) as string[]
  };
  return { prompter, asked };
}

const name: PromptDefinition = {
  name: 'name',
  type: 'text',
  message: 'Component name',
  positional: true,
  required: true
};

const base = { generatorName: 'comp', interactive: false };

describe('resolveInputs priority', () => {
  it('flag beats positional', async () => {
    const values = await resolveInputs(
      manifest([name]),
      { name: 'FromFlag' },
      { ...base, positional: 'FromPositional' }
    );
    expect(values.name).toBe('FromFlag');
  });

  it('positional fills the positional prompt', async () => {
    const values = await resolveInputs(manifest([name]), {}, {
      ...base,
      positional: 'Button'
    });
    expect(values.name).toBe('Button');
  });

  it('asks only for values that were not provided', async () => {
    const { prompter, asked } = fakePrompter({ Styling: 'none' });
    const values = await resolveInputs(
      manifest([
        name,
        { name: 'style', type: 'select', message: 'Styling', choices: ['module', 'none'], default: 'module' }
      ]),
      {},
      { ...base, positional: 'Button', interactive: true, prompter }
    );
    expect(asked).toEqual(['Styling']);
    expect(values).toMatchObject({ name: 'Button', style: 'none' });
  });

  it('uses defaults when not interactive', async () => {
    const values = await resolveInputs(
      manifest([
        { name: 'withTest', type: 'confirm', default: true },
        { name: 'style', type: 'select', choices: ['a', 'b'], default: 'b' }
      ]),
      {},
      base
    );
    expect(values).toEqual({ withTest: true, style: 'b' });
  });

  it('legacy variables act as defaults and unknown flags pass through', async () => {
    const values = await resolveInputs(
      manifest([{ name: 'style', type: 'text' }], { style: 'legacy', branch: 'main' }),
      { extra: 'x' },
      base
    );
    expect(values).toEqual({ style: 'legacy', branch: 'main', extra: 'x' });
  });

  it('fills optional prompts without a default', async () => {
    const values = await resolveInputs(
      manifest([
        { name: 'flag', type: 'confirm' },
        { name: 'many', type: 'multiselect', choices: ['a'] },
        { name: 'note', type: 'text' }
      ]),
      {},
      base
    );
    expect(values).toEqual({ flag: false, many: [], note: undefined });
    expect('note' in values).toBe(true);
  });
});

describe('missing input', () => {
  it('reports every missing required input with its flag', async () => {
    const error = await resolveInputs(
      manifest([
        name,
        { name: 'kind', type: 'select', choices: ['a', 'b'], required: true }
      ]),
      {},
      base
    ).catch((e) => e);

    expect(error).toBeInstanceOf(MissingInputError);
    expect(error.missing.map((p: PromptDefinition) => p.name)).toEqual(['name', 'kind']);
    expect(error.message).toBe(
      [
        'Missing required input for "comp":',
        '  --name=<text>   Component name',
        '  --kind=<a|b>    kind',
        'Pass the values as flags, or run in an interactive terminal.'
      ].join('\n')
    );
  });

  it('propagates a cancelled prompt', async () => {
    const { prompter } = fakePrompter({ 'Component name': new PromptCancelledError() });
    await expect(
      resolveInputs(manifest([name]), {}, { ...base, interactive: true, prompter })
    ).rejects.toBeInstanceOf(PromptCancelledError);
  });

  it('validates required text typed interactively', async () => {
    const { prompter } = fakePrompter({ 'Component name': '' });
    await expect(
      resolveInputs(manifest([name]), {}, { ...base, interactive: true, prompter })
    ).rejects.toThrow(/validation: Required/);
  });
});

describe('coerce', () => {
  const confirm: PromptDefinition = { name: 'ok', type: 'confirm' };
  it.each([
    ['yes', true],
    ['Y', true],
    ['1', true],
    ['true', true],
    ['no', false],
    ['0', false],
    ['FALSE', false],
    [true, true]
  ])('confirm %j -> %j', (raw, expected) => {
    expect(coerce(confirm, raw)).toBe(expected);
  });

  it('rejects an invalid confirm', () => {
    expect(() => coerce(confirm, 'maybe')).toThrow(
      'Invalid value for --ok: "maybe". Expected true/false, yes/no, y/n or 1/0.'
    );
  });

  it('parses numbers', () => {
    const num: PromptDefinition = { name: 'n', type: 'number' };
    expect(coerce(num, '3')).toBe(3);
    expect(coerce(num, 2.5)).toBe(2.5);
    expect(() => coerce(num, 'x')).toThrow(/Expected a number/);
  });

  it('checks select choices', () => {
    const select: PromptDefinition = { name: 's', type: 'select', choices: ['a', 'b'] };
    expect(coerce(select, 'a')).toBe('a');
    expect(() => coerce(select, 'z')).toThrow('Invalid value for --s: "z". Expected one of: a, b.');
  });

  it('splits multiselect values', () => {
    const multi: PromptDefinition = { name: 'm', type: 'multiselect', choices: ['a', 'b', 'c'] };
    expect(coerce(multi, 'a, c')).toEqual(['a', 'c']);
    expect(coerce(multi, ['b'])).toEqual(['b']);
    expect(coerce(multi, '')).toEqual([]);
    expect(() => coerce(multi, 'a,z')).toThrow(/Expected a comma-separated list of: a, b, c/);
  });

  it('checks text patterns', () => {
    const text: PromptDefinition = { name: 'name', type: 'text', pattern: '^[A-Z]' };
    expect(coerce(text, 'Button')).toBe('Button');
    expect(() => coerce(text, 'button')).toThrow(
      'Invalid value for --name: "button". Expected text matching /^[A-Z]/.'
    );
  });
});
