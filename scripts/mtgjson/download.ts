import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  MTGJSON_ARCHIVE_PATH,
  MTGJSON_BASE_URL,
  MTGJSON_DIR,
  MTGJSON_META_PATH,
  ensureDir,
} from "./utils";

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  await pipeline(response.body, createWriteStream(destination));
}

async function main() {
  await ensureDir(MTGJSON_DIR);

  console.log("Downloading MTGJSON Meta.json...");
  await downloadFile(`${MTGJSON_BASE_URL}/Meta.json`, MTGJSON_META_PATH);

  console.log("Downloading MTGJSON AllPrintings.sqlite.xz...");
  await downloadFile(
    `${MTGJSON_BASE_URL}/AllPrintings.sqlite.xz`,
    MTGJSON_ARCHIVE_PATH,
  );

  console.log("Download complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
