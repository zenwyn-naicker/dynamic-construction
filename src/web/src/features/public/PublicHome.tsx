import { useState } from "react";
import { date, useQuery } from "../../shared/api";
import { ErrorMessage, Loading, Pagination } from "../../shared/ui";
import type { Page, Portfolio } from "../../shared/types";
import ProjectIcon from "../quotes/ProjectIcon";
import QuoteCard from "../quotes/QuoteCard";
import { OTHER, type ProjectTypeId } from "../quotes/projectTypes";
import ProjectPanels from "./ProjectPanels";

type Content = { key: string; title: string; body: string };
const SERVICES: {
  key: string;
  type: ProjectTypeId;
  title: string;
  body: string;
}[] = [
  {
    key: "service-wall",
    type: "Boundary wall",
    title: "Boundary walls",
    body: "Plastered masonry walls on strip foundations, finished with an undercoat of paint.",
  },
  {
    key: "service-deck",
    type: "Deck",
    title: "Concrete decks",
    body: "Suspended concrete decks, reinforced with steel and cast 200\u00a0mm thick.",
  },
  {
    key: "service-pool",
    type: "Pool",
    title: "Gunite pools",
    body: "Gunite swimming pools with a marble plaster finish and a pool pump.",
  },
  {
    key: "service-room",
    type: "Room addition",
    title: "Room additions",
    body: "Extra living space from foundation to roof, with standard electrics and plumbing.",
  },
];

export default function PublicHome({
  quoteOpen,
  onStartQuote,
  onSignIn,
}: {
  quoteOpen: boolean;
  onStartQuote: (type?: ProjectTypeId) => void;
  onSignIn: () => void;
}) {
  const { data: content, error: contentError } =
    useQuery<Content[]>("/content");
  const [page, setPage] = useState(1);
  const portfolio = useQuery<Page<Portfolio>>("/portfolio?page=" + page);
  const projects = portfolio.data?.items ?? [];
  const [selectedId, setSelectedId] = useState("");
  const selectedPortfolio =
    projects.find((x) => x.id === selectedId) ?? projects[0];
  const hero = content?.find((c) => c.key === "hero");
  const services = content?.find((c) => c.key === "services");
  const contact = content?.find((c) => c.key === "contact");
  const [detail, setDetail] = useState(false);

  return (
    <>
      <ErrorMessage message={contentError} />
      <section className="hero">
        <div className="hero-copy">
          <div className="section-index">
            <b>BUILT AROUND YOU</b>
            <i />
          </div>
          <h1>{hero?.title ?? "Plan your project with confidence."}</h1>
          <p>
            {hero?.body ??
              "Get an indicative quote and track your construction work from one secure client portal."}
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => onStartQuote()}>
              Build my estimate
            </button>
            <button className="outline-button" onClick={onSignIn}>
              Open client portal
            </button>
          </div>
        </div>

        <QuoteCard paused={quoteOpen} onContinue={onStartQuote} />
      </section>

      <section className="services-section" id="services">
        <div className="section-heading">
          <div className="section-index">
            <b>WHAT WE BUILD</b>
            <i />
          </div>
          <h2>
            {services?.title ?? "Practical construction, carefully delivered."}
          </h2>
          <p>
            {services?.body ??
              "Clear scopes, dependable teams and a digital view of every milestone."}
          </p>
        </div>
        <div className="service-grid">
          {SERVICES.map((service) => {
            const entry = content?.find((x) => x.key === service.key);
            return (
              <article key={service.key}>
                <span className="service-icon">
                  <ProjectIcon type={service.type} />
                </span>
                <h3>{entry?.title ?? service.title}</h3>
                <p>{entry?.body ?? service.body}</p>
                <button onClick={() => onStartQuote(service.type)}>
                  Estimate this work
                </button>
              </article>
            );
          })}
        </div>
        <div className="service-other">
          <p>
            <strong>Planning something else?</strong> Describe it and we will
            price it after a site visit.
          </p>
          <button
            className="outline-button"
            onClick={() => onStartQuote(OTHER)}
          >
            Describe your project
          </button>
        </div>
      </section>

      <section className="projects-section" id="projects">
        <div className="section-heading portfolio-heading">
          <div className="section-index">
            <b>SELECTED WORK</b>
            <i />
          </div>
          <h2>Built details, shown clearly.</h2>
          <p>Explore our site photographs and published project details.</p>
        </div>
        <ProjectPanels />
        {portfolio.loading ? (
          <Loading label="Loading completed projects…" />
        ) : portfolio.error ? (
          <ErrorMessage message={portfolio.error} />
        ) : !selectedPortfolio ? null : (
          <>
            <div
              className="portfolio-tabs"
              role="tablist"
              aria-label="Portfolio projects"
            >
              {projects.map((project) => (
                <button
                  key={project.id}
                  role="tab"
                  id={"tab-" + project.id}
                  aria-controls="portfolio-detail"
                  tabIndex={selectedPortfolio.id === project.id ? 0 : -1}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const current = projects.findIndex(
                        (x) => x.id === project.id,
                      );
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? projects.length - 1
                            : (current +
                                (event.key === "ArrowRight"
                                  ? 1
                                  : projects.length - 1)) %
                              projects.length;
                      setSelectedId(projects[next].id);
                      setDetail(false);
                      (
                        event.currentTarget.parentElement?.children[
                          next
                        ] as HTMLButtonElement
                      )?.focus();
                    }
                  }}
                  aria-selected={selectedPortfolio.id === project.id}
                  className={
                    selectedPortfolio.id === project.id ? "active" : ""
                  }
                  onClick={() => {
                    setSelectedId(project.id);
                    setDetail(false);
                  }}
                >
                  <small>{project.location}</small>
                  <strong>{project.projectType}</strong>
                </button>
              ))}
            </div>
            <div
              className="project-feature"
              id="portfolio-detail"
              role="tabpanel"
              aria-labelledby={"tab-" + selectedPortfolio.id}
            >
              <div className="architecture-art" aria-hidden="true">
                <i />
                <b />
                <span />
              </div>
              <p className="eyebrow">
                FEATURED PROJECT · {selectedPortfolio.location}
              </p>
              <h2>{selectedPortfolio.title}</h2>
              <p>{selectedPortfolio.summary}</p>
              <dl>
                <div>
                  <dt>Project</dt>
                  <dd>{selectedPortfolio.projectType}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{selectedPortfolio.durationDays} days</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{date(selectedPortfolio.completedAt)}</dd>
                </div>
              </dl>
              <button
                className="project-detail-link"
                onClick={() => setDetail(!detail)}
              >
                {detail ? "Close project detail" : "View project detail"}
              </button>
              {detail && (
                <p className="detail-panel">{selectedPortfolio.details}</p>
              )}
            </div>
            <Pagination data={portfolio.data} onPage={setPage} />
          </>
        )}
      </section>

      <section className="process-section" id="process">
        <div className="section-index">
          <b>HOW IT WORKS</b>
          <i />
        </div>
        <h2>From idea to handover, without the guesswork.</h2>
        <div className="process-grid">
          {[
            [
              "1",
              "Build an estimate",
              "Select a project type and add a few practical details.",
            ],
            [
              "2",
              "Confirm the scope",
              "We review your request and arrange a site assessment.",
            ],
            [
              "3",
              "Follow the build",
              "Track progress, documents and decisions in your portal.",
            ],
            [
              "4",
              "Complete & hand over",
              "Review the final work and keep your records together.",
            ],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <button className="primary-button" onClick={() => onStartQuote()}>
          Start with a free estimate
        </button>
      </section>

      <section className="contact-section" id="contact">
        <div>
          <p className="eyebrow">START A CONVERSATION</p>
          <h2>
            {contact?.title ?? "Have a project that needs a closer look?"}
          </h2>
        </div>
        <div className="contact-copy">
          <p>
            {contact?.body ??
              "Begin with the guided estimate, or sign in to continue an existing project conversation."}
          </p>
          <div>
            <button className="primary-button" onClick={() => onStartQuote()}>
              Build an estimate
            </button>
            <button className="outline-button light" onClick={onSignIn}>
              Client sign in
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
