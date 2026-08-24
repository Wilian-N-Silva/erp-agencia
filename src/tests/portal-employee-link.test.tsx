import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";

describe("portal employee link gate", () => {
  it("shows a clear blocked state without fabricated employee defaults", () => {
    render(<PortalEmployeeLinkRequired />);

    expect(
      screen.getByText("Vínculo de colaborador pendente"),
    ).toBeTruthy();
    expect(
      screen.getByText(/ainda não foi vinculada a um cadastro de colaborador/i),
    ).toBeTruthy();
    expect(screen.queryByText("Colaborador")).toBeNull();
  });
});
