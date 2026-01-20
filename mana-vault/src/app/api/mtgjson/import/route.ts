import { NextResponse } from "next/server";
import { runBackgroundCommand } from "@/lib/mtgjson/runner";

export async function POST() {
  const result = runBackgroundCommand(
    "bash",
    ["-lc", "pnpm mtgjson:download && pnpm mtgjson:decompress"],
    "download",
  );
  return NextResponse.json(result, { status: 202 });
}
