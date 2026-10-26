import { useEffect, useReducer, useRef, useState } from "react";
import { useInView } from "../quotes/hooks";

type Photo = { file: string; caption: string; alt: string };
type Project = {
  folder: string;
  title: string;
  description: string;
  photos: Photo[];
};

const PROJECTS: Project[] = [
  {
    folder: "gunite-pool",
    title: "Gunite pool",
    description:
      "A gunite swimming pool built on a sloping site, from excavation and bank retaining walls to the finished shell, paving and surrounds.",
    photos: [
      {
        file: "site-establishing.jpg",
        caption: "Site establishing",
        alt: "Pool excavation and site preparation on a sloping site",
      },
      {
        file: "bank-retaining.jpg",
        caption: "Bank retaining",
        alt: "Retaining blocks stepped up the bank beside the pool",
      },
      {
        file: "retaining-wall-and-pool.jpg",
        caption: "Retaining wall and pool",
        alt: "Retaining wall alongside the pool shell",
      },
      {
        file: "pool-finishing.jpg",
        caption: "Pool finishing",
        alt: "Pool filled with paving laid around it",
      },
      {
        file: "pool-almost-finished.jpg",
        caption: "Almost finished",
        alt: "Pool nearing completion with its surrounds",
      },
      {
        file: "pool-finished.jpg",
        caption: "Completed pool",
        alt: "Finished gunite pool with paving and a view over the valley",
      },
    ],
  },
  {
    folder: "herrwood-drive",
    title: "Herrwood Drive",
    description:
      "A residential build with masonry walls, structural steelwork for an elevated deck and timber decking, finished as an outdoor living space.",
    photos: [
      {
        file: "site-establishing.jpeg",
        caption: "Site establishing",
        alt: "Herrwood Drive site at the start of work",
      },
      {
        file: "building-up-walls.jpeg",
        caption: "Building up walls",
        alt: "Masonry walls being built up",
      },
      {
        file: "built-up-walls.jpeg",
        caption: "Built up walls",
        alt: "Completed masonry walls",
      },
      {
        file: "steel-work-for-deck.jpeg",
        caption: "Steel work for deck",
        alt: "Steel reinforcement laid for the elevated deck",
      },
      {
        file: "wooden-deck.jpeg",
        caption: "Wooden deck",
        alt: "Timber deck being installed",
      },
      {
        file: "completed.jpeg",
        caption: "Completed",
        alt: "Finished Herrwood Drive project",
      },
    ],
  },
  {
    folder: "newport-avenue",
    title: "Newport Avenue",
    description:
      "A renovation and extension with new steelwork, remodelled interior walls and aluminium sliding doors, giving the home a modern open layout.",
    photos: [
      {
        file: "site-establishing.jpeg",
        caption: "Site establishing",
        alt: "Newport Avenue site at the start of work",
      },
      {
        file: "steel-work.jpeg",
        caption: "Steel work",
        alt: "Steel reinforcement in the foundation trench",
      },
      {
        file: "interior-walls.jpeg",
        caption: "Interior walls",
        alt: "Interior walls with new sliding doors",
      },
      {
        file: "interior-extension.jpeg",
        caption: "Interior extension",
        alt: "Interior extension in progress",
      },
      {
        file: "fitting-aluminium.jpeg",
        caption: "Fitting aluminium",
        alt: "Aluminium sliding doors being fitted",
      },
      {
        file: "remodeled-walls.jpeg",
        caption: "Remodelled walls",
        alt: "Remodelled exterior walls with aluminium doors and windows",
      },
    ],
  },
  {
    folder: "ronaldo-road",
    title: "Ronaldo Road",
    description:
      "An entertainment area with face-brick walls, timber joinery, a built-in braai and polished concrete flooring.",
    photos: [
      {
        file: "brickwork.jpeg",
        caption: "Brickwork",
        alt: "Face-brick walls being built",
      },
      {
        file: "brick-wall.jpeg",
        caption: "Brick wall",
        alt: "Completed face-brick wall",
      },
      {
        file: "fitting-timber.jpeg",
        caption: "Fitting timber",
        alt: "Timber cabinet doors being fitted",
      },
      {
        file: "polished-concrete-floor.jpeg",
        caption: "Polished concrete floor",
        alt: "Polished concrete floor in front of the cabinets",
      },
      {
        file: "braai-area.jpeg",
        caption: "Braai area",
        alt: "Built-in braai area with timber doors",
      },
      {
        file: "almost-completed.jpeg",
        caption: "Almost completed",
        alt: "Entertainment area nearing completion",
      },
    ],
  },
];

const TICK_MS = 100;
const STAGE_MS = 1600;
const HOLD_MS = STAGE_MS * 2.2;
const HOVER_DELAY_MS = 250;

const source = (project: Project, photo: Photo) =>
  `/images/projects/${project.folder}/${photo.file}`;

type State = { active: number; stage: number; elapsed: number };
type Action =
  | { type: "tick"; holding: boolean }
  | { type: "project"; index: number }
  | { type: "stage"; stage: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "tick": {
      const last = PROJECTS[state.active].photos.length - 1;
      const elapsed = state.elapsed + TICK_MS;
      if (state.stage < last)
        return elapsed >= STAGE_MS
          ? { ...state, stage: state.stage + 1, elapsed: 0 }
          : { ...state, elapsed };
      if (action.holding) return state;
      return elapsed >= HOLD_MS
        ? { active: (state.active + 1) % PROJECTS.length, stage: 0, elapsed: 0 }
        : { ...state, elapsed };
    }
    case "project":
      return action.index === state.active
        ? state
        : { active: action.index, stage: 0, elapsed: 0 };
    case "stage":
      return { ...state, stage: action.stage, elapsed: 0 };
  }
}

export default function ProjectPanels() {
  const [{ active, stage, elapsed }, dispatch] = useReducer(reducer, {
    active: 0,
    stage: 0,
    elapsed: 0,
  });
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number>(undefined);
  const playing = useInView(root, 0.25) && !paused;

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    const next = PROJECTS[(active + 1) % PROJECTS.length];
    for (const photo of next.photos) new Image().src = source(next, photo);
  }, [active]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => dispatch({ type: "tick", holding: hovering }),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [playing, hovering]);

  function showProject(index: number) {
    const next = (index + PROJECTS.length) % PROJECTS.length;
    dispatch({ type: "project", index: next });
    setAnnouncement(
      `${PROJECTS[next].title}, project ${next + 1} of ${PROJECTS.length}`,
    );
  }

  function showStage(index: number) {
    dispatch({ type: "stage", stage: index });
    setAnnouncement(
      `Stage ${index + 1}: ${PROJECTS[active].photos[index].caption}`,
    );
  }

  return (
    <div
      className="project-panels"
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Project photographs"
    >
      <div
        className="project-panels-row"
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          window.clearTimeout(hoverTimer.current);
          setHovering(false);
        }}
      >
        {PROJECTS.map((project, index) => {
          const open = index === active;
          const last = project.photos.length - 1;
          const shown = open ? stage : last;
          return (
            <article
              key={project.folder}
              className={"project-panel" + (open ? " open" : "")}
              aria-roledescription="slide"
              aria-label={`${project.title}, ${index + 1} of ${PROJECTS.length}`}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setHovering(true);
                window.clearTimeout(hoverTimer.current);
                hoverTimer.current = window.setTimeout(
                  () => dispatch({ type: "project", index }),
                  HOVER_DELAY_MS,
                );
              }}
            >
              {project.photos.map((photo, photoIndex) =>
                open || photoIndex === last ? (
                  <img
                    key={photo.file}
                    className={photoIndex === shown ? "visible" : ""}
                    src={source(project, photo)}
                    alt={photoIndex === shown ? photo.alt : ""}
                    decoding="async"
                  />
                ) : null,
              )}
              <span className="project-panel-shade" aria-hidden="true" />
              <span className="project-panel-title" aria-hidden="true">
                {project.title}
              </span>
              {!open && (
                <button
                  type="button"
                  className="project-panel-select"
                  onClick={() => showProject(index)}
                  aria-label={`Show ${project.title}`}
                />
              )}
              <div
                className="project-panel-content"
                aria-hidden={!open}
                inert={!open}
              >
                <p className="project-panel-stage">
                  <b>
                    Stage {shown + 1} of {project.photos.length}
                  </b>
                  {project.photos[shown].caption}
                </p>
                <div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <div className="project-panel-stages">
                    {project.photos.map((photo, photoIndex) => {
                      const fill =
                        !open || photoIndex > stage
                          ? 0
                          : photoIndex < stage
                            ? 1
                            : Math.min(
                                1,
                                elapsed /
                                  (photoIndex === last ? HOLD_MS : STAGE_MS),
                              );
                      return (
                        <button
                          key={photo.file}
                          type="button"
                          onClick={() => showStage(photoIndex)}
                          aria-label={`Show stage ${photoIndex + 1}: ${photo.caption}`}
                          aria-current={
                            open && photoIndex === stage ? "step" : undefined
                          }
                        >
                          <span>
                            <span style={{ transform: `scaleX(${fill})` }} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="project-panels-footer">
        <p>
          Each project plays from its first stage to the finished build. Hover
          or tap a project to explore it.
        </p>
        <div className="project-panels-controls">
          <button
            type="button"
            onClick={() => showProject(active - 1)}
            aria-label="Previous project"
          >
            <Icon path="M15 6l-6 6 6 6" />
          </button>
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            aria-label={
              paused ? "Play project photographs" : "Pause project photographs"
            }
          >
            <Icon path={paused ? "M8 5.5v13l11-6.5z" : "M9 6v12M15 6v12"} />
          </button>
          <button
            type="button"
            onClick={() => showProject(active + 1)}
            aria-label="Next project"
          >
            <Icon path="M9 6l6 6-6 6" />
          </button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
