import { useState } from "react";
import { api } from "../../shared/api";
import { ErrorMessage } from "../../shared/ui";

export type RecoveryCodes = { recoveryCodes: string[] };

export function SavedCodes({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div role="status">
      <h3>Save your recovery codes</h3>
      <p>
        Store these privately in a password manager or a safe place offline.
        Anyone with a code can recover your account. These codes are shown only
        now.
      </p>
      <ul className="recovery-codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecoverySettings({
  mfaEnabled,
  codes,
  setCodes,
}: {
  mfaEnabled: boolean;
  codes: string[];
  setCodes: (codes: string[]) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="detail-panel"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        setCodes([]);
        try {
          const result = await api<RecoveryCodes>(
            "/auth/recovery/codes",
            "POST",
            {
              password: data.get("password"),
              code: data.get("code"),
            },
          );
          setCodes(result.recoveryCodes);
          form.reset();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Account recovery</h2>
      <p>
        Save codes before you lose access. Generating new codes replaces all
        previous codes. Recovery resets your password and authenticator, signs
        out existing sessions and invalidates all saved codes.
      </p>
      <label>
        Current password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {mfaEnabled && (
        <label>
          Authenticator code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6}"
          />
        </label>
      )}
      <ErrorMessage message={error} />
      <button className="primary-button" disabled={busy}>
        {busy ? "Generating…" : "Generate new recovery codes"}
      </button>
      <SavedCodes codes={codes} />
    </form>
  );
}

export function RecoverAccount({
  onRecovered,
  onCancel,
}: {
  onRecovered: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api("/auth/recovery", "POST", {
            email: data.get("email"),
            recoveryCode: data.get("recoveryCode"),
            newPassword: data.get("password"),
          });
          onRecovered();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 id="signin-title">Recover your account</h2>
      <p>
        Use a saved recovery code. This resets your authenticator, signs out
        existing sessions and invalidates all old recovery codes.
      </p>
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Recovery code
        <input name="recoveryCode" autoComplete="off" required maxLength={64} />
      </label>
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </label>
      <p>
        Use at least 12 characters, including uppercase, lowercase, a number and
        a symbol.
      </p>
      <ErrorMessage message={error} />
      <button className="primary-button" disabled={busy}>
        {busy ? "Recovering…" : "Recover account"}
      </button>
      <p>
        <button className="link-button" type="button" onClick={onCancel}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
