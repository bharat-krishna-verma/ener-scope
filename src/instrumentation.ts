export async function register() {
  // On Vercel, long-lived setInterval schedulers do not run reliably.
  // Use /api/cron/tick + vercel.json crons instead.
  if (process.env.VERCEL) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/tender/runner");
    startScheduler();
  }
}
