import { NextResponse } from "next/server";
import { runSequentialCommands } from "@/lib/mtgjson/runner";

export async function POST() {
  const result = runSequentialCommands(
    [
      { command: "pnpm", args: ["mtgjson:download"] },
      { command: "pnpm", args: ["mtgjson:decompress"] },
      { command: "pnpm", args: ["mtgjson:reindex"] },
    ],
    "import",
  );
  return NextResponse.json(result, { status: 202 });
}
