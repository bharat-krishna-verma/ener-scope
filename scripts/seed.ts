import { dbConnect } from "../src/lib/mongodb";
import { User, Portal, Setting } from "../src/lib/models";
import { hashPassword } from "../src/lib/auth";
import { encrypt } from "../src/lib/crypto";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

async function main() {
  await dbConnect();
  await User.updateOne(
    { email: "admin@enerscope.io" },
    { $setOnInsert: { email: "admin@enerscope.io", name: "EnerScope Admin", role: "admin", passwordHash: hashPassword("EnerScope@123") } },
    { upsert: true },
  );
  await Setting.updateOne({ key: "app" }, { $setOnInsert: { value: DEFAULT_SETTINGS } }, { upsert: true });

  const SEL0 = { container: "table tbody tr", title: "", link: "a", org: "", published: "", deadline: "", value: "", summary: "" };
  const sites: [string, string, Record<string, string>][] = [
    ["SECI (India)", "https://www.seci.co.in/tenders", { container: "table tbody tr", title: "td:nth-child(5)", link: "td:last-child a", org: "", published: "td:nth-child(6)", deadline: "td:nth-child(7)", value: "", summary: "td:nth-child(4)" }],
    ["NTPC Tenders (India)", "https://ntpctender.ntpc.co.in", { ...SEL0, title: "td:nth-child(3)", published: "td:nth-child(4)", deadline: "td:nth-child(5)", summary: "td:nth-child(2)" }],
    ["IREDA (India)", "https://www.ireda.in/tenders", { container: "table tbody tr, .view-content tr", title: "td:nth-child(2), .views-field-title", link: "a", org: "", published: "td:nth-child(3)", deadline: "td:nth-child(4)", value: "", summary: "" }],
    ["CEB — Ceylon Electricity Board (Sri Lanka)", "https://www.ceb.lk/tender-notice/en", { container: "table tbody tr", title: "td:nth-child(4)", link: "td:last-child a", org: "", published: "td:nth-child(2)", deadline: "td:nth-child(3)", value: "", summary: "td:nth-child(1)" }],
    ["NTNSP — Lanka Transmission (Sri Lanka)", "https://www.ntnsp.lk/procurement/tender-notices", { ...SEL0, title: "td:nth-child(1)", published: "td:nth-child(2)", deadline: "td:nth-child(3)" }],
  ];
  for (const [name, listUrl, selectors] of sites) {
    await Portal.updateOne(
      { name },
      { $setOnInsert: { name, listUrl, enabled: true, selectors: { ...SEL0, ...selectors }, access: { mode: "public", loginUrl: "", user: "", pass: encrypt(""), cookie: encrypt("") } } },
      { upsert: true },
    );
  }
  console.log("Seeded. Login: admin@enerscope.io / EnerScope@123");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
