import { isIssuerDomain, knownDomainsFor } from "./issuer-domains";

export type SourceFormValues = {
  issuer_name: string;
  compare_url: string;
};

export type SourceInput = {
  issuer_name: string;
  compare_url: string | null;
};

export type FieldErrors = Partial<Record<keyof SourceFormValues, string>>;

export type ValidationResult =
  | { ok: true; data: SourceInput }
  | { ok: false; fieldErrors: FieldErrors };

const MAX_URL_LENGTH = 2048;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * A compare URL must be https, on the default port, with no credentials, and
 * on the issuer's own domain (never an aggregator, IP address or localhost).
 */
export function validateCompareUrl(raw: string, issuerName: string): UrlCheck {
  const value = raw.trim();
  if (value.length > MAX_URL_LENGTH) return { ok: false, error: "That URL is too long." };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Use an https:// URL." };
  if (url.username || url.password) {
    return { ok: false, error: "Remove the username or password from the URL." };
  }
  if (url.port) return { ok: false, error: "Remove the port from the URL." };

  const host = url.hostname.toLowerCase();
  if (IPV4.test(host) || host.startsWith("[") || !host.includes(".") || host.endsWith(".local")) {
    return { ok: false, error: "Use the issuer's public website, not an IP address or local host." };
  }

  const name = issuerName.trim();
  if (!name) return { ok: false, error: "Enter the issuer name first." };
  if (!isIssuerDomain(host, name)) {
    const known = knownDomainsFor(name);
    return {
      ok: false,
      error: known
        ? `Use ${name}'s own site (${known.join(" or ")}).`
        : `Use ${name}'s own site. The domain should contain the issuer's name.`,
    };
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}

export function readSourceForm(formData: FormData): SourceFormValues {
  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : "";
  };
  return {
    issuer_name: get("issuer_name"),
    compare_url: get("compare_url"),
  };
}

/** Shape checks only; name uniqueness is checked against the database. */
export function validateSourceInput(values: SourceFormValues): ValidationResult {
  const fieldErrors: FieldErrors = {};

  const issuerName = values.issuer_name.trim().replace(/\s+/g, " ");
  if (issuerName.length < 2 || issuerName.length > 80) {
    fieldErrors.issuer_name = "Enter the issuer name (2 to 80 characters).";
  } else if (/[\u0000-\u001f<>]/.test(issuerName)) {
    fieldErrors.issuer_name = "Use letters, numbers and basic punctuation only.";
  }

  let compareUrl: string | null = null;
  if (values.compare_url.trim()) {
    const check = validateCompareUrl(values.compare_url, issuerName);
    if (check.ok) compareUrl = check.url;
    else fieldErrors.compare_url = check.error;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    data: {
      issuer_name: issuerName,
      compare_url: compareUrl,
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
