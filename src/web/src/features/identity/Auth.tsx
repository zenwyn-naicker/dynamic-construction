import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../shared/api";
import { ErrorMessage, Loading } from "../../shared/ui";
import {
  readAuthFields,
  validateAuth,
  type AuthFields,
} from "./validation";
import {
  RecoverAccount,
  RecoverySettings,
  type RecoveryCodes,
} from "./Recovery";
export type User = {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  twoFactorEnabled: boolean;
  requiresMfaSetup: boolean;
};
type AuthenticatorSetup = {
  key: string;
  issuer: string;
  account: string;
};
type LoginResult = {
  requiresMfaCode: boolean;
  requiresMfaSetup: boolean;
};
type PendingMfa = {
  email: string;
  password: string;
};
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  reload: () => Promise<User>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  reload: async () => {
    throw new Error("Authentication provider unavailable.");
  },
  logout: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  async function reload() {
    try {
      const current = await api<User>("/auth/me");
      setUser(current);
      return current;
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload().catch(() => {});
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        reload,
        logout: async () => {
          await api("/auth/logout", "POST");
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function SignIn() {
  const [register, setRegister] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState<AuthFields>({
    name: "",
    email: "",
    password: "",
    code: "",
  });
  const [touched, setTouched] = useState<
    Partial<Record<keyof AuthFields, boolean>>
  >({});
  const fieldErrors = validateAuth(fields, register, pendingMfa !== null);
  function feedback(field: keyof AuthFields) {
    return touched[field] && fieldErrors[field]
      ? fieldErrors[field]
      : undefined;
  }
  function fieldFeedback(field: keyof AuthFields) {
    return (
      <span
        id={`auth-${field}-feedback`}
        className="auth-field-feedback"
        aria-live="polite"
      >
        {feedback(field)}
      </span>
    );
  }
  const auth = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const current = readAuthFields(e.currentTarget);
    setFields(current);
    setTouched({
      name: true,
      email: true,
      password: true,
      code: true,
    });
    if (
      Object.keys(validateAuth(current, register, pendingMfa !== null)).length
    )
      return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (register) {
        await api("/auth/register", "POST", {
          fullName: current.name.trim(),
          email: current.email.trim(),
          password: f.get("password"),
        });
        setRegister(false);
        setTouched({});
        setMessage("Account created. Sign in to continue.");
      } else {
        const email = pendingMfa?.email ?? current.email.trim();
        const password =
          pendingMfa?.password ?? String(f.get("password") ?? "");
        const r = await api<LoginResult>("/auth/login", "POST", {
          email,
          password,
          code: pendingMfa ? f.get("code") : null,
          rememberDevice:
            pendingMfa !== null && f.get("rememberDevice") === "on",
        });
        if (r.requiresMfaCode) {
          setPendingMfa({ email, password });
          setTouched({});
          setMessage("");
          return;
        }
        setPendingMfa(null);
        const u = await auth.reload();
        navigate(
          r.requiresMfaSetup
            ? "/profile"
            : u.roles.includes("Client")
              ? "/client"
              : "/staff",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="signin-title"
      onCancel={() => navigate("/")}
    >
      <button
        type="button"
        className="auth-close"
        aria-label="Close sign in"
        onClick={() => navigate("/")}
      >
        ×
      </button>
      <div className="auth-page">
        <div className="auth-editorial">
          <p className="eyebrow">DYNAMIC CONSTRUCTION</p>
          <h1>
            Your project.
            <br />
            One clear view.
          </h1>
          <p>
            Progress, documents and decisions, together in a secure workspace.
          </p>
          <div className="material-strip">
            <div className="concrete" />
            <div className="timber" />
            <div className="clay" />
          </div>
        </div>
        {recovering ? (
          <RecoverAccount
            onCancel={() => setRecovering(false)}
            onRecovered={() => {
              setRecovering(false);
              setMessage(
                "Account recovered. Sign in, set up your authenticator again and save new recovery codes in Your account.",
              );
            }}
          />
        ) : (
          <form
            className="auth-card"
            noValidate
            onSubmit={submit}
            onChange={(event) => {
              const input = event.target;
              if (
                !(input instanceof HTMLInputElement) ||
                input.type === "checkbox"
              )
                return;
              setFields(readAuthFields(event.currentTarget));
              setTouched((previous) => ({ ...previous, [input.name]: true }));
              setError("");
            }}
            onBlur={(event) => {
              const input = event.target;
              if (
                input instanceof HTMLInputElement &&
                input.type !== "checkbox" &&
                input.value
              ) {
                setFields(readAuthFields(event.currentTarget));
                setTouched((previous) => ({
                  ...previous,
                  [input.name]: true,
                }));
              }
            }}
          >
            <p className="eyebrow">CLIENT / STAFF ACCESS</p>
            <h2 id="signin-title">
              {pendingMfa
                ? "Enter your code"
                : register
                  ? "Create your account"
                  : "Welcome back"}
            </h2>
            <p>
              {pendingMfa
                ? "Use the six-digit code from your authenticator app."
                : register
                  ? "Register as a client. No staff approval is needed."
                  : "Sign in to your project workspace."}
            </p>
            {register && !pendingMfa && (
              <label>
                Full name
                <input
                  name="name"
                  aria-label="Full name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={160}
                  aria-invalid={!!feedback("name")}
                  aria-describedby="auth-name-feedback"
                />
                {fieldFeedback("name")}
              </label>
            )}
            {pendingMfa ? (
              <>
                <p className="secure-note">{pendingMfa.email}</p>
                <label key="mfa-code-field">
                  Authenticator code
                  <input
                    key="mfa-code-input"
                    name="code"
                    aria-label="Authenticator code"
                    autoFocus
                    required
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-invalid={!!feedback("code")}
                    aria-describedby="auth-code-feedback"
                  />
                  {fieldFeedback("code")}
                </label>
                <label className="check-label">
                  <input type="checkbox" name="rememberDevice" />
                  Remember this device for 7 days
                </label>
                <p className="secure-note">
                  Only select this on a device you trust.
                </p>
              </>
            ) : (
              <>
                <label>
                  Email address
                  <input
                    name="email"
                    aria-label="Email address"
                    autoFocus
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    aria-invalid={!!feedback("email")}
                    aria-describedby="auth-email-feedback"
                  />
                  {fieldFeedback("email")}
                </label>
                <div className="password-field" key="password-field">
                  <label htmlFor="auth-password">Password</label>
                  <span className="password-control">
                    <input
                      id="auth-password"
                      key="password-input"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                      required
                      minLength={register ? 12 : 1}
                      aria-invalid={!!feedback("password")}
                      aria-describedby={
                        register
                          ? "auth-password-feedback auth-password-rules"
                          : "auth-password-feedback"
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                  {fieldFeedback("password")}
                </div>
              </>
            )}
            {register && (
              <p id="auth-password-rules" className="secure-note">
                Use at least 12 characters, including uppercase, lowercase, a
                number and a symbol.
              </p>
            )}
            <ErrorMessage message={error} />
            <p role="status">{message}</p>
            <button className="primary-button full" disabled={busy}>
              {busy
                ? "Please wait..."
                : pendingMfa
                  ? "Verify code"
                  : register
                    ? "Create account"
                    : "Sign in"}
            </button>
            {pendingMfa ? (
              <p>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setPendingMfa(null);
                    setError("");
                  }}
                >
                  Back to sign in
                </button>
              </p>
            ) : (
              <p>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setRegister(!register);
                    setTouched({});
                    setMessage("");
                    setPendingMfa(null);
                    setShowPassword(false);
                    setError("");
                  }}
                >
                  {register
                    ? "Already registered? Sign in"
                    : "New client? Create an account"}
                </button>
              </p>
            )}
            {!register && (
              <p>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    setRecovering(true);
                    setPendingMfa(null);
                    setError("");
                    setMessage("");
                  }}
                >
                  Lost access? Use a recovery code
                </button>
              </p>
            )}
            <Link to="/privacy">Privacy notice</Link>
          </form>
        )}
      </div>
    </dialog>
  );
}
function authenticatorUri({ key, issuer, account }: AuthenticatorSetup) {
  const secret = key.replace(/\s/g, "");
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return (
    `otpauth://totp/${label}` +
    `?secret=${encodeURIComponent(secret)}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    "&algorithm=SHA1&digits=6&period=30"
  );
}
function AuthenticatorQrCode({ setup }: { setup: AuthenticatorSetup }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const uri = authenticatorUri(setup);
  useEffect(() => {
    let active = true;
    setDataUrl("");
    setFailed(false);
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(uri, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 224,
          color: {
            dark: "#171714",
            light: "#fcfaf8",
          },
        }),
      )
      .then((value) => {
        if (active) setDataUrl(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [uri]);
  return (
    <div className="mfa-qr-layout">
      <div className="mfa-qr-frame" aria-live="polite">
        {dataUrl ? (
          <img src={dataUrl} alt="Authenticator setup QR code" />
        ) : failed ? (
          <span>QR unavailable</span>
        ) : (
          <span>Preparing QR…</span>
        )}
      </div>
      <div>
        <p>
          Scan this QR code with Microsoft Authenticator, Google Authenticator
          or another TOTP app.
        </p>
        <details className="manual-secret">
          <summary>Enter the setup key manually</summary>
          <code className="secret-display">{setup.key}</code>
        </details>
      </div>
    </div>
  );
}
export function Profile() {
  const { user, reload } = useAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  if (!user) return <Loading label="Loading your account…" />;
  return (
    <section className="profile-page">
      <Link
        className="outline-button"
        to={
          user.roles.some((role) => ["Staff", "Admin"].includes(role))
            ? "/staff"
            : "/client"
        }
      >
        ← Return to your workspace
      </Link>
      <h1>Your account</h1>
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
      <div className="records-grid">
        <form
          className="detail-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/auth/profile", "PUT", {
                fullName: f.get("name"),
                email: user.email,
                password: "",
              });
              await reload();
              setMessage("Profile updated.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h2>Profile details</h2>
          <label>
            Full name
            <input
              name="name"
              defaultValue={user.fullName}
              required
              minLength={2}
              maxLength={160}
            />
          </label>
          <p>{user.email}</p>
          <button className="primary-button">Save profile</button>
        </form>
        <section className="detail-panel">
          <h2>Authenticator security</h2>
          <p>
            {user.twoFactorEnabled
              ? "MFA is enabled. You can remember this device for 7 days after verifying a sign-in."
              : user.roles.some((role) => ["Staff", "Admin"].includes(role))
                ? "Staff and administrator accounts must enable MFA to use the hosted workspace."
                : "Add an authenticator app for extra security. MFA is optional for client accounts."}
          </p>
          {user.twoFactorEnabled && (
            <button
              className="outline-button"
              onClick={async () => {
                try {
                  await api("/auth/mfa/forget-device", "POST");
                  setMessage(
                    "Device forgotten. Your next sign-in will require an authenticator code.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Forget this device
            </button>
          )}
          {!user.twoFactorEnabled && (
            <>
              <button
                className="outline-button"
                onClick={async () => {
                  try {
                    setSetup(
                      await api<AuthenticatorSetup>("/auth/mfa/setup", "POST"),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Set up authenticator
              </button>
              {setup && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const result = await api<RecoveryCodes>(
                        "/auth/mfa/enable",
                        "POST",
                        {
                          code: new FormData(e.currentTarget).get("code"),
                        },
                      );
                      setRecoveryCodes(result.recoveryCodes);
                      setSetup(null);
                      await reload();
                      setMessage("MFA enabled.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <AuthenticatorQrCode setup={setup} />
                  <label>
                    Six-digit code from your authenticator
                    <input
                      name="code"
                      required
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                    />
                  </label>
                  <button className="primary-button">Enable MFA</button>
                </form>
              )}
            </>
          )}
        </section>
        <RecoverySettings
          mfaEnabled={user.twoFactorEnabled}
          codes={recoveryCodes}
          setCodes={setRecoveryCodes}
        />
        <form
          className="detail-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/auth/password", "POST", {
                current: f.get("current"),
                new: f.get("new"),
              });
              location.href = "/signin";
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h2>Change password</h2>
          <label>
            Current password
            <input
              type="password"
              name="current"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="new"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <button className="primary-button">Change password & sign out</button>
        </form>
      </div>
    </section>
  );
}
