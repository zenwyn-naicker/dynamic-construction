import { useState, type FormEvent } from "react";
import { api, useQuery } from "../../shared/api";
import { ErrorMessage, Loading, Pagination, QueryError } from "../../shared/ui";
import type { Page, Portfolio } from "../../shared/types";
import { FINISH, PROJECT_TYPES } from "../quotes/projectTypes";

const emptyVersion = "00000000-0000-0000-0000-000000000000";
type Rate = {
  type: string;
  finish: string;
  version: string;
  unitRate: number;
  assumptions: string;
  published: boolean;
};
// Every priced project type has one rate, stored under the standard finish.
const options = PROJECT_TYPES.filter((type) => type.length);
const finish = FINISH;
function Pricing() {
  const q = useQuery<Rate[]>("/pricing");
  const [option, setOption] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const type = options[option].id;
  const rate = q.data?.find((x) => x.type === type && x.finish === finish);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api("/pricing", "PUT", {
        type,
        finish,
        version: rate?.version ?? emptyVersion,
        unitRate: Number(f.get("unitRate")),
        assumptions: f.get("assumptions"),
        published: f.has("published"),
      });
      setSaved("Rate saved. Existing quote estimates remain unchanged.");
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-panel" id="pricing-editor">
      <h2>Estimate pricing</h2>
      <p>
        Publish approved rates per square metre. Each saved quote retains its
        rate version and assumptions.
      </p>
      <label>
        Priced project
        <select
          value={option}
          onChange={(e) => {
            setOption(Number(e.target.value));
            setSaved("");
          }}
        >
          {options.map((option, i) => (
            <option key={option.id} value={i}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {q.error ? (
        <QueryError message={q.error} retry={q.reload} />
      ) : q.loading ? (
        <Loading label="Loading rates…" />
      ) : (
        <form key={type + finish + rate?.version} onSubmit={save}>
          <label>
            Unit rate (ZAR / m²)
            <input
              name="unitRate"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              required
              defaultValue={rate?.unitRate}
            />
          </label>
          <label>
            Estimate assumptions
            <textarea
              name="assumptions"
              minLength={10}
              maxLength={2000}
              required
              defaultValue={rate?.assumptions}
            />
          </label>
          <label className="check-label">
            <input
              name="published"
              type="checkbox"
              defaultChecked={rate?.published}
            />
            Available for online estimates
          </label>
          <button className="primary-button" disabled={busy || !!q.error}>
            {busy ? "Saving…" : "Save rate"}
          </button>
        </form>
      )}
      <ErrorMessage message={error || q.error} />
      <p role="status">{saved}</p>
    </section>
  );
}
export default function PublicationManager() {
  const [page, setPage] = useState(1);
  const q = useQuery<Page<Portfolio>>("/portfolio/manage?page=" + page);
  const [selected, setSelected] = useState("");
  const entry = q.data?.items.find((x) => x.id === selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await api<Portfolio>("/portfolio", "POST", {
        id: entry?.id ?? null,
        version: entry?.version ?? emptyVersion,
        title: f.get("title"),
        location: f.get("location"),
        projectType: f.get("projectType"),
        summary: f.get("summary"),
        details: f.get("details"),
        completedAt: f.get("completedAt") + "T00:00:00Z",
        durationDays: Number(f.get("durationDays")),
        published: f.has("published"),
      });
      setPage(1);
      setSelected(result.id);
      setSaved("Portfolio entry saved.");
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <nav className="record-shortcuts" aria-label="Publication sections">
        <a className="outline-button" href="#pricing-editor">
          Pricing
        </a>
        <a className="outline-button" href="#portfolio-editor">
          Portfolio
        </a>
      </nav>
      <Pricing />
      <section className="detail-panel" id="portfolio-editor">
        <h2>Completed projects</h2>
        <p>
          Publish approved project information. Unpublish an entry to remove it
          from the public portfolio.
        </p>
        <label>
          Portfolio entry
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setSaved("");
            }}
          >
            <option value="">New entry</option>
            {q.data?.items.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
                {x.published ? "" : " (unpublished)"}
              </option>
            ))}
          </select>
        </label>
        <Pagination
          data={q.data}
          onPage={(p) => {
            setPage(p);
            setSelected("");
          }}
        />
        {q.error ? (
          <QueryError message={q.error} retry={q.reload} />
        ) : q.loading ? (
          <Loading label="Loading portfolio entries…" />
        ) : (
          <form
            className="portfolio-form"
            key={entry?.version ?? "new"}
            onSubmit={save}
          >
            {(
              [
                ["title", "Title", 3, 180],
                ["location", "Location", 2, 180],
                ["projectType", "Project type", 2, 100],
              ] as const
            ).map(([name, label, min, max]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  required
                  minLength={min}
                  maxLength={max}
                  defaultValue={entry?.[name]}
                />
              </label>
            ))}
            <label className="full-width">
              Summary
              <textarea
                name="summary"
                minLength={10}
                maxLength={1000}
                required
                defaultValue={entry?.summary}
              />
            </label>
            <label className="full-width">
              Project details
              <textarea
                name="details"
                minLength={10}
                maxLength={3000}
                required
                defaultValue={entry?.details}
              />
            </label>
            <div className="field-grid full-width">
              <label>
                Completion date
                <input
                  type="date"
                  name="completedAt"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  required
                  defaultValue={entry?.completedAt.slice(0, 10)}
                />
              </label>
              <label>
                Duration (days)
                <input
                  type="number"
                  name="durationDays"
                  min={1}
                  max={36500}
                  step={1}
                  required
                  defaultValue={entry?.durationDays}
                />
              </label>
            </div>
            <label className="check-label full-width">
              <input
                type="checkbox"
                name="published"
                defaultChecked={entry?.published}
              />
              Publish on website
            </label>
            <button className="primary-button" disabled={busy || !!q.error}>
              {busy ? "Saving…" : "Save portfolio entry"}
            </button>
          </form>
        )}
        <ErrorMessage message={error || q.error} />
        <p role="status">{saved}</p>
      </section>
    </>
  );
}
