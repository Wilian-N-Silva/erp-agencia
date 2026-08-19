import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { DocumentRegistrationForm } from "@/app/(private)/app/documentos/document-registration-form";
import {
  RateLimitedActionForm,
  ToastProvider,
} from "@/components/fg";
import { registerDocumentAction } from "@/features/documents/actions";
import {
  RATE_LIMIT_ERROR_MESSAGE,
  RateLimitExceededError,
  withRateLimitActionResult,
} from "@/lib/rate-limit";

describe("rate-limited document form", () => {
  it("shows accessible feedback and does not write when a protected form is blocked", async () => {
    const write = vi.fn();
    const rateLimitGate = vi.fn().mockRejectedValue(
      new RateLimitExceededError({
        allowed: false,
        limit: 20,
        remaining: 0,
        resetAt: new Date("2026-08-18T12:10:00.000Z"),
        retryAfterSeconds: 37,
      }),
    );
    const protectedAction = withRateLimitActionResult(
      async (formData: FormData) => {
        await rateLimitGate(formData);
        write();
      },
    );

    render(
      <ToastProvider>
        <RateLimitedActionForm action={protectedAction}>
          <input name="ownerId" type="hidden" value="employee-1" />
          <button type="submit">Enviar documento</button>
        </RateLimitedActionForm>
      </ToastProvider>,
    );

    const submitButton = screen.getByRole("button", {
      name: "Enviar documento",
    });
    const form = submitButton.closest("form");
    expect(form).not.toBeNull();

    // JSDOM does not reproduce Next's Server Action transport. A controlled
    // action exercises React 19 here; the real entrypoint is covered separately.
    await act(async () => {
      fireEvent.submit(form!);
    });

    const alert = await screen.findByRole("alert");
    expect(alert.hidden).toBe(false);
    expect(alert.textContent).toContain("Limite de tentativas atingido");
    expect(alert.textContent).toContain(RATE_LIMIT_ERROR_MESSAGE);
    expect(rateLimitGate).toHaveBeenCalledOnce();
    expect(rateLimitGate.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(rateLimitGate.mock.calls[0]?.[0].get("ownerId")).toBe("employee-1");
    expect(write).not.toHaveBeenCalled();
  });

  it("wires the real document upload form to the reusable feedback boundary", () => {
    const element = DocumentRegistrationForm({ employeeOptions: [] });

    expect(element.type).toBe(RateLimitedActionForm);
    expect(element.props.action).toBe(registerDocumentAction);
    expect(element.props).not.toHaveProperty("encType");
    expect(element.props).not.toHaveProperty("method");
  });
});
