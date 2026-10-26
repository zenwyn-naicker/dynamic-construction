import { useState, type FormEvent } from "react";
import { api, useQuery, date, money } from "../../shared/api";
import {
  QueryError,
  ErrorMessage,
  Loading,
  Empty,
  Action,
  Status,
} from "../../shared/ui";
import type { Project, Change, Milestone } from "../../shared/types";
export function ProjectDetail({
  id,
  staff = false,
  progress = false,
}: {
  id: string;
  staff?: boolean;
  progress?: boolean;
}) {
  const q = useQuery<Project>("/projects/" + id);
  const [error, setError] = useState("");
  const [editMilestone, setEditMilestone] = useState<Milestone>();
  if (q.loading) return <Loading label="Loading project…" />;
  if (q.error) return <QueryError message={q.error} retry={q.reload} />;
  if (!q.data) return null;
  const p = q.data;
  const done = p.milestones.filter((x) => x.complete).length;
  const percent = p.milestones.length
    ? Math.round((done / p.milestones.length) * 100)
    : 0;
  async function save(e: FormEvent<HTMLFormElement>, endpoint: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload =
      endpoint === "state"
        ? {
            version: p.version,
            status: f.get("status"),
            reason: f.get("reason"),
          }
        : endpoint === "milestones"
          ? {
              id: editMilestone?.id,
              version: p.version,
              title: f.get("title"),
              dueAt: new Date(String(f.get("due"))).toISOString(),
              complete: editMilestone?.complete ?? false,
              published: f.get("published") === "on",
            }
          : {
              message: f.get("message"),
              published: f.get("published") === "on",
            };
    setError("");
    try {
      await api(`/projects/${id}/${endpoint}`, "POST", payload);
      setEditMilestone(undefined);
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const transitions: Record<string, string[]> = {
    Planned: ["Active"],
    Active: ["On Hold", "At Risk", "Completed"],
    "On Hold": ["Active"],
    "At Risk": ["Active", "Completed"],
    Completed: ["Archived"],
  };
  return (
    <>
      <ErrorMessage message={error} />
      <div className={progress ? "workspace-grid" : "project-overview"}>
        <section className="project-status-card">
          <p className="eyebrow">{p.reference}</p>
          <h2>{p.name}</h2>
          <Status>{p.status}</Status>
          <p>{p.reason}</p>
          <strong>{percent}%</strong>
          <div className="progress-track">
            <span style={{ width: percent + "%" }} />
          </div>
          <p>
            {done} of {p.milestones.length} milestones complete
          </p>
          <p>Contract value {money(p.contractValue)}</p>
        </section>
        {progress && (
          <section className="timeline-panel">
            <h2>Project milestones</h2>
            {p.milestones.map((m) => (
              <div className="timeline-row" key={m.id}>
                <span>{m.complete ? "✓" : "○"}</span>
                <div>
                  <strong>{m.title}</strong>
                  <p>
                    {date(m.dueAt)} · {m.published ? "Published" : "Staff only"}
                  </p>
                  {staff && (
                    <button
                      className="outline-button"
                      onClick={() => setEditMilestone(m)}
                    >
                      Edit milestone
                    </button>
                  )}
                  {staff && (
                    <Action
                      onClick={async () => {
                        await api(`/projects/${id}/milestones`, "POST", {
                          ...m,
                          version: p.version,
                          complete: !m.complete,
                        });
                        q.reload();
                      }}
                    >
                      {m.complete ? "Mark incomplete" : "Complete milestone"}
                    </Action>
                  )}
                </div>
              </div>
            ))}
            {!p.milestones.length && (
              <p>No milestones have been published yet.</p>
            )}
          </section>
        )}
      </div>
      {progress && (
        <section className="timeline-panel">
          <h2>Site updates</h2>
          {p.updates.map((u) => (
            <article className="timeline-row" key={u.id}>
              <span>↗</span>
              <div>
                <strong>{date(u.createdAt)}</strong>
                <p>{u.message}</p>
              </div>
            </article>
          ))}
          {!p.updates.length && <p>No progress updates yet.</p>}
        </section>
      )}
      {staff && (
        <div className="records-grid">
          {!progress && transitions[p.status] && (
            <form className="detail-panel" onSubmit={(e) => save(e, "state")}>
              <h3>Project state</h3>
              <label>
                Next state
                <select name="status">
                  {transitions[p.status].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason / approved variance
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={2000}
                  required
                />
              </label>
              <button className="primary-button">Update project</button>
            </form>
          )}
          {progress && !["Completed", "Archived"].includes(p.status) && (
            <form
              key={editMilestone?.id ?? "new-milestone"}
              className="detail-panel"
              onSubmit={(e) => save(e, "milestones")}
            >
              <h3>{editMilestone ? "Edit milestone" : "Add milestone"}</h3>
              <label>
                Title
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={180}
                  defaultValue={editMilestone?.title}
                />
              </label>
              <label>
                Due date
                <input
                  name="due"
                  type="date"
                  required
                  defaultValue={editMilestone?.dueAt.slice(0, 10)}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={editMilestone?.published ?? true}
                />
                Visible to client
              </label>
              <button className="primary-button">Save milestone</button>
              {editMilestone && (
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setEditMilestone(undefined)}
                >
                  Cancel edit
                </button>
              )}
            </form>
          )}
          {progress && p.status !== "Archived" && (
            <form className="detail-panel" onSubmit={(e) => save(e, "updates")}>
              <h3>Post an update</h3>
              <label>
                Update
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <label className="check-label">
                <input type="checkbox" name="published" defaultChecked />
                Publish to client
              </label>
              <button className="primary-button">Save update</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
export function ChangeRequests({
  id,
  staff = false,
}: {
  id: string;
  staff?: boolean;
}) {
  const q = useQuery<Change[]>(`/projects/${id}/changes`);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const transitions: Record<string, string[]> = {
    Submitted: ["Under Review"],
    "Under Review": ["Approved", "Rejected"],
    Approved: ["Implemented"],
    Implemented: ["Closed"],
    Rejected: ["Closed"],
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/projects/${id}/changes`, "POST", { description });
      setDescription("");
      q.reload();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="detail-panel">
        <h2>Change requests</h2>
        <p>
          Propose a change and follow the recorded decision. Approved impacts do
          not automatically change your invoices.
        </p>
        <form onSubmit={submit}>
          <label>
            Describe the requested change
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={busy || q.loading || !!q.error}
          >
            {busy ? "Submitting…" : "Submit change request"}
          </button>
        </form>
        <ErrorMessage message={error} />
      </section>
      {q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : q.loading ? (
        <Loading label="Loading change requests…" />
      ) : q.data?.length ? (
        q.data.map((c) => (
          <section className="detail-panel" key={c.id + c.version}>
            <div className="list-header">
              <h3>{c.description}</h3>
              <Status>{c.status}</Status>
            </div>
            <p>{c.reason}</p>
            {c.decision && (
              <p>
                Decision: {c.decision} · Cost impact {money(c.costImpact)} ·
                Schedule {c.daysImpact} days
              </p>
            )}
            <details>
              <summary>Decision history</summary>
              {c.history.map((h) => (
                <p key={h.id}>
                  {date(h.createdAt)} · {h.status} · {h.reason}
                </p>
              ))}
            </details>
            {!staff && ["Submitted", "Under Review"].includes(c.status) && (
              <Action
                onClick={async () => {
                  await api(
                    `/projects/${id}/changes/${c.id}/decision`,
                    "POST",
                    {
                      version: c.version,
                      status: "Withdrawn",
                      reason: "Withdrawn by the client before a decision.",
                      costImpact: 0,
                      daysImpact: 0,
                    },
                  );
                  q.reload();
                }}
              >
                Withdraw request
              </Action>
            )}
            {staff && transitions[c.status] && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    await api(
                      `/projects/${id}/changes/${c.id}/decision`,
                      "POST",
                      {
                        version: c.version,
                        status: f.get("status"),
                        reason: f.get("reason"),
                        costImpact: Number(f.get("cost")),
                        daysImpact: Number(f.get("days")),
                      },
                    );
                    q.reload();
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <div className="field-grid">
                  <label>
                    Next state
                    <select name="status">
                      {transitions[c.status].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cost impact (ZAR)
                    <input
                      type="number"
                      name="cost"
                      step="0.01"
                      defaultValue={0}
                    />
                  </label>
                  <label>
                    Schedule impact (days)
                    <input type="number" name="days" defaultValue={0} />
                  </label>
                </div>
                <label>
                  Decision reason
                  <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                <button className="primary-button">Record decision</button>
              </form>
            )}
          </section>
        ))
      ) : (
        <Empty>Your project has no change requests.</Empty>
      )}
    </>
  );
}
export function ProjectFiles({
  id,
  staff = false,
}: {
  id: string;
  staff?: boolean;
}) {
  type FileRecord = {
    id: string;
    name: string;
    size: number;
    category: string;
    published: boolean;
    version: string;
  };
  const q = useQuery<FileRecord[]>(`/projects/${id}/files`);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="list-panel">
      <h2>Project documents & photographs</h2>
      <p>
        Plans, progress photographs and project records, securely stored
        together.
      </p>
      {staff && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("published", f.get("published") === "on" ? "true" : "false");
            setBusy(true);
            try {
              await api(`/projects/${id}/files`, "POST", f);
              setError("");
              q.reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field-grid">
            <label>
              File (PDF, PNG, JPEG; up to 10 MB)
              <input
                type="file"
                name="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
              />
            </label>
            <label>
              Category
              <select name="category">
                {["Document", "Photo", "Plan", "Invoice"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="check-label">
            <input name="published" type="checkbox" />
            Publish to client
          </label>
          <button
            className="primary-button"
            disabled={busy || q.loading || !!q.error}
          >
            {busy ? "Uploading…" : "Upload file"}
          </button>
        </form>
      )}
      <ErrorMessage message={error} />
      {q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : q.loading ? (
        <Loading label="Loading documents…" />
      ) : q.data?.length ? (
        q.data.map((f) => (
          <article className="file-row" key={f.id}>
            <div>
              <strong>{f.name}</strong>
              <p>
                {f.category} · {(f.size / 1024).toFixed(1)} KB ·{" "}
                {f.published ? "Published" : "Staff only"}
              </p>
            </div>
            <a
              className="outline-button"
              href={`/api/projects/${id}/files/${f.id}/download`}
            >
              Download
            </a>
            {staff && (
              <Action
                onClick={async () => {
                  await api(`/projects/${id}/files/${f.id}`, "PUT", {
                    version: f.version,
                    published: !f.published,
                  });
                  q.reload();
                }}
              >
                {f.published ? "Unpublish" : "Publish"}
              </Action>
            )}
          </article>
        ))
      ) : (
        <Empty>No documents have been shared yet.</Empty>
      )}
    </section>
  );
}
