import { describe, expect, it } from "vitest";
import { validateAuth, type AuthFields } from "./validation";

const valid: AuthFields = {
  name: "Anne-Marie O’Neill",
  email: "client@example.com",
  password: "StrongPassword1!",
  code: "123456",
};

describe("sign-in and registration validation", () => {
  it.each([
    "Anne-Marie O’Neill",
    "José da Silva",
    "李明",
    "Zoë",
    "Ame\u0301lie",
  ])("accepts a name with letters: %s", (name) => {
    expect(validateAuth({ ...valid, name }, true, false).name).toBeUndefined();
  });
  it.each(["Client123", "1234", "   ", "A", "Jane<script>", "-Jane"])(
    "rejects an invalid name: %s",
    (name) => {
      expect(validateAuth({ ...valid, name }, true, false).name).toBeTruthy();
    },
  );
  it("allows existing passwords when signing in", () => {
    expect(
      validateAuth(
        { ...valid, password: "old" },
        false,
        false,
      ),
    ).toEqual({});
  });
  it("requires every registration password rule", () => {
    for (const password of [
      "Short1!",
      "lowercaseonly1!",
      "UPPERCASEONLY1!",
      "MissingNumber!",
      "MissingSymbol123",
    ])
      expect(
        validateAuth({ ...valid, password }, true, false).password,
      ).toBeTruthy();
    expect(validateAuth(valid, true, false)).toEqual({});
  });
  it("validates email syntax and trims surrounding whitespace", () => {
    expect(
      validateAuth({ ...valid, email: "invalid@" }, false, false).email,
    ).toBeTruthy();
    expect(
      validateAuth({ ...valid, email: " client@example.com " }, false, false),
    ).toEqual({});
  });
  it("checks only the authenticator code during MFA", () => {
    expect(
      validateAuth(
        { ...valid, email: "", password: "", code: "123456" },
        false,
        true,
      ),
    ).toEqual({});
    expect(
      validateAuth({ ...valid, code: "12a456" }, false, true).code,
    ).toBeTruthy();
  });
});
