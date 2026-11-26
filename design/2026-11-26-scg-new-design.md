# Design: `scg new` (generators by name, prompts, casing)

*Status: approved 2026-11-26. First piece of P1 in the improvement plan. Out of scope: injecting into existing files, remote templates, MCP server, `nextSteps`.*

## Goal

A new user gets a working, idiomatic component in under 30 seconds:

```bash
npx @tiveor/scg new react-component Button
```

The same command must work non-interactively (CI, AI agents) and fail with a precise message instead of waiting for input.

## Commands

| Command | Behavior |
|---|---|
| `scg new <generator> [positional] [--<var>=<value>…] [--vars=<json or pairs>] [--yes] [--dry-run] [--force]` | Resolve the generator, collect inputs, run the scaffold. |
| `scg new` (no generator) | Interactive terminal: select from `scg list`. Non-interactive: error with the list of generators. |
| `scg list` | Print generators (project first, then built-in) with name, source and description. |
| `scg init <name>` | Create `.scg/<name>/scaffold.json` plus one example template. Fails if the folder exists. Without `<name>` it uses `component`. |
| `scg generate --manifest=…` | Unchanged (backwards compatible). |
| `scg render <template>` | Unchanged. |

`--yes` means "never prompt; use defaults". Reserved flags (`yes`, `dry-run`, `force`, `vars`, `manifest`) cannot be used as prompt names; a manifest that declares one is rejected.

## Generator resolution

1. `<cwd>/.scg/<name>/scaffold.json` (project generator)
2. `<package>/templates/<name>/scaffold.json` (built-in)

A project generator with the same name as a built-in one overrides it. `scg list` marks overridden built-ins as hidden. Unknown name → error listing every available generator, plus a "did you mean" suggestion when the Levenshtein distance is ≤ 3.

The package root is found from the compiled module location (`import.meta.url` in ESM, `__dirname` in CJS), walking up to the folder that contains `package.json` named `@tiveor/scg`.

## Manifest format

```json
{
  "name": "react-component",
  "description": "React component with CSS module and test",
  "engine": "EJS",
  "templateDir": ".",
  "outputDir": "src/components/{{name:pascal}}",
  "prompts": [
    { "name": "name", "type": "text", "message": "Component name", "positional": true, "required": true, "pattern": "^[A-Za-z][A-Za-z0-9]*$" },
    { "name": "style", "type": "select", "message": "Styling", "choices": ["module", "none"], "default": "module" },
    { "name": "withTest", "type": "confirm", "message": "Add a test?", "default": true }
  ],
  "structure": [
    { "template": "component.ejs", "output": "{{name:pascal}}.tsx" },
    { "template": "test.ejs", "output": "{{name:pascal}}.test.tsx", "when": "withTest" }
  ]
}
```

- `name` and `description` are optional (the folder name is the default name).
- `prompts[]` fields: `name` (required, identifier), `type` (`text` | `confirm` | `select` | `multiselect` | `number`), `message` (defaults to `name`), `default`, `choices` (required for `select`/`multiselect`, array of strings), `required` (default `false`), `positional` (at most one prompt), `pattern` (regex string, `text` only), `description`.
- The legacy `variables` object stays valid: its entries act as defaults and also fill values for names not declared in `prompts`.
- `structure[].when`: a variable name (file generated when truthy) or `!name` (when falsy). Unknown variable → manifest error. No expression evaluation.

Manifest validation happens once, when loading, and reports every problem with its JSON path (e.g. `prompts[1].choices: required for type "select"`).

## Input resolution

Priority for each prompt, highest first:

1. Explicit flag: `--name=Button` or a key in `--vars`.
2. Positional argument (only for the prompt with `positional: true`).
3. Interactive question, only when stdin and stdout are TTYs and `--yes` was not passed.
4. `default` (from the prompt, else from legacy `variables`).
5. Otherwise: if `required`, error; if not, the value is `undefined`, except `confirm` → `false` and `multiselect` → `[]`.

Coercion of string values coming from flags:

| Type | Accepted | Result |
|---|---|---|
| `text` | any string; checked against `pattern` | string |
| `confirm` | `true/false/yes/no/y/n/1/0` (case-insensitive) | boolean |
| `number` | finite number | number |
| `select` | one of `choices` | string |
| `multiselect` | comma-separated subset of `choices` (JSON array via `--vars`) | string[] |

Invalid values produce an error naming the flag, the value and what is accepted. In non-interactive mode, all missing required inputs are reported at once:

```
Missing required input for "react-component":
  --name=<text>   Component name
Pass the values as flags, or run in an interactive terminal.
```

Unknown flags (`--colour=red` when no prompt is called `colour`) are passed through as template variables, matching today's `--vars` behavior.

## Casing

`src/casing.ts` exports pure functions: `camel`, `pascal`, `kebab`, `snake`, `constant`, `title`, `lower`, `upper`, `plural`.

- Word splitting handles `camelCase`, `PascalCase`, `kebab-case`, `snake_case`, spaces and acronyms (`HTTPServer` → `http`, `server`).
- `plural` uses simple English rules (`y` after consonant → `ies`; `s/x/z/ch/sh` → `es`; else `s`) and keeps the input's casing. Documented as simple, not linguistic.

Usage:
- **Paths:** `{{name:pascal}}`. `{{name}}` keeps the raw value. Unknown modifier → error. Path safety rules from 0.6.0 apply after the modifier.
- **EJS / Pug:** templates receive `h` with every helper: `<%= h.pascal(name) %>`. If the user defines a variable called `h`, theirs wins and the helpers are not injected.
- **Handlebars:** helpers registered once on the shared instance: `{{pascal name}}`.

## Output

`scg new` and `scg generate` print one line per file, relative to the cwd:

```
✔ created    src/components/Button/Button.tsx
= unchanged  src/components/Button/index.ts
! skipped    src/components/Button/Button.test.tsx  (local changes, use --force)
```

Colors via `util.styleText` (built into Node 22, respects `NO_COLOR`). Dry runs say `would create`. Exit code 0 unless an error occurs.

## Prompts library

`@clack/prompts` behind a small `Prompter` interface (`text`, `confirm`, `select`, `multiselect`, `number`, `cancelled`). Ctrl+C exits with code 130 and writes nothing. Tests use a fake prompter that returns scripted answers.

## Modules

| File | Responsibility | Depends on |
|---|---|---|
| `src/casing.ts` | Case helpers and word splitting | — |
| `src/manifest.ts` | Manifest types, `loadManifest`, validation | casing (modifier names) |
| `src/generators.ts` | Find, list and resolve generators | manifest |
| `src/inputs.ts` | Merge flags, positional, prompts, defaults; coercion | manifest, prompter |
| `src/prompter.ts` | `Prompter` interface + clack implementation | @clack/prompts |
| `src/scaffold.ts` | Adds `when` and `{{var:modifier}}`; injects helpers | casing |
| `src/cli_runner.ts` | `new`, `list`, `init`; formatted output | all of the above |

`Scaffold.loadManifest` stays as a thin wrapper over `manifest.ts` for compatibility. New public exports: `Casing`, `Generators`, `resolveInputs`, and the manifest/prompt types.

## Built-in packs

All four packs gain `name`, `description` and `prompts`, use casing in paths and templates, and the React and Vue packs make the test file optional with `withTest`.

## Testing

- `casing`: table-driven cases, including acronyms, numbers and plural rules.
- `manifest`: valid manifests, each validation error, legacy `variables`.
- `generators`: project override, built-in lookup from an empty folder, suggestion for typos.
- `inputs`: every priority level, each coercion, non-interactive missing-input report, fake prompter answers, cancel.
- `scaffold`: `when` / `!when`, path modifiers, `h` helpers in EJS/Pug, Handlebars helpers.
- CLI: `new` with flags and `--yes`, `new` with a fake prompter, `list`, `init`, unknown generator suggestion.
- Packaging: the existing tarball check is repeated (`npm pack` → install in an empty folder → `scg new react-component Button --yes`).
