export type Contact = {
  name: string;
  email: string;
  phone: string;
  site: string;
  notes: string;
  consent: boolean;
};

export type ContactErrors = Partial<Record<keyof Contact, string>>;

export const DESCRIPTION_LIMITS = { min: 10, max: 500 };

export function descriptionError(description: string) {
  const length = description.trim().length;
  if (length < DESCRIPTION_LIMITS.min)
    return "Add a little more detail so we can prepare (at least 10 characters).";
  if (length > DESCRIPTION_LIMITS.max)
    return "Keep the description to 500 characters or fewer.";
  return "";
}

/** Mirrors the API's contact rules, with friendlier messages. */
export function contactErrors(contact: Contact): ContactErrors {
  const errors: ContactErrors = {};
  const name = contact.name.trim();
  const digits = contact.phone.replace(/\D/g, "").length;
  if (name.length < 2 || name.length > 160)
    errors.name = "Enter your full name.";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) ||
    contact.email.length > 254
  )
    errors.email = "Enter a valid email address, like name@example.com.";
  if (digits < 7 || digits > 15 || /[^\d\s()+-]/.test(contact.phone))
    errors.phone = "Enter a phone number we can call, like 082 555 0142.";
  if (contact.site.trim().length < 5 || contact.site.length > 500)
    errors.site = "Enter the street address where the work will happen.";
  if (contact.notes.length > 2000)
    errors.notes = "Keep notes to 2,000 characters or fewer.";
  if (!contact.consent)
    errors.consent = "Please agree so we can prepare your request.";
  return errors;
}
