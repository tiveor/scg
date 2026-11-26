import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';

/** Configuration options for the file watcher. */
export interface WatcherOptions {
  /** Directory containing template files to watch. */
  templateDir: string;
  /** Directory where rendered output files are written. */
  outputDir: string;
  /** Template engine to use for rendering (e.g., `'EJS'`, `'HANDLEBARS'`, `'PUG'`). */
  engine: string;
  /** Variables to pass to the template engine during rendering. */
  variables: Record<string, unknown>;
  /** File extensions to watch (defaults to `['.ejs', '.hbs', '.handlebars', '.pug']`). */
  extensions?: string[];
  /**
   * Extension given to output files whose template name has no inner extension
   * (e.g. `page.ejs` → `page.html`). Templates named like `Button.tsx.ejs` keep
   * their inner extension (`Button.tsx`). Defaults to `'.html'`.
   */
  outputExtension?: string;
  /** Callback invoked after a file is successfully rebuilt. */
  onRebuild?: (file: string) => void;
  /** Callback invoked when a rebuild error occurs. */
  onError?: (error: Error, file: string) => void;
}

/**
 * Watches a template directory and automatically re-renders templates when they change.
 *
 * Uses `fs.watch()` with `AbortController` for clean start/stop lifecycle.
 *
 * @example
 * ```typescript
 * const watcher = new Watcher({
 *   templateDir: './templates',
 *   outputDir: './generated',
 *   engine: 'EJS',
 *   variables: { project: 'MyApp' },
 *   onRebuild: (file) => console.log(`Rebuilt: ${file}`),
 *   onError: (err, file) => console.error(`Error in ${file}: ${err.message}`),
 * });
 *
 * watcher.start();
 * // Later: watcher.stop();
 * ```
 */
export class Watcher {
  private options: WatcherOptions;
  private abortController: AbortController | null = null;

  /**
   * Creates a new Watcher instance.
   *
   * @param options - Watcher configuration
   */
  constructor(options: WatcherOptions) {
    this.options = {
      ...options,
      extensions: options.extensions ?? ['.ejs', '.hbs', '.handlebars', '.pug'],
      outputExtension: options.outputExtension ?? '.html'
    };
  }

  /**
   * Starts watching the template directory for changes.
   * Does nothing if the watcher is already running.
   */
  start(): void {
    if (this.abortController) {
      return;
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    try {
      const watcher = fs.watch(this.options.templateDir, {
        recursive: true,
        signal
      });

      watcher.on('change', (_eventType, filename) => {
        if (!filename) return;
        const filePath = path.join(
          this.options.templateDir,
          filename.toString()
        );
        void this.rebuild(filePath);
      });

      watcher.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ABORT_ERR') {
          this.options.onError?.(err, '');
        }
      });
    } catch {
      // fs.watch not available
    }
  }

  /**
   * Stops watching for changes and cleans up resources.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Whether the watcher is currently active.
   */
  get isRunning(): boolean {
    return this.abortController !== null;
  }

  /**
   * Renders a single template from the watched directory to the output directory.
   * Called automatically on changes; can also be called directly to build on demand.
   * Files with an unwatched extension, or that no longer exist, are ignored.
   * Errors are reported through `onError` instead of being thrown.
   *
   * @param filePath - Path to the template file (inside `templateDir`)
   * @returns A promise resolving to the written output path, or `null` if nothing was written
   */
  async rebuild(filePath: string): Promise<string | null> {
    const ext = path.extname(filePath);
    if (!this.options.extensions!.includes(ext.toLowerCase())) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const builder = new TemplateBuilder(this.options.engine);
      const content = await builder.renderFile(
        filePath,
        this.options.variables,
        {}
      );

      const relativePath = path.relative(this.options.templateDir, filePath);
      // Strip only the trailing template extension (not its first occurrence)
      const withoutTemplateExt = relativePath.slice(0, -ext.length);
      const outputName = path.extname(withoutTemplateExt)
        ? withoutTemplateExt
        : withoutTemplateExt + this.options.outputExtension;
      const outputPath = path.join(this.options.outputDir, outputName);

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, content, 'utf8');
      this.options.onRebuild?.(outputPath);
      return outputPath;
    } catch (error) {
      this.options.onError?.(error as Error, filePath);
      return null;
    }
  }
}
