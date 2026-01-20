import { promises as fs } from "node:fs";
import { env } from "@/lib/env";
import { getAppSettings } from "@/lib/app-settings";

export type MtgjsonStatus = {
  dbPath: string;
  dbExists: boolean;
  dbSize: number | null;
  metaBuildDate: string | null;
  metaVersion: string | null;
  appBuildDate: string | null;
  appVersion: string | null;
  importStatus: string | null;
  lastImportAt: string | null;
  searchIndexUpdatedAt: string | null;
};

export async function getMtgjsonStatus(): Promise<MtgjsonStatus> {
  let dbExists = false;
  let dbSize: number | null = null;

  try {
    const stats = await fs.stat(env.MTGJSON_DB_PATH);
    dbExists = true;
    dbSize = stats.size;
  } catch {
    dbExists = false;
  }

  let metaBuildDate: string | null = null;
  let metaVersion: string | null = null;

  try {
    const metaRaw = await fs.readFile(`${env.MTGJSON_DIR}/Meta.json`, "utf-8");
    const meta = JSON.parse(metaRaw) as Record<string, unknown>;
    metaBuildDate =
      (meta.date as string | undefined) ??
      (meta.data as { date?: string } | undefined)?.date ??
      null;
    metaVersion =
      (meta.version as string | undefined) ??
      (meta.data as { version?: string } | undefined)?.version ??
      null;
  } catch {
    metaBuildDate = null;
    metaVersion = null;
  }

  const settings = await getAppSettings();

  return {
    dbPath: env.MTGJSON_DB_PATH,
    dbExists,
    dbSize,
    metaBuildDate,
    metaVersion,
    appBuildDate: settings?.mtgjsonBuildDate ?? null,
    appVersion: settings?.mtgjsonVersion ?? null,
    importStatus: settings?.importStatus ?? null,
    lastImportAt: settings?.lastImportAt
      ? settings.lastImportAt.toISOString()
      : null,
    searchIndexUpdatedAt: settings?.searchIndexUpdatedAt
      ? settings.searchIndexUpdatedAt.toISOString()
      : null,
  };
}
