import { NextResponse } from "next/server";
import { getAllPrintingsForCanonicalKey, getCanonicalKeyForUuid } from "@/lib/mtgjson/canonical";
import { getCardByUuid, getPrintingsByUuids } from "@/lib/mtgjson/queries/cards";

type RouteContext = {
  params: { uuid: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const { uuid } = await context.params;

  try {
    const card = getCardByUuid(uuid);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const canonicalKey = getCanonicalKeyForUuid(uuid);
    const printings =
      canonicalKey && canonicalKey.length
        ? getAllPrintingsForCanonicalKey(canonicalKey)
        : [];
    const printingDetails = getPrintingsByUuids(
      printings.map((printing) => printing.uuid),
    );

    return NextResponse.json({
      card,
      canonicalKey,
      printings: printingDetails,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "MTGJSON database unavailable", details: String(error) },
      { status: 503 },
    );
  }
}
