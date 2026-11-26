import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { Readable, Writable } from 'stream';
import { Scaffold } from './scaffold.js';
import {
  loadManifest,
  type GeneratorManifest,
  type PromptDefinition
} from './manifest.js';
import {
  listGenerators,
  packageRoot,
  type GeneratorInfo
} from './generators.js';
import { resolveInputs } from './inputs.js';
import { formatResult } from './output.js';

/** MCP protocol versions this server can speak, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05'
];

const TOOL_PREFIX = 'generate_';
const MAX_TOOL_NAME = 64;

const INSTRUCTIONS =
  "Each tool runs one of this project's code generators (SCG). When the user asks " +
  'for something a generator creates (a component, a route, a workflow...), call ' +
  'the tool instead of writing those files by hand, then edit the generated files ' +
  'if needed. Use "dry-run": true to preview the files first. Existing files with ' +
  'local changes are never overwritten unless "force" is true.';

/** JSON Schema for a tool's arguments. */
export interface JsonSchema {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  pattern?: string;
  items?: JsonSchema;
  uniqueItems?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

/** An MCP tool that runs a generator. */
export interface GeneratorTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** The generator the tool runs. */
  generator: GeneratorInfo;
}

/** Result of `tools/call`, as defined by MCP. */
export interface CallToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** Converts a generator name to a valid MCP tool name. */
export function toolName(generator: string): string {
  return TOOL_PREFIX + generator.replace(/[^A-Za-z0-9_-]/g, '_');
}

function promptSchema(prompt: PromptDefinition): JsonSchema {
  const schema: JsonSchema = { type: 'string' };
  switch (prompt.type) {
    case 'number':
      schema.type = 'number';
      break;
    case 'confirm':
      schema.type = 'boolean';
      break;
    case 'select':
      schema.enum = prompt.choices;
      break;
    case 'multiselect':
      schema.type = 'array';
      schema.items = { type: 'string', enum: prompt.choices };
      schema.uniqueItems = true;
      break;
    default:
      if (prompt.pattern) schema.pattern = prompt.pattern;
  }
  const description = prompt.description ?? prompt.message;
  if (description) schema.description = description;
  if (prompt.default !== undefined) schema.default = prompt.default;
  return schema;
}

function valueSchema(value: unknown): JsonSchema {
  if (typeof value === 'boolean') return { type: 'boolean', default: value };
  if (typeof value === 'number') return { type: 'number', default: value };
  if (Array.isArray(value))
    return { type: 'array', items: { type: 'string' }, default: value };
  return { type: 'string', default: value };
}

/**
 * Builds the JSON Schema of a generator's arguments from its prompts. Legacy
 * `variables` that are not prompts become optional properties.
 */
export function inputSchema(manifest: GeneratorManifest): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const prompt of manifest.prompts ?? []) {
    properties[prompt.name] = promptSchema(prompt);
    const fallback = prompt.default ?? manifest.variables?.[prompt.name];
    if (prompt.required && fallback === undefined) required.push(prompt.name);
  }
  for (const [key, value] of Object.entries(manifest.variables ?? {})) {
    if (!(key in properties)) properties[key] = valueSchema(value);
  }

  properties['dry-run'] = {
    type: 'boolean',
    description: 'Only list the files that would be written',
    default: false
  };
  properties['force'] = {
    type: 'boolean',
    description: 'Overwrite existing files that have local changes',
    default: false
  };

  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {})
  };
}

/** Describes a generator for an agent: what it is and which files it creates. */
export function toolDescription(
  info: GeneratorInfo,
  manifest: GeneratorManifest
): string {
  const files = manifest.structure.map((file) => {
    const output = path.posix.join(manifest.outputDir, file.output);
    return file.when ? `${output} (when ${file.when})` : output;
  });
  const lines = [
    manifest.description ?? info.description ?? `Run the ${info.name} generator`
  ];
  if (files.length) lines.push('', 'Creates:', ...files.map((f) => `- ${f}`));
  if (files.some((f) => f.includes('{{'))) {
    lines.push(
      '',
      'In paths, {{x}} is the argument x and {{x:pascal}} is x in that casing.'
    );
  }
  return lines.join('\n');
}

/**
 * Lists one tool per generator available in `cwd` (project generators and
 * built-in packs, overridden built-ins excluded).
 *
 * @param cwd - Project folder
 * @param warn - Receives problems that hide a generator (invalid manifest, bad name)
 */
export function generatorTools(
  cwd: string,
  warn: (message: string) => void = () => {}
): GeneratorTool[] {
  const tools: GeneratorTool[] = [];
  const seen = new Set<string>();

  for (const generator of listGenerators(cwd).filter((g) => !g.overridden)) {
    const name = toolName(generator.name);
    if (name.length > MAX_TOOL_NAME || seen.has(name)) {
      warn(
        `Skipping generator "${generator.name}": tool name ${name} is too long or taken`
      );
      continue;
    }
    let manifest: GeneratorManifest;
    try {
      manifest = loadManifest(generator.manifestPath);
    } catch (error) {
      warn(
        `Skipping generator "${generator.name}": ${(error as Error).message}`
      );
      continue;
    }
    seen.add(name);
    tools.push({
      name,
      description: toolDescription(generator, manifest),
      inputSchema: inputSchema(manifest),
      generator
    });
  }
  return tools;
}

/**
 * Runs a generator with the arguments of a tool call, like `scg new --yes`.
 * Problems the agent can fix (missing or invalid input, template errors) are
 * returned as a result with `isError: true` instead of being thrown.
 */
export async function runGeneratorTool(
  tool: GeneratorTool,
  args: Record<string, unknown>,
  cwd: string
): Promise<CallToolResult> {
  try {
    const manifest = loadManifest(tool.generator.manifestPath);
    const { 'dry-run': dryRun, force, ...provided } = args;
    const variables = await resolveInputs(manifest, provided, {
      generatorName: tool.generator.name,
      interactive: false
    });
    const result = await Scaffold.from({
      ...manifest,
      variables,
      dryRun: dryRun === true,
      overwrite: force === true
    });

    const rel = (file: string) => path.relative(cwd, path.resolve(cwd, file));
    const lines = formatResult(result, cwd, false);
    return {
      content: [
        {
          type: 'text',
          text: lines.length ? lines.join('\n') : 'Nothing to generate.'
        }
      ],
      structuredContent: {
        files: result.files.map(rel),
        unchanged: result.unchanged.map(rel),
        skipped: result.skipped.map(rel),
        dryRun: result.dryRun
      }
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: (error as Error).message }],
      isError: true
    };
  }
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      error: { code: number; message: string };
    };

class RpcError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
  }
}

function serverVersion(): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf8')
    );
    return String(pkg.version);
  } catch {
    return '0.0.0';
  }
}

/** Options for {@link createMcpServer}. */
export interface McpServerOptions {
  /** Project folder. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Receives diagnostics. Defaults to stderr (stdout carries the protocol). */
  warn?: (message: string) => void;
}

/**
 * Creates an MCP request handler that exposes the generators as tools.
 * Transport independent: pass each parsed JSON-RPC message to `handle`.
 *
 * @returns `handle(message)`, which resolves to the response, or `undefined` for notifications
 */
export function createMcpServer(options: McpServerOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const warn =
    options.warn ?? ((message: string) => process.stderr.write(`${message}\n`));

  async function dispatch(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      case 'initialize': {
        const requested = String(params.protocolVersion ?? '');
        return {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'scg',
            title: 'SCG code generators',
            version: serverVersion()
          },
          instructions: INSTRUCTIONS
        };
      }
      case 'ping':
        return {};
      case 'tools/list':
        return {
          tools: generatorTools(cwd, warn).map(
            ({ name, description, inputSchema }) => ({
              name,
              description,
              inputSchema
            })
          )
        };
      case 'tools/call': {
        const name = params.name;
        const tool = generatorTools(cwd, warn).find((t) => t.name === name);
        if (!tool) throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
        const args = params.arguments;
        if (
          args !== undefined &&
          (typeof args !== 'object' || args === null || Array.isArray(args))
        ) {
          throw new RpcError(-32602, 'Tool arguments must be an object');
        }
        return runGeneratorTool(
          tool,
          (args ?? {}) as Record<string, unknown>,
          cwd
        );
      }
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
  }

  return {
    async handle(
      message: JsonRpcMessage
    ): Promise<JsonRpcResponse | undefined> {
      const isRequest = message.id !== undefined && message.id !== null;
      if (typeof message.method !== 'string') {
        // Responses from the client (we never send requests) and junk are ignored
        return isRequest
          ? {
              jsonrpc: '2.0',
              id: message.id!,
              error: { code: -32600, message: 'Invalid request' }
            }
          : undefined;
      }
      if (!isRequest) return undefined; // notifications need no answer

      try {
        const result = await dispatch(message.method, message.params ?? {});
        return { jsonrpc: '2.0', id: message.id!, result };
      } catch (error) {
        const code = error instanceof RpcError ? error.code : -32603;
        return {
          jsonrpc: '2.0',
          id: message.id!,
          error: { code, message: (error as Error).message }
        };
      }
    }
  };
}

/**
 * Serves MCP over newline-delimited JSON on the given streams (stdio by
 * default). Resolves when the input ends and every pending response is written.
 */
export async function serveStdio(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
  options: McpServerOptions = {}
): Promise<void> {
  const server = createMcpServer(options);
  const pending: Promise<void>[] = [];
  const send = (response: JsonRpcResponse | undefined) => {
    if (response) output.write(JSON.stringify(response) + '\n');
  };

  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line);
    } catch {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      });
      continue;
    }
    if (
      Array.isArray(message) ||
      typeof message !== 'object' ||
      message === null
    ) {
      send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid request' }
      });
      continue;
    }
    pending.push(server.handle(message).then(send));
  }
  await Promise.all(pending);
}
