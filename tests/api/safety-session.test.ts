// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createSafetyIdentifier,
  isValidSafetyIdentifier,
  resolveSafetySession,
  SAFETY_SESSION_COOKIE,
  SAFETY_SESSION_MAX_AGE_SECONDS,
  serializeSafetySessionCookie,
} from "@/lib/session/safety-session";

const knownIdentifier = `anon_${"A".repeat(22)}`;

describe("anonymous safety session", () => {
  it("creates distinct opaque 128-bit-style identifiers", () => {
    const first = createSafetyIdentifier();
    const second = createSafetyIdentifier();

    expect(isValidSafetyIdentifier(first)).toBe(true);
    expect(isValidSafetyIdentifier(second)).toBe(true);
    expect(first).not.toBe(second);
    expect(first).toHaveLength(27);
  });

  it("reuses a valid cookie and replaces a malformed value", () => {
    expect(
      resolveSafetySession(`${SAFETY_SESSION_COOKIE}=${knownIdentifier}`),
    ).toEqual({ created: false, identifier: knownIdentifier });

    expect(
      resolveSafetySession(
        `${SAFETY_SESSION_COOKIE}=client-supplied-email@example.com`,
        () => knownIdentifier,
      ),
    ).toEqual({ created: true, identifier: knownIdentifier });
  });

  it("sets the functional cookie flags for development and production", () => {
    const development = serializeSafetySessionCookie(knownIdentifier, false);
    expect(development).toContain(`${SAFETY_SESSION_COOKIE}=${knownIdentifier}`);
    expect(development).toContain("Path=/");
    expect(development).toContain(
      `Max-Age=${SAFETY_SESSION_MAX_AGE_SECONDS}`,
    );
    expect(development).toContain("HttpOnly");
    expect(development).toContain("SameSite=Lax");
    expect(development).not.toContain("Secure");

    expect(serializeSafetySessionCookie(knownIdentifier, true)).toContain(
      "Secure",
    );
  });

  it("refuses to serialize or generate malformed identifiers", () => {
    expect(() => serializeSafetySessionCookie("email@example.com", false)).toThrow();
    expect(() =>
      resolveSafetySession(null, () => "user-agent-derived"),
    ).toThrow();
  });
});
