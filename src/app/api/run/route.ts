import { NextResponse } from "next/server";
import { executeRun, startScheduler } from "@/lib/tender/runner";

export async function POST(req: Request) {
  const { dryRun } = await req.json().catch(() => ({ dryRun: false }));
  startScheduler(); // idempotent; guarantees the loop is alive
  const result = await executeRun(!!dryRun);
  return NextResponse.json({ ok: true, result });
}
