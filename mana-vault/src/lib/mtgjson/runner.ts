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
