import { describe, expect, it } from "vitest";
import { resultSizeFor, validateImageFile } from "./files";

const MB = 1024 * 1024;

describe("validateImageFile", () => {
  it("accepts PNG, JPG, JPEG and WEBP images", () => {
    expect(validateImageFile({ name: "a.png", type: "image/png", size: MB }).ok).toBe(true);
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: MB }).ok).toBe(true);
    expect(validateImageFile({ name: "a.jpeg", type: "image/jpeg", size: MB }).ok).toBe(true);
    expect(validateImageFile({ name: "a.webp", type: "image/webp", size: MB }).ok).toBe(true);
  });

  it("rejects other formats with a 400", () => {
    const r = validateImageFile({ name: "a.gif", type: "image/gif", size: MB });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("allows exactly 20 MB and rejects anything larger with a 413", () => {
    expect(validateImageFile({ name: "a.png", type: "image/png", size: 20 * MB }).ok).toBe(true);
    const r = validateImageFile({ name: "a.png", type: "image/png", size: 20 * MB + 1 });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
});

describe("resultSizeFor", () => {
  it("returns 1024x1024 for a square photo", () => {
    expect(resultSizeFor(3000, 3000)).toEqual({ width: 1024, height: 1024 });
  });

  it("keeps edges as multiples of 16 for a portrait photo", () => {
    const { width, height } = resultSizeFor(1080, 1350);
    expect(width % 16).toBe(0);
    expect(height % 16).toBe(0);
    expect(height).toBeGreaterThan(width);
  });

  it("caps very wide photos at a 3:1 ratio", () => {
    const { width, height } = resultSizeFor(9000, 1000);
    expect(width / height).toBeLessThanOrEqual(3.05);
  });
});
