# `scg mcp`: generators as MCP tools

Date: 2026-11-26. Status: implemented in `feat/scg-mcp`.

## Goal

An AI agent (Claude Code, Cursor, any MCP client) can list the project's
generators and run them, instead of writing boilerplate by hand. The output is
the same as `scg new`, so code written by people and by agents looks the same.

```bash
claude mcp add scg -- npx -y @tiveor/scg mcp
```

## Behavior

- `scg mcp` starts an MCP server over stdio (newline-delimited JSON-RPC 2.0). It
  only writes protocol messages to stdout; diagnostics go to stderr.
- The working directory is the project: generators come from `.scg/` there, plus
  the built-in packs (the same list as `scg list`, overridden built-ins
  excluded). Paths in manifests resolve against it, as in the CLI.
- The list is read on every `tools/list`, so a generator created during the
  session (`scg init`) shows up on the next listing.

### One tool per generator

- Name: `generate_<generator>`, with characters outside `[A-Za-z0-9_-]` replaced
  by `_`. Generators whose tool name would exceed 64 characters, or collide with
  an earlier one, are skipped with a warning on stderr.
- Description: the manifest description, then the files it creates (the
  `outputDir` + `output` patterns, with `when` conditions), so the agent knows
  where files will land before calling it.
- `inputSchema` (JSON Schema) derived from the prompts:

  | Prompt        | Schema                                        |
  | ------------- | --------------------------------------------- |
  | `text`        | `string` (+ `pattern`)                        |
  | `number`      | `number`                                      |
  | `confirm`     | `boolean`                                     |
  | `select`      | `string` with `enum`                          |
  | `multiselect` | `array` of `string` with `enum`, unique items |

  `description` comes from the prompt's `description` or `message`; `default` is
  copied. A prompt is `required` in the schema when it is required and has no
  default (prompt default or legacy `variables`). Legacy `variables` that are
  not prompts become optional properties typed from their value. Two extra
  properties, which cannot clash with prompt names because they are reserved
  flags: `dry-run` (preview without writing) and `force` (overwrite files with
  local changes).

### Calling a tool

- Inputs are resolved exactly like `scg new --yes`: never interactive, defaults
  applied, values converted and validated with the same messages.
- Success: a text block with the per-file lines (`✔ created …`, `= unchanged`,
  `! skipped … (local changes, use --force)`), paths relative to the project,
  and `structuredContent` `{ files, unchanged, skipped, dryRun }`.
- Missing or invalid input, invalid manifest, template error: a tool result with
  `isError: true` and the same message as the CLI, so the agent can fix the call
  and retry. Nothing is written in that case (Scaffold renders everything before
  writing).
- Unknown tool name: JSON-RPC error `-32602`.

### Protocol

- `initialize`: answers with the client's `protocolVersion` when supported
  (`2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`), otherwise the
  latest. Capabilities: `tools` only. `instructions` tell the agent to prefer
  these tools over writing the files by hand.
- `ping`, `tools/list`, `tools/call`. Notifications get no response. Unknown
  methods get `-32601`, malformed JSON `-32700`.

## Why no SDK

The server needs four methods. Writing them directly adds no dependencies,
avoids pulling `zod` and an HTTP stack into every install, and keeps the protocol code small enough to test fully. If
we later need resources, prompts or HTTP transport, switch to the official SDK
behind the same `scg mcp` command.

## Out of scope

- `scg agents` (writing usage notes into `AGENTS.md` / `CLAUDE.md`).
- HTTP transport, resources, prompts, `listChanged` notifications.
