import { useState, type FormEvent } from "react";
import { api, useQuery, money, date } from "../../shared/api";
import {
  QueryError,
  ErrorMessage,
  Loading,
  Empty,
  Action,
} from "../../shared/ui";
type Budget = {
  id: string;
  version: string;
  description: string;
  amount: number;
  published: boolean;
};
type Invoice = Budget & { number: string; paid: number; dueAt: string };
type Finance = {
  contractValue: number;
  budgets: Budget[];
  invoices: Invoice[];
  budgetTotal: number;
  invoiced: number;
  paid: number;
  outstanding: number;
};
export default function FinancePanel({
  id,
  staff = false,
}: {
  id: string;
  staff?: boolean;
}) {
  const q = useQuery<Finance>(`/projects/${id}/finance`);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Invoice>();
  const [budgetEdit, setBudgetEdit] = useState<Budget>();
  const [busy, setBusy] = useState(false);
  if (q.loading) return <Loading label="Loading financial records…" />;
  if (q.error) return <QueryError message={q.error} retry={q.reload} />;
  if (!q.data) return null;
  const f = q.data;
  async function save(e: FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      !window.confirm(
        "Save this finance record with the values and client visibility shown?",
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/projects/${id}/finance/${kind}`, "POST", {
        ...(kind === "invoices"
          ? {
              id: edit?.id,
              version: edit?.version ?? "00000000-0000-0000-0000-000000000000",
              number: form.get("number"),
              paid: Number(form.get("paid")),
              dueAt: new Date(String(form.get("due"))).toISOString(),
            }
          : {
              id: budgetEdit?.id,
              version:
                budgetEdit?.version ?? "00000000-0000-0000-0000-000000000000",
            }),
        description: form.get("description"),
        amount: Number(form.get("amount")),
        published: form.get("published") === "on",
      });
      setEdit(undefined);
      setBudgetEdit(undefined);
      setError("");
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="finance-cards">
        {[
          ["Contract value", f.contractValue],
          ["Published budget", f.budgetTotal],
          ["Invoiced", f.invoiced],
          ["Outstanding", f.outstanding],
        ].map(([label, value]) => (
          <section className="finance-summary" key={label}>
            <span>{label}</span>
            <strong>{money(Number(value))}</strong>
          </section>
        ))}
      </div>
      <p>
        Recorded payments: {money(f.paid)}. This portal records invoices and
        payments; it does not process online payments.
      </p>
      <ErrorMessage message={error || q.error} />
      <section className="list-panel">
        <h2>Budget breakdown</h2>
        {f.budgets.map((b) => (
          <div className="file-row" key={b.id}>
            <strong>{b.description}</strong>
            <span>{money(b.amount)}</span>
            {staff && (
              <button
                className="outline-button"
                onClick={() => setBudgetEdit(b)}
              >
                Edit budget
              </button>
            )}
            {staff && (
              <Action
                confirmation={`${b.published ? "Hide" : "Publish"} this budget item for the client?`}
                onClick={async () => {
                  await api(`/projects/${id}/finance/budgets`, "POST", {
                    ...b,
                    published: !b.published,
                  });
                  q.reload();
                }}
              >
                {b.published ? "Unpublish" : "Publish"}
              </Action>
            )}
          </div>
        ))}
        {!f.budgets.length && (
          <Empty>No approved budget items are available.</Empty>
        )}
      </section>
      <section className="list-panel">
        <h2>Invoices</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Description</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                {staff && <th>Manage</th>}
              </tr>
            </thead>
            <tbody>
              {f.invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.number}</td>
                  <td>{i.description}</td>
                  <td>{date(i.dueAt)}</td>
                  <td>{money(i.amount)}</td>
                  <td>{money(i.paid)}</td>
                  <td>
                    {!i.published
                      ? "Unpublished"
                      : i.paid === i.amount
                        ? "Paid"
                        : i.paid > 0
                          ? "Part paid"
                          : "Due"}
                  </td>
                  {staff && (
                    <td>
                      <button
                        className="outline-button"
                        onClick={() => setEdit(i)}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!f.invoices.length && <Empty>No invoices have been published.</Empty>}
      </section>
      {staff && (
        <div className="records-grid">
          <form
            key={budgetEdit?.id ?? "new-budget"}
            className="detail-panel"
            onSubmit={(e) => save(e, "budgets")}
          >
            <h3>{budgetEdit ? "Edit budget item" : "Add budget item"}</h3>
            <label>
              Description
              <input
                name="description"
                defaultValue={budgetEdit?.description}
                required
                minLength={3}
                maxLength={500}
              />
            </label>
            <label>
              Amount (ZAR)
              <input
                name="amount"
                defaultValue={budgetEdit?.amount}
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                required
              />
            </label>
            <label className="check-label">
              <input
                name="published"
                type="checkbox"
                defaultChecked={budgetEdit?.published}
              />
              Visible to client
            </label>
            <button
              className="primary-button"
              disabled={busy || q.loading || !!q.error}
            >
              Save budget item
            </button>
            {budgetEdit && (
              <button
                type="button"
                className="outline-button"
                onClick={() => setBudgetEdit(undefined)}
              >
                Cancel budget edit
              </button>
            )}
          </form>
          <form
            key={edit?.id ?? "new"}
            className="detail-panel"
            onSubmit={(e) => save(e, "invoices")}
          >
            <h3>{edit ? "Edit invoice" : "Add invoice"}</h3>
            <div className="field-grid">
              <label>
                Invoice number
                <input
                  name="number"
                  required
                  minLength={3}
                  maxLength={50}
                  defaultValue={edit?.number}
                />
              </label>
              <label>
                Due date
                <input
                  name="due"
                  type="date"
                  required
                  defaultValue={edit?.dueAt.slice(0, 10)}
                />
              </label>
            </div>
            <label>
              Description
              <input
                name="description"
                required
                minLength={3}
                maxLength={500}
                defaultValue={edit?.description}
              />
            </label>
            <div className="field-grid">
              <label>
                Amount (ZAR)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                  defaultValue={edit?.amount}
                />
              </label>
              <label>
                Paid (ZAR)
                <input
                  name="paid"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={edit?.paid ?? 0}
                />
              </label>
            </div>
            <label className="check-label">
              <input
                name="published"
                type="checkbox"
                defaultChecked={edit?.published}
              />
              Visible to client
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}>
                Save invoice
              </button>
              {edit && (
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => setEdit(undefined)}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
