import { createWriteStream } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { xz } from "@napi-rs/lzma";
import {
  MTGJSON_ARCHIVE_PATH,
  MTGJSON_DB_PATH,
  ensureDir,
  ensureParentDir,
  MTGJSON_DIR,
} from "./utils";

async function decompressWithXzBinary(
  inputPath: string,
  outputPath: string,
) {
  const check = spawnSync("xz", ["--version"], { stdio: "ignore" });
  if (check.status !== 0) return false;

  await ensureParentDir(outputPath);

  const child = spawn("xz", ["-dc", inputPath], {
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (!child.stdout) {
    throw new Error("Failed to spawn xz process.");
  }

  await pipeline(child.stdout, createWriteStream(outputPath));

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`xz exited with code ${code}`));
    });
  });

  return true;
}

async function decompressWithLibrary(
  inputPath: string,
  outputPath: string,
) {
  const buffer = await readFile(inputPath);
  const decompressed = await xz.decompress(buffer);
  await ensureParentDir(outputPath);
  await writeFile(outputPath, decompressed);
}

async function main() {
  await ensureDir(MTGJSON_DIR);
  await access(MTGJSON_ARCHIVE_PATH);

  console.log("Decompressing MTGJSON SQLite...");
  const usedBinary = await decompressWithXzBinary(
    MTGJSON_ARCHIVE_PATH,
    MTGJSON_DB_PATH,
  );

  if (!usedBinary) {
    console.warn(
      "xz binary not available. Falling back to in-memory decompression.",
    );
    await decompressWithLibrary(MTGJSON_ARCHIVE_PATH, MTGJSON_DB_PATH);
  }

  console.log("Decompression complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
