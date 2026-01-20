import { getMtgjsonDb } from "@/lib/mtgjson/db";
import { getTableColumns, pickColumn } from "@/lib/mtgjson/schema-introspect";

export type PurchaseUrl = {
  provider: string;
  url: string;
  type: string | null;
};

export function getPurchaseUrlsByUuid(uuid: string): PurchaseUrl[] {
  const columns = getTableColumns("cardPurchaseUrls");
  if (!columns.size || !columns.has("uuid")) return [];

  const providerColumn = pickColumn("cardPurchaseUrls", [
    "provider",
    "store",
    "vendor",
  ]);
  const urlColumn = pickColumn("cardPurchaseUrls", ["url", "link"]);
  if (!providerColumn || !urlColumn) return [];

  const typeColumn = pickColumn("cardPurchaseUrls", ["type", "productType"]);

  const db = getMtgjsonDb();
  const rows = db
    .prepare(
      `
        SELECT
          ${providerColumn} as provider,
          ${urlColumn} as url,
          ${typeColumn ? `${typeColumn} as type` : "NULL as type"}
        FROM cardPurchaseUrls
        WHERE uuid = ?
      `,
    )
    .all(uuid);

  return rows
    .filter((row) => row.provider && row.url)
    .map((row) => ({
      provider: String(row.provider),
      url: String(row.url),
      type: (row.type as string | null) ?? null,
    }));
}
