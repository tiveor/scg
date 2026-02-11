# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-02-11

### Added
- JSDoc documentation on all public APIs with `@example` tags
- TypeDoc configuration for generating HTML API reference (`npm run docs`)
- `CHANGELOG.md` with version history
- Predefined template packs: React component, Vue SFC, Express route, GitHub Action
- Expanded `example/` folder with working demos for Pipeline, Scaffold, and Watcher
- GitHub Actions workflow for automated npm publishing on releases
- Additional README badges (CI status, license, Node version)

## [0.4.0] - 2026-02-11

### Added
- **Plugin system** for template engines: `TemplateBuilder.registerEngine()`, `getEngine()`, `getRegisteredEngines()`
- **Pipeline** class with chainable API: `fromString()`, `fromFile()`, `fromTemplate()`, `fromTemplateString()`, `transform()`, `execute()`, `writeTo()`
- **Scaffold** engine for manifest-based directory structure generation with `{{variable}}` path interpolation and `dryRun` support
- **CLI** (`scg`) with commands: `init`, `generate`, `render`, `--help`
- **Watcher** class with `start()`/`stop()`/`isRunning` using `fs.watch()` and `AbortController`
- Async file operations: `readFileAsync()`, `readJsonFileAsync()`, `writeFileAsync()`, `createFolderAsync()`, `removeFolderAsync()`, `removeFileAsync()`, `existsAsync()`
- Auto-detection of template engine from file extension in Pipeline
- 25 new tests (65 total)

## [0.3.0] - 2026-02-11

### Changed
- **Full TypeScript migration** with strict mode (`strict: true`)
- **ESM-first** with dual CJS/ESM build via tsup
- Replaced Mocha with **Vitest** as test runner
- Replaced Travis CI with **GitHub Actions** CI (Node 18, 20, 22)
- Added **ESLint** flat config with `typescript-eslint`
- Package exports with conditional `import`/`require` paths

### Added
- TypeScript type definitions (`.d.ts`, `.d.cts`) generated automatically
- Command sanitization in `CommandHelper` (forbidden shell metacharacters)
- `vitest.config.ts`, `tsconfig.json`, `tsup.config.ts`, `eslint.config.js`

### Removed
- All JavaScript source files (migrated to TypeScript)
- `.travis.yml` (replaced by GitHub Actions)
- Mocha dependency

## [0.2.0] - 2025-01-01

### Fixed
- Critical bug in `TemplateBuilder.render()` for Pug (was passing wrong parameter)
- `.prettierrc` cleaned up (removed VSCode-specific config)

### Added
- 41 tests covering all modules (StringHelper, FileHelper, CommandHelper, ParamHelper, TemplateBuilder)
- Improved error handling: descriptive messages, null/undefined validation
- `CommandHelper.run()` propagates errors via `Promise.reject`

## [0.1.6] - 2024-12-01

### Added
- Exported `TEMPLATE_HANDLERS` enum properly
- Formatted test code

## [0.1.0] - 2024-01-01

### Added
- Initial release
- Template rendering with EJS, Handlebars, and Pug
- `StringHelper` for string manipulation (replace, capitalize, escapeRegex)
- `FileHelper` for file operations (read, write, create/remove folders)
- `CommandHelper` for shell command execution
- `ParamHelper` for CLI parameter parsing
- `TemplateBuilder` as unified template interface

[0.5.0]: https://github.com/tiveor/scg/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/tiveor/scg/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/tiveor/scg/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/tiveor/scg/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/tiveor/scg/compare/v0.1.0...v0.1.6
[0.1.0]: https://github.com/tiveor/scg/releases/tag/v0.1.0
