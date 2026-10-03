"use client";
import { useEffect, useState } from "react";

export default function EmailPage() {
  const [f, setF] = useState<any>({
    enabled: false,
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromName: "EnerScope",
    recipients: "",
    subjectTag: "Tender Digest",
    notifyEmpty: false,
    emailTime: "17:30",
  });
  const [sched, setSched] = useState({ runIntervalMinutes: 360 });
  const [msg, setMsg] = useState("");
  const [smtpOwner, setSmtpOwner] = useState("");
  const [credentialsSource, setCredentialsSource] = useState<"user" | "legacy" | "none">("none");
  const [savedSender, setSavedSender] = useState("");

  useEffect(() => {
    fetch("/api/settings?key=email")
      .then((r) => r.json())
      .then((d) => {
        setSmtpOwner(d.value?.smtpOwner || "");
        setCredentialsSource(d.value?.credentialsSource || "none");
        setSavedSender(d.value?.user || "");
        setF((p: any) => ({
          ...p,
          ...d.value,
          recipients: (d.value.recipients || []).join(", "),
          pass: d.value.pass || "",
        }));
      });
    fetch("/api/settings?key=schedule")
      .then((r) => r.json())
      .then((d) => {
        setF((p: any) => ({ ...p, emailTime: d.value.emailTime, enabled: d.value.emailEnabled }));
        setSched({ runIntervalMinutes: d.value.runIntervalMinutes });
      });
  }, []);

  async function save() {
    setMsg("Saving…");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "email",
        value: {
          ...f,
          recipients: f.recipients
            .split(",")
            .map((x: string) => x.trim())
            .filter(Boolean),
        },
      }),
    });
    const emailSave = await res.json();
    if (!emailSave.ok) {
      setMsg(`FAILED — ${emailSave.error || "could not save email settings"}`);
      return;
    }

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "schedule",
        value: {
          runIntervalMinutes: Number(sched.runIntervalMinutes),
          emailTime: f.emailTime,
          emailEnabled: f.enabled,
        },
      }),
    });

    setSmtpOwner(emailSave.savedFor || smtpOwner);
    setCredentialsSource(emailSave.smtp?.source || "user");
    setSavedSender(emailSave.smtp?.senderEmail || "");
    setF((p: any) => ({ ...p, pass: "••••••", user: emailSave.smtp?.senderEmail || f.user }));
    setMsg(
      `Saved for ${emailSave.savedFor}. Mail will send FROM ${emailSave.smtp?.senderEmail}. Re-enter the app password whenever you change the sender email.`,
    );
  }

  async function test(withExcel = false) {
    if (f.user.trim().toLowerCase() !== savedSender.trim().toLowerCase() || credentialsSource !== "user") {
      setMsg("Save first. Tests use only credentials stored on your user in MongoDB — unsaved form changes are ignored.");
      return;
    }
    setMsg(withExcel ? "Sending digest with Excel…" : "Sending test email…");
    const d = await (
      await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withExcel }),
      })
    ).json();
    setMsg(d.ok ? d.status : `FAILED — ${d.error || "check settings"}`);
  }

  return (
    <div className="section">
      <h2>Email digest</h2>
      <p className="hint">
        Enter Gmail <b>sender email</b> + 16-char <b>App password</b>, then click <b>Save</b> before testing.
        Credentials are stored on the current user in MongoDB. Changing sender email requires a fresh app password.
      </p>
      <p className="hint">
        SMTP owner: <b>{smtpOwner || "—"}</b>
        {" · "}
        Active sender in DB: <b>{savedSender || "not saved yet"}</b>
        {" · "}
        Source: <b>{credentialsSource}</b>
      </p>
      <div className="grid2">
        <div className="field">
          <label>SMTP host</label>
          <input className="input" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
        </div>
        <div className="field">
          <label>Port</label>
          <input
            className="input"
            type="number"
            value={f.port}
            onChange={(e) => {
              const port = Number(e.target.value);
              setF({ ...f, port, secure: port === 465 });
            }}
          />
        </div>
        <div className="field">
          <label>Sender login ID (your email)</label>
          <input
            className="input"
            value={f.user}
            onChange={(e) => {
              const user = e.target.value;
              // Force re-entry of app password when sender changes
              const senderChanged = user.trim().toLowerCase() !== savedSender.trim().toLowerCase();
              setF({ ...f, user, pass: senderChanged ? "" : f.pass });
            }}
          />
        </div>
        <div className="field">
          <label>Sender password / app password</label>
          <input
            className="input"
            type="password"
            placeholder="leave blank to keep saved"
            value={f.pass}
            onChange={(e) => setF({ ...f, pass: e.target.value })}
          />
        </div>
        <div className="field">
          <label>From name</label>
          <input className="input" value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} />
        </div>
        <div className="field">
          <label>Subject tag</label>
          <input className="input" value={f.subjectTag} onChange={(e) => setF({ ...f, subjectTag: e.target.value })} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Receivers (comma separated)</label>
          <input className="input" value={f.recipients} onChange={(e) => setF({ ...f, recipients: e.target.value })} />
        </div>
        <div className="field">
          <label>Email send time (HH:MM, once daily)</label>
          <input className="input" value={f.emailTime} onChange={(e) => setF({ ...f, emailTime: e.target.value })} />
        </div>
        <div className="field">
          <label>Scrape interval (minutes)</label>
          <input
            className="input"
            type="number"
            value={sched.runIntervalMinutes}
            onChange={(e) => setSched({ runIntervalMinutes: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Enabled</label>
          <select className="input" value={String(f.enabled)} onChange={(e) => setF({ ...f, enabled: e.target.value === "true" })}>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div className="field">
          <label>Email even when no new tenders</label>
          <select
            className="input"
            value={String(f.notifyEmpty)}
            onChange={(e) => setF({ ...f, notifyEmpty: e.target.value === "true" })}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
      <p className="hint">
        At the send time, recipients get an email listing today&apos;s tenders plus an attached Excel with{" "}
        <b>Todays Tenders</b> and <b>Earlier Tenders</b> sheets.
      </p>
      {msg && <p className="hint">{msg}</p>}
      <div className="toolbar" style={{ marginTop: 14 }}>
        <button className="btn btn-dark" onClick={() => test(false)}>
          Send test email
        </button>
        <button className="btn btn-dark" onClick={() => test(true)}>
          Send digest + Excel now
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
