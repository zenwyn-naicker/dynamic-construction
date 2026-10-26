import { useState } from "react";
import { api, useQuery, useDebounced, date } from "../../shared/api";
import {
  Action,
  QueryError,
  RecordId,
  Empty,
  ErrorMessage,
  Loading,
  Status,
  Pagination,
} from "../../shared/ui";
import type { Client, Page } from "../../shared/types";
export function Notifications({ staff = false }: { staff?: boolean }) {
  type Note = {
    id: string;
    message: string;
    readAt: string | null;
    createdAt: string;
    projectId: string | null;
  };
  const [page, setPage] = useState(1);
  const q = useQuery<Page<Note>>("/notifications?page=" + page);
  const clients = useQuery<Client[]>(
    staff ? "/operations/quotes/clients" : null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  return (
    <>
      <ErrorMessage message={error} />
      {staff && (
        <form
          className="detail-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError("");
            setMessage("");
            setSending(true);
            try {
              await api("/notifications", "POST", {
                recipients,
                message: f.get("message"),
                projectId: null,
              });
              setMessage("Notification delivered to each selected recipient.");
              setRecipients([]);
              q.reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <h2>Send a client notification</h2>
          <fieldset disabled={sending || clients.loading || !!clients.error}>
            <legend>Recipients</legend>
            <label>
              Find a client
              <input
                type="search"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
              />
            </label>
            <p role="status">{recipients.length} selected · maximum 100</p>
            <div className="recipient-list">
              {clients.data
                ?.filter((c) =>
                  (c.fullName + " " + c.email)
                    .toLowerCase()
                    .includes(recipientSearch.toLowerCase()),
                )
                .map((c) => (
                  <label className="check-label" key={c.id}>
                    <input
                      type="checkbox"
                      checked={recipients.includes(c.id)}
                      disabled={
                        recipients.length >= 100 && !recipients.includes(c.id)
                      }
                      onChange={(e) =>
                        setRecipients((current) =>
                          e.target.checked
                            ? [...current, c.id]
                            : current.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span>
                      {c.fullName}
                      <small>{c.email}</small>
                    </span>
                  </label>
                ))}
              {!clients.loading &&
                !clients.error &&
                clients.data &&
                !clients.data.some((c) =>
                  (c.fullName + " " + c.email)
                    .toLowerCase()
                    .includes(recipientSearch.toLowerCase()),
                ) && <p>No matching clients.</p>}
            </div>
          </fieldset>
          {clients.loading && <Loading label="Loading client accounts…" />}
          {clients.error && (
            <QueryError message={clients.error} retry={clients.reload} />
          )}
          <label>
            Message
            <textarea name="message" required minLength={3} maxLength={2000} />
          </label>
          <button
            className="primary-button"
            disabled={
              sending ||
              clients.loading ||
              !!clients.error ||
              !recipients.length
            }
          >
            {sending ? "Sending…" : "Send notification"}
          </button>
          <p role="status">{message}</p>
        </form>
      )}
      <section className="list-panel">
        {staff && <h2>Your notifications</h2>}
        {q.error ? (
          <QueryError message={q.error} retry={q.reload} />
        ) : q.loading ? (
          <Loading label="Loading notifications…" />
        ) : q.data?.items.length ? (
          q.data.items.map((n) => (
            <article className="notification-row" key={n.id}>
              <i>{n.readAt ? "✓" : "•"}</i>
              <div>
                <p>{n.message}</p>
                <small>{date(n.createdAt)}</small>
                {n.projectId && (
                  <p>
                    <a
                      className="outline-button"
                      href={`${staff ? "/staff" : "/client"}/projects/${n.projectId}`}
                    >
                      Open project
                    </a>
                  </p>
                )}
              </div>
              {n.readAt ? (
                <Status>Read</Status>
              ) : (
                <Action
                  onClick={async () => {
                    await api(`/notifications/${n.id}/read`, "POST");
                    q.reload();
                  }}
                >
                  Acknowledge
                </Action>
              )}
            </article>
          ))
        ) : (
          <Empty title="No notifications yet">
            Messages about your projects will appear here.
          </Empty>
        )}
      </section>
      <Pagination data={q.data} onPage={setPage} />
    </>
  );
}
export function Users() {
  type U = Client & {
    suspended: boolean;
    roles: string[];
    concurrencyStamp: string;
  };
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const q = useQuery<Page<U>>(
    "/users?page=" + page + "&search=" + encodeURIComponent(debouncedSearch),
  );
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<U>();
  const [created, setCreated] = useState("");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <section className="list-panel">
        <h2>Account directory</h2>
        <label>
          Search accounts
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Pagination data={q.data} onPage={setPage} />
        <ErrorMessage message={error} />
        {q.error ? (
          <QueryError message={q.error} retry={q.reload} />
        ) : q.loading ? (
          <Loading label="Loading accounts…" />
        ) : q.data?.items.length === 0 ? (
          <Empty title="No matching accounts">
            Try another name or email address.
          </Empty>
        ) : (
          q.data?.items.map((u) => (
            <article className="user-record" key={u.id}>
              <div>
                <strong>{u.fullName}</strong>
                <p>{u.email}</p>
              </div>
              <Status>{u.roles.join(", ")}</Status>
              <Status>{u.suspended ? "Suspended" : "Active"}</Status>
              <button className="outline-button" onClick={() => setEditing(u)}>
                Edit name
              </button>
              <Action
                className={u.suspended ? "outline-button" : "danger-button"}
                confirmation={`${u.suspended ? "Reactivate" : "Suspend"} ${u.fullName}? Active sessions will be revoked.`}
                onClick={async () => {
                  await api("/users/" + u.id, "PUT", {
                    concurrencyStamp: u.concurrencyStamp,
                    fullName: u.fullName,
                    suspended: !u.suspended,
                  });
                  q.reload();
                }}
              >
                {u.suspended ? "Reactivate" : "Suspend"}
              </Action>
            </article>
          ))
        )}
      </section>
      {editing && (
        <form
          className="detail-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/users/" + editing.id, "PUT", {
                concurrencyStamp: editing.concurrencyStamp,
                fullName: f.get("fullName"),
                suspended: editing.suspended,
              });
              setEditing(undefined);
              q.reload();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h2>Edit {editing.email}</h2>
          <label>
            Full name
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={160}
              defaultValue={editing.fullName}
            />
          </label>
          <button className="primary-button" disabled={q.loading || !!q.error}>
            Save name
          </button>
          <button
            className="outline-button"
            type="button"
            onClick={() => setEditing(undefined)}
          >
            Cancel edit
          </button>
        </form>
      )}
      <form
        className="detail-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setCreating(true);
          setCreated("");
          setError("");
          try {
            await api("/users", "POST", {
              fullName: f.get("name"),
              email: f.get("email"),
              password: f.get("password"),
              role: f.get("role"),
            });
            q.reload();
            setError("");
            form.reset();
            setCreated("Account created successfully.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setCreating(false);
          }
        }}
      >
        <h2>Create account</h2>
        <div className="field-grid">
          <label>
            Full name
            <input name="name" required minLength={2} />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Temporary password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </label>
          <label>
            Role
            <select name="role">
              {["Client", "Staff", "Admin"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Provide credentials through an agreed secure channel. Privileged users
          must enrol MFA before production access.
        </p>
        <p role="status">{created}</p>
        <button
          className="primary-button"
          disabled={creating || q.loading || !!q.error}
        >
          {creating ? "Creating..." : "Create account"}
        </button>
      </form>
    </>
  );
}
export function Audit() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const q = useQuery<{
    total: number;
    items: {
      id: string;
      createdAt: string;
      actorId: string;
      action: string;
      entityId: string;
      reason: string;
      outcome: string;
    }[];
  }>(`/audit?search=${encodeURIComponent(debouncedSearch)}&page=${page}`);
  return (
    <section className="list-panel">
      <h2>Audit trail</h2>
      <p>Recorded actions are immutable through the application.</p>
      <label>
        Filter by action, entity or actor
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>

      {q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : q.loading ? (
        <Loading label="Loading audit records…" />
      ) : (
        <div className="table-scroll">
          <table className="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Reason</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6}>No matching audit records.</td>
                </tr>
              )}
              {q.data?.items.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.createdAt)}</td>
                  <td className="audit-action">{a.action}</td>
                  <td>
                    <RecordId value={a.entityId} />
                  </td>
                  <td>
                    <RecordId value={a.actorId} />
                  </td>
                  <td>{a.reason}</td>
                  <td>{a.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!q.loading && !q.error && q.data && (
        <div className="form-actions">
          <button
            className="outline-button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} · {q.data?.total ?? 0} records
          </span>
          <button
            className="outline-button"
            disabled={page * 50 >= (q.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
