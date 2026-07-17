import { randomBytes } from "node:crypto";

export const SAFETY_SESSION_COOKIE = "optiq_sid";
export const SAFETY_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SAFETY_IDENTIFIER_PATTERN = /^anon_[A-Za-z0-9_-]{22}$/;

export type SafetySession = {
  created: boolean;
  identifier: string;
};

export function createSafetyIdentifier(): string {
  return `anon_${randomBytes(16).toString("base64url")}`;
}

export function isValidSafetyIdentifier(value: string): boolean {
  return value.length <= 64 && SAFETY_IDENTIFIER_PATTERN.test(value);
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    return pair.slice(separator + 1).trim();
  }
  return null;
}

export function resolveSafetySession(
  cookieHeader: string | null,
  generate: () => string = createSafetyIdentifier,
): SafetySession {
  const existing = readCookie(cookieHeader, SAFETY_SESSION_COOKIE);
  if (existing !== null && isValidSafetyIdentifier(existing)) {
    return { created: false, identifier: existing };
  }

  const identifier = generate();
  if (!isValidSafetyIdentifier(identifier)) {
    throw new Error("Safety identifier generator returned an invalid value.");
  }
  return { created: true, identifier };
}

export function serializeSafetySessionCookie(
  identifier: string,
  secure: boolean,
): string {
  if (!isValidSafetyIdentifier(identifier)) {
    throw new Error("Cannot serialize an invalid safety identifier.");
  }
  return [
    `${SAFETY_SESSION_COOKIE}=${identifier}`,
    "Path=/",
    `Max-Age=${SAFETY_SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
  ]
    .filter((value): value is string => value !== null)
    .join("; ");
}
