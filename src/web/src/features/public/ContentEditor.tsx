import { useState, type FormEvent } from "react";
import { api, useQuery } from "../../shared/api";
import { ErrorMessage, Loading, QueryError } from "../../shared/ui";
type Content = {
  key: string;
  title: string;
  body: string;
  published: boolean;
  version: string;
};
export default function ContentEditor() {
  const q = useQuery<Content[]>("/content/manage");
  const [key, setKey] = useState("hero");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  if (q.loading) return <Loading label="Loading public content…" />;
  if (q.error) return <QueryError message={q.error} retry={q.reload} />;
  const item = q.data?.find((x) => x.key === key);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setSaved("");
    setBusy(true);
    try {
      await api("/content/" + key, "PUT", {
        version: item?.version ?? "00000000-0000-0000-0000-000000000000",
        title: f.get("title"),
        body: f.get("body"),
        published: f.get("published") === "on",
      });
      setSaved(
        "Content saved. Published entries are now visible on the public site.",
      );
      q.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-panel">
      <h2>Public content</h2>
      <p>Publish changes to the public website.</p>
      <label>
        Content location
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSaved("");
          }}
        >
          {[
            "hero",
            "services",
            "service-wall",
            "service-deck",
            "service-pool",
            "service-room",
            "contact",
            "privacy",
          ].map((k) => (
            <option key={k} value={k}>
              {
                (
                  {
                    hero: "Homepage introduction",
                    services: "Services introduction",
                    "service-wall": "Boundary wall service",
                    "service-deck": "Deck service",
                    "service-pool": "Pool service",
                    "service-room": "Room addition service",
                    contact: "Contact information",
                    privacy: "Privacy notice",
                  } as Record<string, string>
                )[k]
              }
            </option>
          ))}
        </select>
      </label>
      <form key={key + (item?.version ?? "new")} onSubmit={save}>
        <label>
          Title
          <input
            name="title"
            required
            minLength={2}
            maxLength={180}
            defaultValue={item?.title}
          />
        </label>
        <label>
          Body
          <textarea
            name="body"
            required
            minLength={5}
            maxLength={3000}
            defaultValue={item?.body}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            name="published"
            defaultChecked={item?.published}
          />
          Publish on website
        </label>
        <ErrorMessage message={error || q.error} />
        <p role="status">{saved}</p>
        <button className="primary-button" disabled={busy}>
          {busy ? "Saving…" : "Save content"}
        </button>
      </form>
    </section>
  );
}
