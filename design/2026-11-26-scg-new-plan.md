# `scg new` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `scg new <generator>` with typed prompts, casing helpers, conditional files, generator lookup (project `.scg/` + built-in) and readable output, as specified in [2026-11-26-scg-new-design.md](2026-11-26-scg-new-design.md).

**Architecture:** Small pure modules (`casing`, `manifest`, `generators`, `inputs`) with no terminal access, a `Prompter` interface as the only interactive boundary, and the CLI wiring them together. `Scaffold.from` gains `when` and `{{var:modifier}}`. Every module is tested in isolation; the CLI is tested through `runCli` with a fake prompter.

**Tech Stack:** TypeScript (strict), Vitest, tsup (ESM + CJS), EJS/Handlebars/Pug, `@clack/prompts` 1.x, `node:util` `styleText`.

**Commands:** `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (all from the repo root).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/casing.ts` | create | `splitWords`, `camel`, `pascal`, `kebab`, `snake`, `constant`, `title`, `lower`, `upper`, `plural`; `Casing` object; `CASE_MODIFIERS` |
| `src/manifest.ts` | create | `PromptDefinition`, `GeneratorManifest` types; `loadManifest(path)`; `validateManifest(raw, source)` |
| `src/generators.ts` | create | `packageRoot()`, `listGenerators(cwd)`, `resolveGenerator(name, cwd)`, `suggest(name, names)` |
| `src/inputs.ts` | create | `resolveInputs(manifest, provided, options)`; `coerce(prompt, raw)`; `MissingInputError` |
| `src/prompter.ts` | create | `Prompter` interface, `createClackPrompter()`, `PromptCancelledError` |
| `src/output.ts` | create | `formatResult(result, cwd, color)` lines with `✔ created` / `= unchanged` / `! skipped` |
| `src/scaffold.ts` | modify | `when`, `{{var:mod}}`, inject `h` helpers; `loadManifest` delegates to `manifest.ts` |
| `src/handlebars_helper.ts` | modify | register casing helpers once |
| `src/cli_runner.ts` | modify | `new`, `list`, `init <name>`; use `formatResult`; injectable prompter + TTY flag |
| `src/index.ts` | modify | export `Casing`, `Generators`, `resolveInputs`, types |
| `templates/*/scaffold.json`, `templates/*/*.ejs` | modify | `name`, `description`, `prompts`, casing, `withTest` |
| `test/casing.test.ts`, `test/manifest.test.ts`, `test/generators.test.ts`, `test/inputs.test.ts`, `test/scaffold-new.test.ts`, `test/cli-new.test.ts` | create | tests per module |
| `README.md`, `CHANGELOG.md` | modify | document `scg new`, `list`, `init`, manifest format |

---

### Task 1: Casing helpers

**Files:** create `src/casing.ts`, `test/casing.test.ts`

- [ ] Write table-driven tests:
  - `splitWords('userProfile')` → `['user','profile']`; `'UserProfile'`, `'user-profile'`, `'user_profile'`, `'user profile'`, `'  User  Profile '` → same; `'HTTPServer'` → `['http','server']`; `'getHTTPResponse2'` → `['get','http','response2']`; `''` → `[]`.
  - `pascal('user-profile')` = `UserProfile`; `camel` = `userProfile`; `kebab('UserProfile')` = `user-profile`; `snake` = `user_profile`; `constant` = `USER_PROFILE`; `title` = `User Profile`; `lower('AbC')` = `abc`; `upper` = `ABC`.
  - `plural`: `category`→`categories`, `day`→`days`, `box`→`boxes`, `bus`→`buses`, `match`→`matches`, `dish`→`dishes`, `buzz`→`buzzes`, `user`→`users`, `UserProfile`→`UserProfiles`, `Category`→`Categories`, `''`→`''`.
  - `CASE_MODIFIERS` contains exactly the nine names.
- [ ] Run `pnpm vitest run test/casing.test.ts` → FAIL (module missing).
- [ ] Implement: split on `[^A-Za-z0-9]+`, then on `([a-z0-9])([A-Z])` and `([A-Z]+)([A-Z][a-z])` boundaries, lower-case words. `plural` operates on the last character(s) of the raw string and preserves case (`Y`→`IES` only if the input is all upper).
- [ ] Run → PASS. Commit `feat(casing): add case conversion helpers`.

### Task 2: Manifest loading and validation

**Files:** create `src/manifest.ts`, `test/manifest.test.ts`

Types:

```ts
export type PromptType = 'text' | 'confirm' | 'select' | 'multiselect' | 'number';
export interface PromptDefinition {
  name: string; type: PromptType; message?: string; default?: unknown;
  choices?: string[]; required?: boolean; positional?: boolean;
  pattern?: string; description?: string;
}
export interface GeneratorManifest extends ScaffoldOptions {
  name?: string; description?: string; prompts?: PromptDefinition[];
}
export const RESERVED_FLAGS = ['yes', 'dry-run', 'force', 'vars', 'manifest'];
export function validateManifest(raw: unknown, source: string): GeneratorManifest; // throws ManifestError listing all problems
export function loadManifest(manifestPath: string): GeneratorManifest; // JSON + validate + templateDir relative to manifest
```

- [ ] Tests: valid full manifest passes; legacy manifest (only `variables`) passes; errors, all collected in one message with JSON paths: missing `engine`/`structure`; `prompts[0].name` not an identifier; unknown `type`; `select` without `choices`; `pattern` on non-text; invalid regex; two `positional`; duplicate prompt names; reserved name `force`; `structure[1].when` naming an unknown variable (known = prompt names ∪ `variables` keys); `{{name:shout}}` unknown modifier in `outputDir` or `output`; `templateDir` resolved relative to the manifest.
- [ ] Run → FAIL. Implement. `ScaffoldFile` gains `when?: string` (in `scaffold.ts`).
- [ ] Run → PASS. Commit `feat(manifest): validate generator manifests with typed prompts`.

### Task 3: Scaffold `when`, path modifiers and template helpers

**Files:** modify `src/scaffold.ts`, `src/handlebars_helper.ts`; create `test/scaffold-new.test.ts`

- [ ] Tests: `when: 'withTest'` skips the file when `withTest` is false and writes it when true; `'!withTest'` inverse; `outputDir: 'out/{{name:kebab}}'` + `output: '{{name:pascal}}.tsx'` with `name: 'user profile'` → `out/user-profile/UserProfile.tsx`; unknown modifier throws; modifier output still passes the `..`/absolute checks; EJS template `<%= h.pascal(name) %>` renders; Pug `p= h.kebab(name)`; Handlebars `{{constant name}}`; user variable `h` wins over helpers.
- [ ] Run → FAIL. Implement: path regex `/\{\{\s*([A-Za-z_$][\w$]*)(?::([a-z]+))?\s*\}\}/g`; data passed to engines is `{ h: Casing, ...variables }`; Handlebars helpers registered at module load with `Handlebars.registerHelper(name, (v) => fn(String(v ?? '')))`.
- [ ] Run → PASS (plus the existing 103). Commit `feat(scaffold): conditional files, path case modifiers and template helpers`.

### Task 4: Generator lookup

**Files:** create `src/generators.ts`, `test/generators.test.ts`

```ts
export interface GeneratorInfo { name: string; description?: string; source: 'project' | 'built-in'; manifestPath: string; overridden?: boolean }
export function packageRoot(): string;
export function listGenerators(cwd: string): GeneratorInfo[];   // project first, sorted by name; built-ins shadowed by project get overridden: true
export function resolveGenerator(name: string, cwd: string): GeneratorInfo; // throws with list + "Did you mean"
export function suggest(name: string, candidates: string[]): string | undefined; // Levenshtein ≤ 3
```

- [ ] Tests: from an empty tmp dir, `listGenerators` returns the 4 built-ins; a `.scg/react-component/scaffold.json` in tmp shadows the built-in (`resolveGenerator` returns `source: 'project'`, list marks the built-in `overridden`); folders without `scaffold.json` are ignored; `resolveGenerator('react-compnent')` error contains `Did you mean "react-component"?` and the list; `suggest('xyz', [...])` → undefined.
- [ ] Implement `packageRoot()` by walking up from `fileURLToPath(import.meta.url)` until a `package.json` with `"name": "@tiveor/scg"`; enable `shims: true` in `tsup.config.ts` so `import.meta.url` works in the CJS build.
- [ ] Run → PASS. Commit `feat(generators): find project and built-in generators by name`.

### Task 5: Prompter and input resolution

**Files:** create `src/prompter.ts`, `src/inputs.ts`, `test/inputs.test.ts`; `pnpm add @clack/prompts`

```ts
// prompter.ts
export interface Prompter {
  text(o: { message: string; initialValue?: string; validate?: (v: string) => string | undefined }): Promise<string>;
  confirm(o: { message: string; initialValue?: boolean }): Promise<boolean>;
  select(o: { message: string; options: string[]; initialValue?: string }): Promise<string>;
  multiselect(o: { message: string; options: string[]; initialValues?: string[] }): Promise<string[]>;
}
export class PromptCancelledError extends Error {}
export function createClackPrompter(): Prompter; // throws PromptCancelledError on isCancel

// inputs.ts
export interface ResolveOptions { positional?: string; interactive: boolean; prompter?: Prompter; generatorName: string }
export class MissingInputError extends Error { missing: PromptDefinition[] }
export function coerce(prompt: PromptDefinition, raw: unknown): unknown; // throws with flag/value/accepted
export async function resolveInputs(m: GeneratorManifest, provided: Record<string, unknown>, o: ResolveOptions): Promise<Record<string, unknown>>;
```

- [ ] Tests (fake prompter records calls and returns scripted answers): flag beats positional beats prompt beats default; positional fills the `positional` prompt; non-interactive with missing required → `MissingInputError` whose message lists `--name=<text>   Component name` for every missing input; interactive asks only missing ones; `confirm` coercion table (`yes`→true, `0`→false, `maybe`→error); `number` (`'3'`→3, `'x'`→error); `select` outside choices → error listing choices; `multiselect` `'a,b'`→`['a','b']`, JSON array accepted; `pattern` mismatch → error; optional confirm → false, optional multiselect → []; legacy `variables` act as defaults and pass through; unknown provided keys pass through; `PromptCancelledError` propagates.
- [ ] Run → FAIL. Implement. `number` prompts use `prompter.text` with numeric validation.
- [ ] Run → PASS. Commit `feat(inputs): resolve generator inputs from flags, prompts and defaults`.

### Task 6: Output formatting

**Files:** create `src/output.ts`; tests in `test/cli-new.test.ts` (Task 7) cover it through the CLI, plus unit tests in `test/output.test.ts`

- [ ] Tests: `formatResult({files:[a], unchanged:[b], skipped:[c], dryRun:false}, cwd, false)` → `['✔ created    a', '= unchanged  b', '! skipped    c  (local changes, use --force)']` with paths relative to cwd; dry run uses `would create`; with `color: true`, lines contain ANSI codes.
- [ ] Implement with `styleText` from `node:util`; color only when the caller passes `color: true` (CLI decides from `process.stdout.isTTY` and `NO_COLOR`).
- [ ] Commit `feat(cli): readable per-file output`.

### Task 7: CLI commands `new`, `list`, `init`

**Files:** modify `src/cli_runner.ts`, `src/cli.ts`; create `test/cli-new.test.ts`

`runCli(args, io, env?)` where `env = { interactive: boolean; prompter?: Prompter; color: boolean }`; `cli.ts` passes `interactive: process.stdin.isTTY && process.stdout.isTTY`, the clack prompter and `color`.

Flag parsing for `new`: positional args are the non-flag args after `new` (`[generator, value]`); `--key=value` flags (except reserved) become provided values; `--key` without value means `true`; `--vars` merges as today.

- [ ] Tests: `new react-component Button --yes` from an empty dir creates `src/components/Button/Button.tsx` and the test file; `--withTest=false` omits the test; non-interactive without name → exit 1 and the missing-input message; fake prompter answers create files; `new` without generator in non-interactive → exit 1 listing generators; `new nope` → suggestion; `list` prints project + built-in with descriptions; `init widget` creates `.scg/widget/scaffold.json` + template, and `new widget Foo --yes` then works; `init widget` twice → exit 1; Ctrl+C (prompter throws `PromptCancelledError`) → exit 130 and no files; `generate` output uses the new format.
- [ ] Implement and update help text.
- [ ] Commit `feat(cli): add scg new, scg list and scg init <name>`.

### Task 8: Built-in packs

**Files:** `templates/react-component/*`, `templates/vue-component/*`, `templates/express-route/*`, `templates/github-action/*`

- [ ] Add `name`, `description`, `prompts`; replace raw `{{name}}` in paths with `{{name:pascal}}` (React/Vue) or `{{name:kebab}}` (Express folder) as appropriate; templates use `h.pascal(name)`, `h.camel(name)`, `h.kebab(name)`, `h.plural(...)`; React and Vue get `withTest` (confirm, default true) with `when`.
- [ ] Extend the existing "every bundled pack resolves its templates" test to validate each manifest with `validateManifest` and to run each pack with `--yes` (plus required values) into a tmp dir.
- [ ] Commit `feat(templates): typed prompts and casing in built-in packs`.

### Task 9: Exports, docs, verification

- [ ] `src/index.ts`: export `Casing`, `CASE_MODIFIERS`, `listGenerators`, `resolveGenerator`, `resolveInputs`, `loadManifest`, `validateManifest`, types.
- [ ] README: new Quick Start (`npx @tiveor/scg new react-component Button`), "Your own generators" (`scg init`, `.scg/`), manifest reference, casing table, non-interactive usage. CHANGELOG `[Unreleased]`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [ ] Tarball check: `pnpm pack` → install in an empty folder → `npx scg new react-component Button --yes` and `npx scg list`.
- [ ] Commit `docs: document scg new, list and init`.
