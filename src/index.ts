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
