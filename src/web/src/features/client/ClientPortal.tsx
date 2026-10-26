import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, money } from "../../shared/api";
import {
  Empty,
  QueryError,
  Loading,
  Status,
  Pagination,
} from "../../shared/ui";
import type { Project, Page } from "../../shared/types";
import {
  ProjectDetail,
  ProjectFiles,
  ChangeRequests,
} from "../operations/ProjectWorkspace";
import FinancePanel from "./FinancePanel";
import { useQuoteLinkState } from "../quotes/launch";
export function ProjectList({ staff = false }: { staff?: boolean }) {
  const [page, setPage] = useState(1);
  const quoteLinkState = useQuoteLinkState();
  const q = useQuery<Page<Project>>("/projects?page=" + page);
  if (q.loading) return <Loading label="Loading projects…" />;
  if (q.error) return <QueryError message={q.error} retry={q.reload} />;
  if (!q.data?.total)
    return (
      <Empty title="No projects yet">
        {staff
          ? "Accept a quote and create its linked project to begin."
          : "Your project will appear here once your team links your accepted quote."}
        <Link
          className="outline-button"
          to={staff ? "/staff/quotes" : "/quote"}
          state={staff ? undefined : quoteLinkState}
        >
          {staff ? "Review quote requests" : "Start an estimate"}
        </Link>
      </Empty>
    );
  return (
    <>
      <div className="portal-grid">
        <section className="project-status-card">
          <p className="eyebrow">YOUR PROJECTS, TOGETHER</p>
          <h2>
            {q.data?.total ?? 0} project{q.data?.total !== 1 ? "s" : ""}
          </h2>
          <p>
            Follow the latest progress, documents and decisions in one place.
          </p>
          <Link
            className="primary-button"
            to={staff ? "/staff/quotes" : "/quote"}
            state={staff ? undefined : quoteLinkState}
          >
            {staff ? "Review quote requests" : "Start a new estimate"}
          </Link>
        </section>
        <section className="list-panel">
          <h2>{staff ? "Project workspace" : "My projects"}</h2>
          {q.data.items.map((p) => (
            <Link
              className="project-list-row"
              key={p.id}
              to={`${staff ? "/staff" : "/client"}/projects/${p.id}`}
            >
              <div>
                <small>{p.reference}</small>
                <h3>{p.name}</h3>
                <p>
                  {p.progress}% complete · {money(p.contractValue)}
                </p>
              </div>
              <Status>{p.status}</Status>
              <span>→</span>
            </Link>
          ))}
        </section>
      </div>
      <Pagination data={q.data} onPage={setPage} />
    </>
  );
}
export function ProjectPage({ staff = false }: { staff?: boolean }) {
  const { id = "", tab = "overview" } = useParams();
  const base = `${staff ? "/staff" : "/client"}/projects/${id}`;
  return (
    <>
      <nav className="project-tabs" aria-label="Project sections">
        {[
          ["overview", "Overview"],
          ["progress", "Progress"],
          ["documents", "Documents"],
          ["finance", "Financials"],
          ["changes", "Change requests"],
        ].map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            to={base + "/" + key}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "documents" ? (
        <ProjectFiles key={id} id={id} staff={staff} />
      ) : tab === "finance" ? (
        <FinancePanel key={id} id={id} staff={staff} />
      ) : tab === "changes" ? (
        <ChangeRequests key={id} id={id} staff={staff} />
      ) : (
        <ProjectDetail
          key={id + tab}
          id={id}
          staff={staff}
          progress={tab === "progress"}
        />
      )}
    </>
  );
}
