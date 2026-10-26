import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, useQuery, useDebounced, money, date } from "../../shared/api";
import {
  Action,
  QueryError,
  ErrorMessage,
  Loading,
  Empty,
  Status,
  Pagination,
} from "../../shared/ui";
import type { Quote, Client, Page } from "../../shared/types";
import { OTHER, projectType } from "../quotes/projectTypes";

const projectLabel = (type: string) => projectType(type)?.label ?? type;
export default function QuoteQueue() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const debouncedFilter = useDebounced(filter);
  const q = useQuery<Page<Quote>>(
    "/operations/quotes?page=" +
      page +
      "&search=" +
      encodeURIComponent(debouncedFilter) +
      (status ? "&status=" + encodeURIComponent(status) : ""),
  );
  const clients = useQuery<Client[]>("/operations/quotes/clients");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = q.data?.items ?? [];
  const quote = rows.find((x) => x.id === selected) ?? rows[0];
  async function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      await api(`/operations/quotes/${quote!.id}/decision`, "POST", {
        version: quote!.version,
        status: f.get("status"),
        reason: f.get("reason"),
        formalAmount: f.get("amount") ? Number(f.get("amount")) : null,
        validUntil: f.get("validUntil")
          ? new Date(String(f.get("validUntil"))).toISOString()
          : null,
        clientId: f.get("client") || null,
      });
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const transitions: Record<string, string[]> = {
    Submitted: ["Under Review"],
    "Under Review": ["Quoted", "Rejected"],
    Quoted: ["Accepted", "Declined", "Expired"],
  };
  return (
    <>
      <div className="portal-filters">
        <label>
          Search quotes
          <input
            placeholder="Reference, client or status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Quote status
          <select
            value={status}
            onChange={(e) => {
              setParams(e.target.value ? { status: e.target.value } : {});
              setPage(1);
              setSelected("");
            }}
          >
            <option value="">All statuses</option>
            {[
              "Submitted",
              "Under Review",
              "Quoted",
              "Accepted",
              "Rejected",
              "Declined",
              "Expired",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {q.error && <QueryError message={q.error} retry={q.reload} />}
      {q.loading && <Loading label="Loading quotes…" />}
      {!q.loading && !q.error && <Pagination data={q.data} onPage={setPage} />}
      {!q.loading && !q.error && q.data && !rows.length && (
        <Empty title="No matching quotes">
          Try a different reference, client name or status.
        </Empty>
      )}
      <div className="quote-queue-layout">
        <div className="queue-list">
          {rows.map((x) => (
            <button
              key={x.id}
              className={"queue-record " + (quote?.id === x.id ? "active" : "")}
              onClick={() => {
                setSelected(x.id);
                setError("");
              }}
            >
              <strong>{x.name}</strong>
              <small>{x.reference}</small>
              <span>
                {projectLabel(x.type)} ·{" "}
                {x.estimate === null ? "To be priced" : money(x.estimate)}
              </span>
              <Status>{x.status}</Status>
            </button>
          ))}
        </div>
        {quote && (
          <section
            className="quote-decision-panel"
            key={quote.id + quote.version}
          >
            <div className="decision-heading">
              <div>
                <p className="eyebrow">{quote.reference}</p>
                <h2>{quote.name}</h2>
              </div>
              <Status>{quote.status}</Status>
            </div>
            <h3>Project details</h3>
            <p>
              {quote.email} · {quote.phone}
            </p>
            <p>{quote.site}</p>
            <p>
              {quote.type === OTHER
                ? projectLabel(quote.type)
                : `${quote.type} · ${quote.length} × ${quote.width} m · ${quote.finish}`}
            </p>
            {quote.description && <p>{quote.description}</p>}
            <p>{quote.notes}</p>
            <div className="finance-summary">
              <span>Indicative estimate</span>
              <strong>
                {quote.estimate === null
                  ? "To be priced after assessment"
                  : money(quote.estimate)}
              </strong>
              <p>{quote.assumptions}</p>
            </div>
            {quote.formalAmount && (
              <p>
                Formal quote: {money(quote.formalAmount)} · valid until{" "}
                {date(quote.validUntil!)}
              </p>
            )}
            {quote.reason && <p>Latest recorded evidence: {quote.reason}</p>}
            {transitions[quote.status] && (
              <form onSubmit={decide}>
                <fieldset
                  disabled={
                    busy || q.loading || clients.loading || !!clients.error
                  }
                >
                  <h3>Record the next step</h3>
                  <label>
                    Outcome
                    <select name="status">
                      {transitions[quote.status].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  {quote.status === "Under Review" && (
                    <div className="field-grid">
                      <label>
                        Formal amount (ZAR)
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          max="100000000"
                          step="0.01"
                          defaultValue={quote.estimate ?? undefined}
                        />
                      </label>
                      <label>
                        Valid until
                        <input name="validUntil" type="date" />
                      </label>
                    </div>
                  )}
                  <label>
                    Verified client account
                    <select name="client" defaultValue={quote.clientId ?? ""}>
                      <option value="">Not yet associated</option>
                      {clients.data?.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.fullName} · {c.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="secure-note">
                    A verified client account is required before acceptance.
                    Verify identity/contact before linking. Record how
                    verification or acceptance was obtained below.
                  </p>
                  <label>
                    Reason / acceptance evidence
                    <textarea
                      name="reason"
                      required
                      minLength={5}
                      maxLength={2000}
                    />
                  </label>
                  <ErrorMessage message={error} />
                  <button className="primary-button">
                    {busy ? "Saving…" : "Save decision"}
                  </button>
                </fieldset>
                {clients.loading && (
                  <Loading label="Loading client accounts…" />
                )}
                {clients.error && (
                  <QueryError message={clients.error} retry={clients.reload} />
                )}
              </form>
            )}
            {quote.status === "Accepted" && (
              <Action
                className="primary-button"
                onClick={async () => {
                  const p = await api<{ reference: string; id: string }>(
                    `/operations/quotes/${quote.id}/project`,
                    "POST",
                    {
                      version: quote.version,
                      name: `${quote.name} · ${projectLabel(quote.type)}`,
                    },
                  );
                  setError("");
                  navigate(`/staff/projects/${p.id}`);
                }}
              >
                Create linked project
              </Action>
            )}
          </section>
        )}
      </div>
    </>
  );
}
