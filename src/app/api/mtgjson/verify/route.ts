import { NextResponse } from "next/server";
import { getMtgjsonDb } from "@/lib/mtgjson/db";

export async function POST() {
  try {
    const db = getMtgjsonDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cards', 'sets')",
      )
      .all();
    const cardCount = db
      .prepare("SELECT COUNT(*) as count FROM cards")
      .get() as { count?: number };

    return NextResponse.json({
      ok: tables.length >= 2,
      tables: tables.map((row) => row.name),
      cardCount: cardCount.count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 503 },
    );
  }
}
