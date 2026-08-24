import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AccessInvitationAuthError,
  createInvitationAuthLifecycle,
  invitationAuthErrorCodes,
  type ValidAccessInvitation,
} from "@/features/access-invitations/lifecycle";
import {
  getAccessInvitationState,
  getAllowedInvitationDomain,
  isInvitationEmailAllowed,
  normalizeInvitationEmail,
  normalizeInvitationRoles,
} from "@/features/access-invitations/rules";

const invitation: ValidAccessInvitation = {
  id: "10000000-0000-4000-8000-000000000001",
  organizationId: "20000000-0000-4000-8000-000000000001",
};

describe("access invitation rules", () => {
  it("normalizes emails and accepts only known, unique roles", () => {
    expect(normalizeInvitationEmail(" User@Example.COM ")).toBe(
      "user@example.com",
    );
    expect(
      normalizeInvitationRoles(["finance", "finance", "technical_admin"]),
    ).toEqual([
      "finance",
      "technical_admin",
    ]);
    expect(normalizeInvitationRoles(["finance", "unknown"])).toEqual([]);
  });

  it("enforces both organization and application domains", () => {
    const setting = { domain: " @Example.COM " };

    expect(getAllowedInvitationDomain(setting)).toBe("example.com");
    expect(
      isInvitationEmailAllowed(
        "user@example.com",
        setting,
        "example.com",
      ),
    ).toBe(true);
    expect(
      isInvitationEmailAllowed("user@other.com", setting, "other.com"),
    ).toBe(false);
    expect(
      isInvitationEmailAllowed("user@example.com", setting, "corp.test"),
    ).toBe(false);
  });

  it("classifies pending, used, and boundary-expired invitations", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");

    expect(
      getAccessInvitationState(
        {
          expiresAt: new Date("2026-08-24T12:00:01.000Z"),
          usedAt: null,
        },
        now,
      ),
    ).toBe("pending");
    expect(
      getAccessInvitationState(
        {
          expiresAt: now,
          usedAt: null,
        },
        now,
      ),
    ).toBe("expired");
    expect(
      getAccessInvitationState(
        {
          expiresAt: new Date("2026-08-24T12:00:01.000Z"),
          usedAt: now,
        },
        now,
      ),
    ).toBe("used");
  });
});

describe("access invitation authentication lifecycle", () => {
  const gateway = {
    assertSessionUserIsAuthorized: vi.fn(),
    consumeInvitationForUser: vi.fn(),
    findSessionUserIdentity: vi.fn(),
    findValidInvitationForEmail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    gateway.consumeInvitationForUser.mockResolvedValue(undefined);
  });

  it("rejects signup and login when no valid invitation exists", async () => {
    gateway.findValidInvitationForEmail.mockResolvedValue(null);
    gateway.assertSessionUserIsAuthorized.mockRejectedValue(
      new AccessInvitationAuthError(
        invitationAuthErrorCodes.unauthorizedSession,
      ),
    );
    gateway.findSessionUserIdentity.mockResolvedValue({
      email: "user@example.com",
    });
    const lifecycle = createInvitationAuthLifecycle(gateway);

    await expect(
      lifecycle.requireInvitationForNewUser("user@example.com"),
    ).rejects.toMatchObject({ code: invitationAuthErrorCodes.required });
    await expect(
      lifecycle.authorizeSessionUser("unauthorized-user"),
    ).rejects.toMatchObject({ code: invitationAuthErrorCodes.required });
    expect(gateway.consumeInvitationForUser).not.toHaveBeenCalled();
  });

  it("binds a new user to the invited organization and consumes once", async () => {
    gateway.findValidInvitationForEmail.mockResolvedValue(invitation);
    const lifecycle = createInvitationAuthLifecycle(gateway);

    await lifecycle.consumeInvitationForNewUser({
      email: " USER@EXAMPLE.COM ",
      id: "invited-user",
      organizationId: invitation.organizationId,
    });

    expect(gateway.consumeInvitationForUser).toHaveBeenCalledOnce();
    expect(gateway.consumeInvitationForUser).toHaveBeenCalledWith({
      email: "user@example.com",
      organizationId: invitation.organizationId,
      userId: "invited-user",
    });
  });

  it("redeems a valid invitation before creating a session for an existing user", async () => {
    gateway.assertSessionUserIsAuthorized
      .mockRejectedValueOnce(
        new AccessInvitationAuthError(
          invitationAuthErrorCodes.unauthorizedSession,
        ),
      )
      .mockResolvedValueOnce(undefined);
    gateway.findSessionUserIdentity.mockResolvedValue({
      email: "user@example.com",
    });
    gateway.findValidInvitationForEmail.mockResolvedValue(invitation);
    const lifecycle = createInvitationAuthLifecycle(gateway);

    await expect(
      lifecycle.authorizeSessionUser("invited-user"),
    ).resolves.toBeUndefined();
    expect(gateway.consumeInvitationForUser).toHaveBeenCalledOnce();
    expect(gateway.assertSessionUserIsAuthorized).toHaveBeenCalledTimes(2);
  });

  it("does not consume another invitation for an already authorized session", async () => {
    gateway.assertSessionUserIsAuthorized.mockResolvedValue(undefined);
    const lifecycle = createInvitationAuthLifecycle(gateway);

    await lifecycle.authorizeSessionUser("authorized-user");

    expect(gateway.findSessionUserIdentity).not.toHaveBeenCalled();
    expect(gateway.findValidInvitationForEmail).not.toHaveBeenCalled();
    expect(gateway.consumeInvitationForUser).not.toHaveBeenCalled();
  });
});
