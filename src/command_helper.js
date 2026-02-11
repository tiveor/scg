const { exec } = require('child_process');

class CommandHelper {
  static run(directory, ...command) {
    if (!directory) {
      return Promise.reject(new Error('directory is required'));
    }
    if (command.length === 0) {
      return Promise.reject(new Error('at least one command is required'));
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

  static runClean(folder, ...command) {
    return CommandHelper.run(folder, ...command).then((result) => {
      return result && result.replace(/\r?\n|\r/g, '');
    });
  }
}

exports.CommandHelper = CommandHelper;
