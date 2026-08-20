import { describe, expect, it } from "vitest";
import { validateAvatarFile } from "@/lib/firebase/services";

describe("validateAvatarFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("aceita %s", (type) => {
    expect(() => validateAvatarFile({ size: 1024, type })).not.toThrow();
  });

  it("rejeita arquivo vazio", () => {
    expect(() => validateAvatarFile({ size: 0, type: "image/png" })).toThrow(/vazia/i);
  });

  it("rejeita arquivo maior que 5 MB", () => {
    expect(() => validateAvatarFile({ size: 5 * 1024 * 1024 + 1, type: "image/png" })).toThrow(/5 MB/i);
  });

  it("rejeita tipo que não é imagem permitida", () => {
    expect(() => validateAvatarFile({ size: 1024, type: "application/pdf" })).toThrow(/JPG, PNG ou WEBP/i);
  });
});
