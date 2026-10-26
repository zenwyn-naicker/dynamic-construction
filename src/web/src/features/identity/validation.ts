export type AuthFields = {
  name: string;
  email: string;
  password: string;
  code: string;
};

export const passwordRequirements = (password: string) => [
  { label: "At least 12 characters", met: password.length >= 12 },
  { label: "An uppercase letter", met: /[A-Z]/.test(password) },
  { label: "A lowercase letter", met: /[a-z]/.test(password) },
  { label: "A number", met: /[0-9]/.test(password) },
  { label: "A symbol", met: /[^a-zA-Z0-9]/.test(password) },
];

export function validateAuth(
  fields: AuthFields,
  register: boolean,
  mfa: boolean,
) {
  const errors: Partial<Record<keyof AuthFields, string>> = {};
  if (mfa) {
    if (!/^[0-9]{6}$/.test(fields.code))
      errors.code = "Enter the six-digit authenticator code.";
    return errors;
  }
  if (register) {
    const name = fields.name.trim();
    if (name.length < 2 || name.length > 160)
      errors.name = "Enter a full name between 2 and 160 characters.";
    else if (
      !/^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u.test(name)
    )
      errors.name =
        "Use letters, spaces, hyphens or apostrophes. Numbers are not allowed.";
  }
  const email = fields.email.trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address, such as name@example.com.";
  if (!fields.password) errors.password = "Enter your password.";
  else if (
    register &&
    passwordRequirements(fields.password).some((rule) => !rule.met)
  )
    errors.password = "Your password must meet all the requirements below.";
  return errors;
}

export function readAuthFields(form: HTMLFormElement): AuthFields {
  const data = new FormData(form);
  return Object.fromEntries(
    ["name", "email", "password", "code"].map((key) => [
      key,
      String(data.get(key) ?? ""),
    ]),
  ) as AuthFields;
}
