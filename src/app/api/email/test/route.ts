import { NextResponse } from "next/server";
import {
  getSettings,
  getEmailSettingsForSend,
  decryptEmailPass,
} from "@/lib/settings";
import { sendDigestEmail } from "@/lib/tender/mailer";
import { sendDailyDigest } from "@/lib/tender/runner";
import { getCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const withExcel = Boolean(body?.withExcel);
    const session = await getCurrentSession();
    if (!session?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (withExcel) {
      const status = await sendDailyDigest(await getSettings());
      return NextResponse.json({ ok: true, status });
    }

    // Always send with credentials saved on the current user (user.smtp) — never legacy app settings
    const emailCfg = await getEmailSettingsForSend(session.email);
    const pass = decryptEmailPass(emailCfg.pass);
    if (!pass) {
      return NextResponse.json({
        ok: false,
        error: "Saved app password could not be decrypted. Re-enter the app password and Save.",
      });
    }

    const status = await sendDigestEmail(
      { ...emailCfg, pass },
      {
        subject: `Test email | ${emailCfg.subjectTag}`,
        text: `This is a test email from EnerScope.\n\nSent via SMTP as: ${emailCfg.user}`,
      },
    );
    return NextResponse.json({
      ok: true,
      status: `${status} | From: ${emailCfg.user}`,
      from: emailCfg.user,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Failed to send test email" });
  }
}
