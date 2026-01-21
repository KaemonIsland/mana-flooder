import { NextResponse } from "next/server";
import { getMtgjsonStatus } from "@/lib/mtgjson/status";

export async function GET() {
  const status = await getMtgjsonStatus();
  return NextResponse.json({ status });
}
