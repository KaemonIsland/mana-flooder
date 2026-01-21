import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCanonicalKeyForUuid, getCanonicalPrintingsForKeys } from "@/lib/mtgjson/canonical";
import { resolveCardImage } from "@/lib/mtgjson/images";
import { getIdentifiersByUuids } from "@/lib/mtgjson/queries/identifiers";

export async function GET() {
  const collection = await prisma.collectionCard.findMany({
    where: {
      OR: [{ qty: { gt: 0 } }, { foilQty: { gt: 0 } }],
    },
  });

  const totalsByCanonical = new Map<string, { qty: number; foilQty: number }>();
  const canonicalKeys = new Set<string>();

  collection.forEach((entry) => {
    const canonicalKey = getCanonicalKeyForUuid(entry.cardUuid);
    if (!canonicalKey) return;
    canonicalKeys.add(canonicalKey);
    const existing = totalsByCanonical.get(canonicalKey) ?? { qty: 0, foilQty: 0 };
    totalsByCanonical.set(canonicalKey, {
      qty: existing.qty + entry.qty,
      foilQty: existing.foilQty + entry.foilQty,
    });
  });

  const summaries = getCanonicalPrintingsForKeys(Array.from(canonicalKeys));
  const identifiersMap = getIdentifiersByUuids(
    summaries.map((summary) => summary.representativeUuid),
  );

  const results = summaries
    .map((summary) => {
      const totals = totalsByCanonical.get(summary.canonicalKey) ?? {
        qty: 0,
        foilQty: 0,
      };
      return {
        ...summary,
        qty: totals.qty + totals.foilQty,
        foilQty: totals.foilQty,
        imageUrl: resolveCardImage(
          identifiersMap.get(summary.representativeUuid) ?? null,
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ results });
}
