import { NextResponse } from "next/server";
import {
  getSettings,
  saveSettings,
  getEmailSettingsForUser,
  clearLegacyAppSmtp,
  PASSWORD_MASK,
} from "@/lib/settings";
import { encrypt } from "@/lib/crypto";
import { getCurrentSession } from "@/lib/auth";
import { User } from "@/lib/models";
import { dbConnect } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  const s = await getSettings();
  const session = await getCurrentSession();

  if (key === "email") {
    const email = session?.email
      ? await getEmailSettingsForUser(session.email)
      : { ...s.email, credentialsSource: "none" as const };
    return NextResponse.json({
      ok: true,
      value: {
        ...email,
        pass: email.pass ? PASSWORD_MASK : "",
        smtpOwner: session?.email || "",
        credentialsSource: email.credentialsSource,
      },
    });
  }
  if (key === "excel") return NextResponse.json({ ok: true, value: s.excel });
  if (key === "schedule") {
    return NextResponse.json({
      ok: true,
      value: {
        runIntervalMinutes: s.runIntervalMinutes,
        emailTime: s.email.emailTime,
        emailEnabled: s.email.enabled,
      },
    });
  }
  return NextResponse.json({ ok: false, error: "key must be email|excel|schedule" }, { status: 400 });
}

export async function PUT(req: Request) {
  const { key, value } = await req.json();
  const s = await getSettings();
  const session = await getCurrentSession();
  if (!session?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (key === "email") {
    await dbConnect();
    const userDoc = await User.collection.findOne(
      { email: session.email.toLowerCase() },
      { projection: { email: 1, smtp: 1 } },
    );
    if (!userDoc) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const senderEmail = String(value.user || "").trim().toLowerCase();
    const incomingPass = String(value.pass || "");
    const prevSender = String(userDoc.smtp?.senderEmail || "").toLowerCase();
    const existingUserPass = userDoc.smtp?.appPassword || "";
    // One-time migration from legacy app settings only if sender is unchanged
    const legacyPass =
      !existingUserPass &&
      s.email.pass &&
      senderEmail &&
      senderEmail === String(s.email.user || "").toLowerCase()
        ? s.email.pass
        : "";

    const senderChanged = Boolean(prevSender && senderEmail && senderEmail !== prevSender);
    const passIsNew = Boolean(incomingPass && incomingPass !== PASSWORD_MASK);

    if (!senderEmail) {
      return NextResponse.json({ ok: false, error: "Sender email is required." }, { status: 400 });
    }
    if (senderChanged && !passIsNew) {
      return NextResponse.json({
        ok: false,
        error: "Sender email changed — enter the app password for the new Gmail account, then Save.",
      }, { status: 400 });
    }

    let appPassword = existingUserPass || legacyPass;
    if (passIsNew) {
      appPassword = encrypt(incomingPass.replace(/\s+/g, ""));
    }
    if (!appPassword) {
      return NextResponse.json({
        ok: false,
        error: "App password is required. Paste the 16-character Gmail app password and Save.",
      }, { status: 400 });
    }

    // Club sender email + app password on the current user document (direct $set avoids stale schema drops)
    const smtp = {
      senderEmail,
      appPassword,
      host: value.host || "smtp.gmail.com",
      port: Number(value.port || 587),
      secure: Boolean(value.secure ?? Number(value.port || 587) === 465),
      fromName: value.fromName || "EnerScope",
      savedAt: new Date(),
    };
    await dbConnect();
    const upd = await User.updateOne(
      { email: session.email.toLowerCase() },
      { $set: { smtp } },
      { upsert: false, strict: false },
    );
    if (upd.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "User not found while saving SMTP." }, { status: 404 });
    }

    // Digest options on app settings; wipe legacy SMTP login so it cannot override
    await saveSettings({
      email: {
        ...s.email,
        enabled: Boolean(value.enabled),
        host: value.host || "smtp.gmail.com",
        port: Number(value.port || 587),
        secure: Boolean(value.secure ?? Number(value.port || 587) === 465),
        fromName: value.fromName || "EnerScope",
        recipients: Array.isArray(value.recipients) ? value.recipients : s.email.recipients,
        subjectTag: value.subjectTag ?? s.email.subjectTag,
        notifyEmpty: Boolean(value.notifyEmpty),
        emailTime: value.emailTime || s.email.emailTime,
        smtpOwner: session.email.toLowerCase(),
        user: "",
        pass: "",
      },
    });
    await clearLegacyAppSmtp();

    // Verify from raw collection so UI cannot lie about save success
    const raw = await User.collection.findOne(
      { email: session.email.toLowerCase() },
      { projection: { smtp: 1 } },
    );
    if (!raw?.smtp?.senderEmail || !raw?.smtp?.appPassword) {
      return NextResponse.json({
        ok: false,
        error: "Save did not persist SMTP on the user document. Restart the server and try Save again.",
      }, { status: 500 });
    }

    const verify = await getEmailSettingsForUser(session.email);
    return NextResponse.json({
      ok: true,
      savedFor: session.email,
      smtp: {
        senderEmail: raw.smtp.senderEmail,
        hasPassword: Boolean(raw.smtp.appPassword),
        source: verify.credentialsSource,
      },
    });
  }

  if (key === "excel") {
    await saveSettings({ excel: { ...s.excel, ...value } });
  } else if (key === "schedule") {
    await saveSettings({
      runIntervalMinutes: value.runIntervalMinutes,
      email: {
        ...s.email,
        emailTime: value.emailTime,
        enabled: value.emailEnabled,
      },
    });
  } else {
    return NextResponse.json({ ok: false, error: "key must be email|excel|schedule" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
