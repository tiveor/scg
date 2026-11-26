/**
 * SCG - Simple Code Generator
 *
 * A utility library for code generation and template processing in Node.js.
 * Provides helpers for template rendering (EJS, Handlebars, Pug), string manipulation,
 * file operations, command execution, CLI parameter parsing, a scaffold engine,
 * a template pipeline, and a file watcher.
 *
 * @packageDocumentation
 */

export { StringHelper } from './string_helper.js';
export { FileHelper } from './file_helper.js';
export type { Replacement, CreateFileOptions, CreateStringOptions } from './file_helper.js';
export { CommandHelper } from './command_helper.js';
export { ParamHelper } from './param_helper.js';
export { TemplateBuilder } from './template_builder.js';
export type { TemplateEngine } from './template_builder.js';
export { TEMPLATE_HANDLERS } from './template_handlers.js';
export type { TemplateHandler } from './template_handlers.js';
export { Pipeline } from './pipeline.js';
export type { TransformFn } from './pipeline.js';
export { Scaffold } from './scaffold.js';
export type { ScaffoldFile, ScaffoldOptions, ScaffoldResult } from './scaffold.js';
export { Watcher } from './watcher.js';
export type { WatcherOptions } from './watcher.js';
export { Casing, CASE_MODIFIERS, splitWords } from './casing.js';
export type { CaseModifier } from './casing.js';
export {
  loadManifest,
  validateManifest,
  ManifestError,
  RESERVED_FLAGS
} from './manifest.js';
export type {
  GeneratorManifest,
  PromptDefinition,
  PromptType
} from './manifest.js';
export {
  listGenerators,
  resolveGenerator,
  PROJECT_GENERATORS_DIR
} from './generators.js';
export type { GeneratorInfo } from './generators.js';
export { resolveInputs, coerce, MissingInputError } from './inputs.js';
export type { ResolveOptions } from './inputs.js';
export { PromptCancelledError } from './prompter.js';
export type { Prompter } from './prompter.js';
