import mongoose, { Schema, models, model } from "mongoose";

/* ---------------- User ---------------- */
const UserSmtpSchema = new Schema(
  {
    senderEmail: { type: String, default: "" },
    appPassword: { type: String, default: "" }, // AES-GCM encrypted
    host: { type: String, default: "smtp.gmail.com" },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    fromName: { type: String, default: "EnerScope" },
    savedAt: { type: Date },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    /** Clubbed SMTP login for this user (sender email + encrypted app password). */
    smtp: { type: UserSmtpSchema, default: undefined },
  },
  { timestamps: true },
);

// Next.js can cache a stale User model from before `smtp` existed — rebuild if needed.
function getUserModel() {
  const existing = models.User;
  if (existing && !existing.schema.path("smtp")) {
    delete models.User;
    delete mongoose.connection.models.User;
  }
  return models.User || model("User", UserSchema);
}
export const User = getUserModel();

/* ---------------- Portal (1000+ supported) ---------------- */
const PortalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    listUrl: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    access: {
      mode: { type: String, enum: ["public", "login", "cookie"], default: "public" },
      loginUrl: { type: String, default: "" },
      user: { type: String, default: "" },
      pass: { type: String, default: "" },   // AES-GCM encrypted before save (see crypto.ts)
      cookie: { type: String, default: "" }, // AES-GCM encrypted before save
    },
    selectors: {
      container: { type: String, default: "table tbody tr" },
      title: { type: String, default: "" },
      link: { type: String, default: "a" },
      org: { type: String, default: "" },
      published: { type: String, default: "" },
      deadline: { type: String, default: "" },
      value: { type: String, default: "" },
      summary: { type: String, default: "" },
    },
    lastStatus: { type: String, default: "" },
    lastCheckedAt: { type: Date },
  },
  { timestamps: true },
);
PortalSchema.index({ name: "text" });
export const Portal = models.Portal || model("Portal", PortalSchema);

/* ---------------- External source (GeM / API) ---------------- */
const SourceSchema = new Schema(
  {
    type: { type: String, enum: ["gem", "api"], required: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    // GeM
    gemUser: { type: String, default: "" },          // encrypted
    gemPass: { type: String, default: "" },          // encrypted
    gemSessionCookie: { type: String, default: "" }, // encrypted
    gemListUrl: { type: String, default: "https://bidplus.gem.gov.in/all-bids" },
    // Generic API
    baseUrl: { type: String, default: "" },
    endpoint: { type: String, default: "" },
    authType: { type: String, enum: ["none", "apikey", "bearer"], default: "none" },
    apiKey: { type: String, default: "" }, // encrypted
    queryParam: { type: String, default: "keyword" },
    listPath: { type: String, default: "" },
    fieldMap: {
      title: { type: String, default: "title" },
      link: { type: String, default: "link" },
      org: { type: String, default: "org" },
      published: { type: String, default: "published" },
      deadline: { type: String, default: "deadline" },
      value: { type: String, default: "value" },
      summary: { type: String, default: "summary" },
    },
    lastStatus: { type: String, default: "" },
    lastCheckedAt: { type: Date },
  },
  { timestamps: true },
);
export const Source = models.Source || model("Source", SourceSchema);

/* ---------------- Tender ---------------- */
const TenderSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    link: { type: String, default: "" },
    org: { type: String, default: "" },
    published: { type: String, default: "" },
    deadline: { type: String, default: "" },
    value: { type: String, default: "" },
    summary: { type: String, default: "" },
    source: { type: String, default: "" },
    foundAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);
TenderSchema.index({ title: "text", summary: "text", org: "text" });
export const Tender = models.Tender || model("Tender", TenderSchema);

/* ---------------- Key/value settings ---------------- */
const SettingSchema = new Schema({ key: { type: String, unique: true, required: true }, value: Schema.Types.Mixed });
export const Setting = models.Setting || model("Setting", SettingSchema);

/* ---------------- Run log ---------------- */
const RunLogSchema = new Schema(
  {
    dryRun: { type: Boolean, default: false },
    startedAt: Date,
    finishedAt: Date,
    scrapedCount: { type: Number, default: 0 },
    freshCount: { type: Number, default: 0 },
    matchedToday: { type: Number, default: 0 },
    errors: [String],
    notes: [String],
  },
  { timestamps: true },
);
export const RunLog = models.RunLog || model("RunLog", RunLogSchema);
