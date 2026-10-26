import { Component, type ReactNode, useState } from "react";
import type { Page } from "./types";
export function Pagination({
  data,
  onPage,
}: {
  data?: Pick<Page<unknown>, "number" | "pageSize" | "total">;
  onPage: (page: number) => void;
}) {
  if (!data || data.total <= data.pageSize) return null;
  return (
    <nav className="pagination" aria-label="Record pages">
      <button
        className="outline-button"
        disabled={data.number <= 1}
        onClick={() => onPage(data.number - 1)}
      >
        Previous
      </button>
      <span role="status">
        Page {data.number} of{" "}
        {Math.max(1, Math.ceil(data.total / data.pageSize))} · {data.total}{" "}
        records
      </span>
      <button
        className="outline-button"
        disabled={data.number * data.pageSize >= data.total}
        onClick={() => onPage(data.number + 1)}
      >
        Next
      </button>
    </nav>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-panel" role="status">
      <span />
      {label}
    </div>
  );
}
export function Empty({
  children,
  title = "Nothing here yet.",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Status({ children }: { children: ReactNode }) {
  return <span className="status-pill">{children}</span>;
}
export function Action({
  children,
  onClick,
  className = "outline-button",
  confirmation,
}: {
  children: ReactNode;
  onClick: () => Promise<unknown>;
  className?: string;
  confirmation?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirmation && !window.confirm(confirmation)) return;
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </button>
      <ErrorMessage message={error} />
    </>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="states-page">
        <h1>Something went wrong.</h1>
        <p>Reload the application to try again.</p>
        <button className="primary-button" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function QueryError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="query-error">
      <ErrorMessage message={message} />
      <button className="outline-button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

export function RecordId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="record-id">
      <summary>
        {value.length > 16
          ? value.slice(0, 8) + "…" + value.slice(-4)
          : value || "—"}
      </summary>
      <span>{value}</span>
      <button
        className="link-button"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy full value"}
      </button>
    </details>
  );
}
