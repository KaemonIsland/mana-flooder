import { NextResponse } from "next/server";
import { getSetSummaries } from "@/lib/mtgjson/queries/sets";

export async function GET() {
  try {
    const sets = getSetSummaries();
    return NextResponse.json({ sets });
  } catch (error) {
    return NextResponse.json(
      { error: "MTGJSON database unavailable", details: String(error) },
      { status: 503 },
    );
  }
}
