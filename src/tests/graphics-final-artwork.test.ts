import { describe, expect, it } from "vitest";
import { validateFinalArtwork } from "@/features/graphics/final-artwork";

describe("final artwork upload", () => {
  it("accepts printable PDF and checks its content", () => {
    const body = Buffer.from("%PDF-1.4\n%%EOF");
    expect(validateFinalArtwork(new File([body], "final.pdf", { type: "application/pdf" }), body).extension).toBe("pdf");
  });
  it("rejects executable, spoofed and incomplete files", () => {
    expect(() => validateFinalArtwork(new File(["test"], "final.exe", { type: "application/pdf" }))).toThrow();
    expect(() => validateFinalArtwork(new File(["test"], "final.pdf", { type: "application/pdf" }), Buffer.from("test"))).toThrow();
    expect(() => validateFinalArtwork(new File(["%PDF-1.4"], "final.pdf", { type: "application/pdf" }), Buffer.from("%PDF-1.4"))).toThrow();
    expect(() => validateFinalArtwork(new File(["test"], "final.svg", { type: "image/svg+xml" }))).toThrow();
  });
});
