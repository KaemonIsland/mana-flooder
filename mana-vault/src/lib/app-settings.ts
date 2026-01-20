import { prisma } from "@/lib/prisma";

export async function getAppSettings() {
  try {
    return await prisma.appSetting.findFirst();
  } catch {
    return null;
  }
}

export async function updateAppSettings(
  data: Partial<{
    mtgjsonBuildDate: string | null;
    mtgjsonVersion: string | null;
    importStatus: string | null;
    lastImportAt: Date | null;
    searchIndexUpdatedAt: Date | null;
    mtgjsonFileSize: number | null;
  }>,
) {
  try {
    return await prisma.appSetting.upsert({
      where: { id: "app" },
      update: data,
      create: {
        id: "app",
        mtgjsonBuildDate: data.mtgjsonBuildDate ?? null,
        mtgjsonVersion: data.mtgjsonVersion ?? null,
        importStatus: data.importStatus ?? null,
        lastImportAt: data.lastImportAt ?? null,
        searchIndexUpdatedAt: data.searchIndexUpdatedAt ?? null,
        mtgjsonFileSize: data.mtgjsonFileSize ?? null,
      },
    });
  } catch {
    return null;
  }
}
