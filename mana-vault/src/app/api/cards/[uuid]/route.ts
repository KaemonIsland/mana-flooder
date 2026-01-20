import { NextResponse } from "next/server";
import {
  getCardDetailsByUuid,
  getCardPrintings,
} from "@/lib/mtgjson/queries";

type RouteContext = {
  params: { uuid: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const uuid = context.params.uuid;

  try {
    const card = getCardDetailsByUuid(uuid);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const printings = getCardPrintings(card.oracleId, card.name);
    return NextResponse.json({ card, printings });
  } catch (error) {
    return NextResponse.json(
      { error: "MTGJSON database unavailable", details: String(error) },
      { status: 503 },
    );
  }
}
