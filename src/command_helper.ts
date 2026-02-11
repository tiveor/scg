import { exec } from 'child_process';

const FORBIDDEN_PATTERNS = [
  /[;&|`$]/, // shell metacharacters
  /\$\(/, // command substitution
  />\s*\//, // redirect to absolute path
  /\.\.\// // path traversal
];

export class CommandHelper {
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

  static runClean(folder: string, ...command: string[]): Promise<string> {
    return CommandHelper.run(folder, ...command).then((result) => {
      return result ? result.replace(/\r?\n|\r/g, '') : '';
    });
  }
}
