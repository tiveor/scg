const { exec } = require("child_process");

class CommandHelper {
  static run(directory, ...command) {
    return new Promise((ok, reject) => {
      const cmd = command.join(" && ");
      //console.log(cmd);
      exec(
        cmd,
        { cwd: directory, maxBuffer: 1024 * 1024 * 100 },
        (err, stdout, stderr) => {
          if (err) {
            reject(err);
            return;
          }

          if (stderr) {
            ok(stderr);
            return;
          }

          ok(stdout);
        }
      );
    }).catch((error) => {
      console.log(error);
    });
  }

  static runClean(folder, ...command) {
    return new Promise((ok, reject) => {
      CommandHelper.run(folder, ...command)
        .then((cmdRes) => {
          const config = cmdRes && cmdRes.replace(/\r?\n|\r/g, "");
          ok(config);
        })
        .catch(reject);
    });
  }
}

exports.CommandHelper = CommandHelper;
