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
      extensions: ['.ejs', '.hbs', '.handlebars', '.pug'],
      ...options
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
        this.handleChange(filePath);
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

  private async handleChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.options.extensions!.includes(ext)) {
      return;
    }

    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const builder = new TemplateBuilder(this.options.engine);
      const content = await builder.renderFile(
        filePath,
        this.options.variables,
        {}
      );

      const relativePath = path.relative(this.options.templateDir, filePath);
      const outputName = relativePath.replace(ext, '.html');
      const outputPath = path.join(this.options.outputDir, outputName);

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, content, 'utf8');
      this.options.onRebuild?.(outputPath);
    } catch (error) {
      this.options.onError?.(error as Error, filePath);
    }
  }
}
