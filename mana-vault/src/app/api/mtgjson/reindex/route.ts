import { NextResponse } from "next/server";
import { runBackgroundCommand } from "@/lib/mtgjson/runner";

export async function POST() {
  const result = runBackgroundCommand("pnpm", ["mtgjson:reindex"], "reindex");
  return NextResponse.json(result, { status: 202 });
}
