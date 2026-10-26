import { Link } from "react-router-dom";
import { useQuery, date } from "../../shared/api";
import { Empty, Loading, QueryError, Status } from "../../shared/ui";
import type { Page, Project, Quote } from "../../shared/types";
import { useQuoteLinkState } from "../quotes/launch";

function QuoteSummary({ status, title }: { status: string; title: string }) {
  const q = useQuery<Page<Quote>>(
    "/operations/quotes?status=" + encodeURIComponent(status),
  );
  return (
    <section className="detail-panel overview-metric">
      <h2>{title}</h2>
      {q.loading ? (
        <Loading label="Loading quote total…" />
      ) : q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : (
        <>
          <strong>{q.data?.total}</strong>
          <Link
            className="outline-button"
            to={"/staff/quotes?status=" + encodeURIComponent(status)}
          >
            View {status.toLowerCase()} quotes
          </Link>
        </>
      )}
    </section>
  );
}

function ClientUpdates({ id }: { id: string }) {
  const q = useQuery<Project>("/projects/" + id);
  if (q.loading) return <Loading label="Loading project updates…" />;
  if (q.error) return <QueryError message={q.error} retry={q.reload} />;
  if (!q.data) return null;
  const next = q.data.milestones.find((m) => !m.complete);
  return (
    <section className="detail-panel">
      <h2>Next milestone & recent updates</h2>
      <p>{q.data.name}</p>
      <p>
        {next
          ? `${next.title} · ${date(next.dueAt)}`
          : "No upcoming milestones have been published."}
      </p>
      {q.data.updates.slice(0, 3).map((u) => (
        <article key={u.id}>
          <p>
            <strong>{date(u.createdAt)}</strong>
            <br />
            {u.message}
          </p>
        </article>
      ))}
      {!q.data.updates.length && (
        <p>Site updates will appear here when your team publishes them.</p>
      )}
      <Link className="outline-button" to={`/client/projects/${id}/progress`}>
        View progress
      </Link>
    </section>
  );
}

export default function PortalOverview({ staff = false }: { staff?: boolean }) {
  const q = useQuery<Page<Project>>("/projects?page=1");
  const quoteLinkState = useQuoteLinkState();
  const base = staff ? "/staff" : "/client";
  const current =
    q.data?.items.find((p) => !["Completed", "Archived"].includes(p.status)) ??
    q.data?.items[0];
  return (
    <div className="overview-stack">
      {staff && (
        <div className="overview-metrics">
          <QuoteSummary status="Submitted" title="Awaiting review" />
          <QuoteSummary status="Under Review" title="Reviews in progress" />
          <QuoteSummary status="Accepted" title="Accepted quotes" />
        </div>
      )}
      {q.loading ? (
        <Loading label="Loading projects…" />
      ) : q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : !q.data?.total ? (
        <Empty title="No projects yet">
          <span>
            {staff
              ? "Review an accepted quote and create its linked project to begin."
              : "Start an estimate, then your team will link the accepted quote to your project. Progress, documents and financials will appear here."}
          </span>{" "}
          <Link
            className={staff ? "outline-button" : "primary-button"}
            to={staff ? "/staff/quotes?status=Accepted" : "/quote"}
            state={staff ? undefined : quoteLinkState}
          >
            {staff ? "View accepted quotes" : "Start an estimate"}
          </Link>
        </Empty>
      ) : (
        <section className="list-panel">
          <div className="section-heading">
            <div>
              <h2>{staff ? "Recent projects" : "Your projects"}</h2>
              <p>
                {q.data.total} project{q.data.total === 1 ? "" : "s"} in your
                workspace. Showing the latest {Math.min(5, q.data.items.length)}
                .
              </p>
            </div>
            <Link className="outline-button" to={base + "/projects"}>
              View all projects
            </Link>
          </div>
          {q.data.items.slice(0, 5).map((p) => (
            <Link
              className="project-list-row"
              key={p.id}
              to={`${base}/projects/${p.id}/overview`}
            >
              <div>
                <small>{p.reference}</small>
                <h3>{p.name}</h3>
                <p>{p.progress}% complete</p>
                <progress
                  value={p.progress}
                  max={100}
                  aria-label={p.name + " progress"}
                />
              </div>
              <Status>{p.status}</Status>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      )}
      {!staff && current && !q.loading && !q.error && (
        <ClientUpdates id={current.id} />
      )}
      {!staff && current && (
        <section className="detail-panel">
          <h2>Keep your build moving</h2>
          <p>
            Check messages from your team, review project documents and use
            change requests when your requirements change.
          </p>
          <Link className="outline-button" to="/client/notifications">
            Read your notifications
          </Link>
        </section>
      )}
    </div>
  );
}
