import { dbConnect } from "./mongodb";
import { Setting, User } from "./models";
import { decrypt } from "./crypto";

export type ExcelColumn = {
  label: string;
  on: boolean;
  field: string;
};

export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string; // sender email + app password (pass may be encrypted at rest)
  fromName: string;
  recipients: string[];
  subjectTag: string;
  notifyEmpty: boolean;
  emailTime: string; // "HH:MM" — single daily send time

  /** Login email of the user whose SMTP credentials are used for scheduled sends */
  smtpOwner?: string;
};

export type ExcelOptions = {
  prefix: string;
  sort: "deadline" | "published" | "portal" | "found";
  highlightDays: number;
  splitByPortal: boolean;
  columns: ExcelColumn[]; // empty array = use built-in default set
};

export type AppSettings = {
  keywords: string[];
  excludeKeywords: string[];
  runIntervalMinutes: number;
  email: EmailSettings;
  excel: ExcelOptions;
};

export const DEFAULT_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    label: "Tender title",
    on: true,
    field: "title",
  },
  {
    label: "Organization",
    on: true,
    field: "org",
  },
  {
    label: "Reference",
    on: true,
    field: "summary",
  },
  {
    label: "Published",
    on: true,
    field: "published",
  },
  {
    label: "Last date",
    on: true,
    field: "deadline",
  },
  {
    label: "Days left",
    on: true,
    field: "days",
  },
  {
    label: "Portal",
    on: true,
    field: "source",
  },
  {
    label: "Link",
    on: true,
    field: "link",
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  keywords: [
    "solar",
    "wind",
    "BESS",
    "battery",
    "storage",
    "hydro",
    "transmission",
    "substation",
    "EV charging",
    "green hydrogen",
  ],

  excludeKeywords: [
    "cancelled",
    "corrigendum",
    "recruitment",
    "vacancy",
  ],

  runIntervalMinutes: 360,

  email: {
    enabled: false,
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromName: "EnerScope",
    recipients: [],
    subjectTag: "Tender Digest",
    notifyEmpty: false,
    emailTime: "17:30",
    smtpOwner: "",
  },

  excel: {
    prefix: "EnerScope_Digest",
    sort: "deadline",
    highlightDays: 14,
    splitByPortal: false,
    columns: [],
  },
};

export async function getSettings(): Promise<AppSettings> {
  await dbConnect();

  const doc = await Setting.findOne({ key: "app" }).lean<{
    value?: unknown;
  }>();

  const saved = (doc?.value ?? {}) as Partial<AppSettings>;

  const excel = {
    ...DEFAULT_SETTINGS.excel,
    ...(saved.excel || {}),
  };

  if (!Array.isArray(excel.columns)) {
    excel.columns = [];
  }

  return {
    ...DEFAULT_SETTINGS,
    ...saved,

    email: {
      ...DEFAULT_SETTINGS.email,
      ...(saved.email || {}),
    },

    excel,
  };
}

export async function saveSettings(
  patch: Partial<AppSettings>,
) {
  await dbConnect();

  const current = await getSettings();

  const next: AppSettings = {
    ...current,
    ...patch,

    email: {
      ...current.email,
      ...(patch.email || {}),
    },

    excel: {
      ...current.excel,
      ...(patch.excel || {}),
    },
  };

  await Setting.updateOne(
    { key: "app" },
    {
      $set: {
        value: next,
      },
    },
    {
      upsert: true,
    },
  );

  return next;
}

/**
 * Strip legacy SMTP login/password from app settings
 * so they can never override the portal.
 */
export async function clearLegacyAppSmtp() {
  const settings = await getSettings();

  if (!settings.email.user && !settings.email.pass) {
    return settings;
  }

  return saveSettings({
    email: {
      ...settings.email,
      user: "",
      pass: "",
    },
  });
}

/**
 * Portal form values for the logged-in user.
 *
 * Prefer user.smtp. If missing, show legacy app-settings once
 * (for migration), but sends will still require Save.
 */
export async function getEmailSettingsForUser(
  loginEmail: string,
): Promise<
  EmailSettings & {
    credentialsSource: "user" | "legacy" | "none";
  }
> {
  const settings = await getSettings();

  await dbConnect();

  // Raw collection read — avoids stale Mongoose schemas
  // dropping `smtp` in Next.js hot reload.
  const user = await User.collection.findOne(
    {
      email: loginEmail.toLowerCase(),
    },
    {
      projection: {
        smtp: 1,
      },
    },
  );

  const smtp = (user as any)?.smtp || {};

  if (smtp.senderEmail && smtp.appPassword) {
    return {
      ...settings.email,

      host: smtp.host || "smtp.gmail.com",

      port: Number(smtp.port || 587),

      secure: Boolean(
        smtp.secure ??
          Number(smtp.port || 587) === 465,
      ),

      user: String(smtp.senderEmail).toLowerCase(),

      pass: smtp.appPassword,

      fromName:
        smtp.fromName ||
        settings.email.fromName ||
        "EnerScope",

      smtpOwner: loginEmail.toLowerCase(),

      credentialsSource: "user",
    };
  }

  // Legacy read-only preview
  // (do not use for sending after migration)
  if (settings.email.user && settings.email.pass) {
    return {
      ...settings.email,

      user: String(settings.email.user).toLowerCase(),

      smtpOwner: loginEmail.toLowerCase(),

      credentialsSource: "legacy",
    };
  }

  return {
    ...settings.email,

    user: "",

    pass: "",

    smtpOwner: loginEmail.toLowerCase(),

    credentialsSource: "none",
  };
}

/**
 * Credentials used for actual SMTP send —
 * user.smtp only, never legacy app settings.
 */
export async function getEmailSettingsForSend(
  loginEmail?: string,
): Promise<EmailSettings> {
  await dbConnect();

  const tryUser = async (email: string) => {
    const u = await User.collection.findOne(
      {
        email: email.toLowerCase(),
      },
      {
        projection: {
          smtp: 1,
          email: 1,
        },
      },
    );

    const smtp = (u as any)?.smtp || {};

    if (!smtp.senderEmail || !smtp.appPassword) {
      return null;
    }

    const settings = await getSettings();

    return {
      ...settings.email,

      host: smtp.host || "smtp.gmail.com",

      port: Number(smtp.port || 587),

      secure: Boolean(
        smtp.secure ??
          Number(smtp.port || 587) === 465,
      ),

      user: String(smtp.senderEmail).toLowerCase(),

      pass: smtp.appPassword as string,

      fromName:
        smtp.fromName ||
        settings.email.fromName ||
        "EnerScope",

      smtpOwner: email.toLowerCase(),
    } satisfies EmailSettings;
  };

  if (loginEmail) {
    const owned = await tryUser(loginEmail);

    if (owned) {
      return owned;
    }

    throw new Error(
      "No SMTP credentials saved for your user. Enter sender email + app password and click Save.",
    );
  }

  const settings = await getSettings();

  const owner = (
    settings.email.smtpOwner || ""
  ).toLowerCase();

  if (owner) {
    const owned = await tryUser(owner);

    if (owned) {
      return owned;
    }
  }

  const withSmtp = await User.collection.findOne({
    "smtp.senderEmail": {
      $nin: ["", null],
    },

    "smtp.appPassword": {
      $nin: ["", null],
    },
  });

  if (withSmtp) {
    const owned = await tryUser(
      (withSmtp as any).email,
    );

    if (owned) {
      return owned;
    }
  }

  throw new Error(
    "No SMTP credentials in the database. Open Admin → Email, enter sender + app password, and Save.",
  );
}

export function decryptEmailPass(pass: string): string {
  if (!pass) {
    return "";
  }

  const decrypted = decrypt(pass);

  return (decrypted || "").replace(/\s+/g, "");
}

export const PASSWORD_MASK = "••••••";