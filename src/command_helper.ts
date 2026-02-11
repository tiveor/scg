import { exec } from 'child_process';

/** @internal Patterns that indicate potentially unsafe shell commands. */
const FORBIDDEN_PATTERNS = [
  /[;&|`$]/, // shell metacharacters
  /\$\(/, // command substitution
  />\s*\//, // redirect to absolute path
  /\.\.\// // path traversal
];

/**
 * Utility class for executing shell commands as promises with input sanitization.
 *
 * Commands are validated against a set of forbidden patterns (shell metacharacters,
 * command substitution, path traversal) before execution.
 *
 * @example
 * ```typescript
 * const output = await CommandHelper.run('.', 'echo hello');
 * const version = await CommandHelper.runClean('.', 'node --version');
 * ```
 */
export class CommandHelper {
  /**
   * Executes one or more shell commands in the given directory.
   * Multiple commands are joined with `&&` (sequential execution).
   *
   * @param directory - Working directory for command execution
   * @param command - One or more command strings to execute
   * @returns A promise resolving to the command's stdout (or stderr if stdout is empty)
   * @throws If the directory is empty, no commands are provided, or a command matches a forbidden pattern
   *
   * @example
   * ```typescript
   * const output = await CommandHelper.run('.', 'echo hello');
   * // => "hello\n"
   *
   * const result = await CommandHelper.run('.', 'git add .', 'git status');
   * ```
   */
  static run(directory: string, ...command: string[]): Promise<string> {
    if (!directory) {
      return Promise.reject(new Error('directory is required'));
    }
    if (command.length === 0) {
      return Promise.reject(new Error('at least one command is required'));
    }

    for (const cmd of command) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(cmd)) {
          return Promise.reject(
            new Error(
              `potentially unsafe command rejected: "${cmd}" matches forbidden pattern ${pattern}`
            )
          );
        }
      }
    }

    return new Promise((resolve, reject) => {
      const cmd = command.join(' && ');
      exec(
        cmd,
        { cwd: directory, maxBuffer: 1024 * 1024 * 100 },
        (err, stdout, stderr) => {
          if (err) {
            reject(err);
            return;
          }

          if (stderr) {
            resolve(stderr);
            return;
          }

          resolve(stdout);
        }
      );
    });
  }

  /**
   * Executes commands and returns the output with newlines stripped.
   *
   * @param folder - Working directory for command execution
   * @param command - One or more command strings to execute
   * @returns A promise resolving to the cleaned output (no newlines)
   *
   * @example
   * ```typescript
   * const version = await CommandHelper.runClean('.', 'node --version');
   * // => "v20.10.0"
   * ```
   */
  static runClean(folder: string, ...command: string[]): Promise<string> {
    return CommandHelper.run(folder, ...command).then((result) => {
      return result ? result.replace(/\r?\n|\r/g, '') : '';
    });
  }
}
