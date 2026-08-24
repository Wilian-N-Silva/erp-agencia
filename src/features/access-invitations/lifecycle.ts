import { normalizeInvitationEmail } from "./rules";

export const invitationAuthErrorCodes = {
  inactiveSession: "ACCESS_STATUS_NOT_ACTIVE",
  invalidRoles: "ACCESS_INVITATION_ROLES_INVALID",
  pendingSession: "ACCESS_PENDING",
  required: "ACCESS_INVITATION_REQUIRED",
  unauthorizedSession: "ACCESS_NOT_AUTHORIZED",
} as const;

export class AccessInvitationAuthError extends Error {
  constructor(
    readonly code: (typeof invitationAuthErrorCodes)[keyof typeof invitationAuthErrorCodes],
  ) {
    super(code);
    this.name = "AccessInvitationAuthError";
  }
}

export type ValidAccessInvitation = {
  id: string;
  organizationId: string;
};

type InvitationAuthGateway = {
  assertSessionUserIsAuthorized: (userId: string) => Promise<void>;
  consumeInvitationForUser: (input: {
    email: string;
    organizationId: string;
    userId: string;
  }) => Promise<unknown>;
  findSessionUserIdentity: (
    userId: string,
  ) => Promise<{ email: string } | null>;
  findValidInvitationForEmail: (
    email: string,
  ) => Promise<ValidAccessInvitation | null>;
};

export function createInvitationAuthLifecycle(gateway: InvitationAuthGateway) {
  async function requireInvitationForNewUser(email: string) {
    const normalizedEmail = normalizeInvitationEmail(email);
    const invitation = await gateway.findValidInvitationForEmail(normalizedEmail);

    if (!invitation) {
      throw new AccessInvitationAuthError(invitationAuthErrorCodes.required);
    }

    return {
      email: normalizedEmail,
      invitation,
    };
  }

  async function consumeInvitationForNewUser(user: {
    email: string;
    id: string;
    organizationId?: string | null;
  }) {
    const authorization = await requireInvitationForNewUser(user.email);

    if (user.organizationId !== authorization.invitation.organizationId) {
      throw new AccessInvitationAuthError(invitationAuthErrorCodes.required);
    }

    await gateway.consumeInvitationForUser({
      email: authorization.email,
      organizationId: authorization.invitation.organizationId,
      userId: user.id,
    });
  }

  async function authorizeSessionUser(userId: string) {
    try {
      await gateway.assertSessionUserIsAuthorized(userId);
      return;
    } catch (error) {
      if (
        !(error instanceof AccessInvitationAuthError) ||
        (error.code !== invitationAuthErrorCodes.unauthorizedSession &&
          error.code !== invitationAuthErrorCodes.pendingSession)
      ) {
        throw error;
      }
    }

    const user = await gateway.findSessionUserIdentity(userId);

    if (!user) {
      throw new AccessInvitationAuthError(
        invitationAuthErrorCodes.unauthorizedSession,
      );
    }

    const authorization = await requireInvitationForNewUser(user.email);
    await gateway.consumeInvitationForUser({
      email: authorization.email,
      organizationId: authorization.invitation.organizationId,
      userId,
    });
    await gateway.assertSessionUserIsAuthorized(userId);
  }

  return {
    authorizeSessionUser,
    consumeInvitationForNewUser,
    requireInvitationForNewUser,
  };
}
