import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("security critical XSS escaping (PRD §9.4)", () => {
  it("renders a <script> payload from notes as literal text, never as a script element", () => {
    const payload = "<script>window.__xss = true</script>";
    const { container } = render(<dd>{payload}</dd>);

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe(payload);
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it("renders an <img onerror> payload as literal text, never as an image element", () => {
    const payload = `<img src=x onerror="window.__xss = true" />`;
    const { container } = render(<dd>{payload}</dd>);

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(payload);
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it("renders an <a href=javascript:> payload as literal text, never as a link", () => {
    const payload = `<a href="javascript:window.__xss=true">click</a>`;
    const { container } = render(<dd>{payload}</dd>);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe(payload);
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });
});
