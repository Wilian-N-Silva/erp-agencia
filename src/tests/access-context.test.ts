import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSessionUserIsAuthorized: vi.fn(),
  getCurrentSession: vi.fn(),
}));

vi.mock("@/features/access-invitations/auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/access-invitations/auth")>();

  return {
    ...actual,
    assertSessionUserIsAuthorized: mocks.assertSessionUserIsAuthorized,
  };
});

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

import {
  AccessInvitationAuthError,
  invitationAuthErrorCodes,
} from "@/features/access-invitations/auth";
import { getCurrentAccessContext } from "@/lib/dal/context";

describe("current access context status gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({
      user: {
        id: "stale-session-user",
      },
    });
  });

  it("denies an existing session as soon as the user becomes inactive", async () => {
    mocks.assertSessionUserIsAuthorized.mockRejectedValue(
      new AccessInvitationAuthError(
        invitationAuthErrorCodes.inactiveSession,
      ),
    );

    await expect(getCurrentAccessContext()).resolves.toBeNull();
    expect(mocks.assertSessionUserIsAuthorized).toHaveBeenCalledWith(
      "stale-session-user",
    );
  });
});
