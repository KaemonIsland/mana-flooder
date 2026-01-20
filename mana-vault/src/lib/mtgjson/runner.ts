import { spawn } from "node:child_process";
import { updateAppSettings } from "@/lib/app-settings";

export function runBackgroundCommand(
  command: string,
  args: string[],
  statusLabel: string,
) {
  void updateAppSettings({ importStatus: `running:${statusLabel}` });

  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });

  child.unref();
  child.on("close", (code) => {
    const status = code === 0 ? "complete" : `failed:${statusLabel}`;
    void updateAppSettings({ importStatus: status });
  });

  return { status: "started" };
}

export function runSequentialCommands(
  commands: Array<{ command: string; args: string[] }>,
  statusLabel: string,
) {
  void updateAppSettings({ importStatus: `running:${statusLabel}` });

  const runNext = (index: number) => {
    const current = commands[index];
    if (!current) {
      void updateAppSettings({ importStatus: "complete" });
      return;
    }

    const child = spawn(current.command, current.args, {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
    });

    child.unref();
    child.on("close", (code) => {
      if (code === 0) {
        runNext(index + 1);
      } else {
        void updateAppSettings({ importStatus: `failed:${statusLabel}` });
      }
    });
  };

  runNext(0);
  return { status: "started" };
}
