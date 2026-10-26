import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../identity/Auth";
import { api } from "../../shared/api";
import { ErrorMessage } from "../../shared/ui";
import type { Replay } from "./BuildDrawing";
import EstimateSummary from "./EstimateSummary";
import { updateDraft, useDraft } from "./draft";
import { prefersReducedMotion, useEstimate } from "./hooks";
import type { QuoteLocationState } from "./launch";
import {
  FINISH,
  initialSize,
  projectType,
  sizeError,
  type ProjectTypeId,
  type Size,
} from "./projectTypes";
import {
  DetailsStep,
  ProjectStep,
  ReviewStep,
  SuccessView,
  type Confirmation,
} from "./QuoteSteps";
import { contactErrors, descriptionError, type Contact } from "./validation";

const STEPS = ["Your project", "Your details", "Review"];
const EMPTY_CONTACT: Contact = {
  name: "",
  email: "",
  phone: "",
  site: "",
  notes: "",
  consent: false,
};

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const state = (location.state ?? {}) as QuoteLocationState;
  const draft = useDraft();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward");
  const [replay, setReplay] = useState<Replay>({ key: 0, from: 0 });
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [attempted, setAttempted] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [closing, setClosing] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>();
  const [submissionKey] = useState(() => crypto.randomUUID());
  const edited = useRef(new Set<keyof Contact>());
  const leaving = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const type = projectType(draft.type)!;
  const size = type.length
    ? (draft.sizes[type.id] ?? initialSize(type))
    : undefined;
  const sizeProblem = size ? sizeError(type, size) : "";
  const estimate = useEstimate(
    size && !sizeProblem
      ? {
          type: type.id,
          length: size.length,
          width: size.width,
          finish: FINISH,
        }
      : null,
  );
  const showErrors = attempted === step;

  // A link may name the project to start with.
  useLayoutEffect(() => {
    const requested = projectType(params.get("type"))?.id;
    if (requested) updateDraft({ type: requested });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = scrollbar + "px";
    return () => {
      leaving.current = true;
      dialog?.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const body = bodyRef.current;
    if (!content || !body) return;
    // Hide the scrollbar while the panel eases to its new height.
    let frame = 0;
    let settle = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        body.classList.add("resizing");
        window.clearTimeout(settle);
        settle = window.setTimeout(
          () => body.classList.remove("resizing"),
          360,
        );
        setContentHeight(content.offsetHeight);
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    dialogRef.current
      ?.querySelector<HTMLElement>(".qb-step h2")
      ?.focus({ preventScroll: true });
  }, [step, confirmation]);

  useEffect(() => {
    if (user)
      setContact((current) => ({
        ...current,
        name: edited.current.has("name") ? current.name : user.fullName,
        email: edited.current.has("email") ? current.email : user.email,
      }));
  }, [user?.id, user?.fullName, user?.email]);

  function go(next: number) {
    setDirection(next > step ? "forward" : "backward");
    setError("");
    setStep(next);
  }

  function chooseType(next: ProjectTypeId) {
    updateDraft({ type: next });
    setReplay((current) => ({ key: current.key + 1, from: 0 }));
    navigate(
      { search: "?type=" + encodeURIComponent(next) },
      { replace: true, state: location.state },
    );
  }

  function problemAt(at: number) {
    if (at === 1)
      return size
        ? !!sizeProblem || !estimate.current
        : !!descriptionError(draft.description);
    if (at === 2) return Object.keys(contactErrors(contact)).length > 0;
    return false;
  }

  function flagProblem() {
    requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        '.qb-step [aria-invalid="true"]',
      );
      target?.focus();
      if (target && !prefersReducedMotion())
        target.animate(
          ["0", "-6px", "5px", "-3px", "0"].map((x) => ({
            transform: `translateX(${x})`,
          })),
          { duration: 320, easing: "ease-out" },
        );
    });
  }

  async function next(event: FormEvent) {
    event.preventDefault();
    if (busy || closing) return;
    if (problemAt(step)) {
      setAttempted(step);
      flagProblem();
      return;
    }
    if (step < STEPS.length) return go(step + 1);
    const earlier = [1, 2].find(problemAt);
    if (earlier) {
      setAttempted(earlier);
      return go(earlier);
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<Confirmation>("/quotes", "POST", {
        submissionKey,
        type: type.id,
        length: size?.length ?? 0,
        width: size?.width ?? 0,
        finish: size ? FINISH : "",
        ...contact,
        description: size ? null : draft.description,
      });
      updateDraft(null);
      setDirection("forward");
      setConfirmation(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    leaving.current = true;
    if (state.backgroundLocation) navigate(-1);
    else navigate("/", { replace: true });
  }

  function close(force = false) {
    if (closing) return;
    if (!force && !confirmation && edited.current.size > 0) {
      setConfirmLeave(true);
      return;
    }
    setConfirmLeave(false);
    setClosing(true);
    window.setTimeout(leave, prefersReducedMotion() ? 0 : 240);
  }

  function dismissLeave() {
    setConfirmLeave(false);
    requestAnimationFrame(() => closeRef.current?.focus());
  }

  function updateContact<K extends keyof Contact>(key: K, value: Contact[K]) {
    edited.current.add(key);
    setContact((current) => ({ ...current, [key]: value }));
  }

  return (
    <dialog
      ref={dialogRef}
      className={"qb-dialog" + (closing ? " is-closing" : "")}
      aria-labelledby="qb-title"
      onKeyDown={(event) => {
        // Handling Esc here keeps it from becoming a close request, which
        // browsers only let a page refuse once in a row.
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (confirmLeave) dismissLeave();
        else close();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (confirmLeave) dismissLeave();
        else close();
      }}
      onClose={() => {
        if (!leaving.current) leave();
      }}
    >
      <header className="qb-header" inert={confirmLeave}>
        <div className="qb-header-row">
          <p className="qb-title">
            <span className="eyebrow" id="qb-title">
              INSTANT ESTIMATE
            </span>
            {!confirmation && (
              <span>
                Step {step} of {STEPS.length} · {STEPS[step - 1]}
              </span>
            )}
          </p>
          <button
            ref={closeRef}
            type="button"
            className="qb-close"
            aria-label="Close estimate"
            onClick={() => close()}
          >
            ×
          </button>
        </div>
        <ol className="qb-progress" aria-label="Progress">
          {STEPS.map((label, index) => {
            const at = index + 1;
            const done = !!confirmation || at < step;
            return (
              <li
                key={label}
                className={done ? "done" : at === step ? "current" : undefined}
              >
                {done && !confirmation ? (
                  <button type="button" onClick={() => go(at)}>
                    {label}
                  </button>
                ) : (
                  <span
                    aria-current={
                      at === step && !confirmation ? "step" : undefined
                    }
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </header>
      <form className="qb-form" onSubmit={next} noValidate inert={confirmLeave}>
        <div
          className="qb-body"
          ref={bodyRef}
          style={
            {
              "--qb-height": contentHeight ? contentHeight + "px" : undefined,
            } as CSSProperties
          }
        >
          <div className="qb-content" ref={contentRef}>
            <div
              key={confirmation ? "done" : step}
              className={"qb-step " + direction}
            >
              {confirmation ? (
                <SuccessView confirmation={confirmation} name={contact.name} />
              ) : step === 1 ? (
                <ProjectStep
                  type={type}
                  size={size}
                  description={draft.description}
                  replay={replay}
                  sizeProblem={sizeProblem}
                  descriptionProblem={
                    showErrors ? descriptionError(draft.description) : ""
                  }
                  onType={chooseType}
                  onSize={(next: Size) =>
                    updateDraft({ sizes: { ...draft.sizes, [type.id]: next } })
                  }
                  onDescription={(description) => updateDraft({ description })}
                />
              ) : step === 2 ? (
                <DetailsStep
                  contact={contact}
                  errors={showErrors ? contactErrors(contact) : {}}
                  onChange={updateContact}
                />
              ) : (
                <ReviewStep
                  type={type}
                  size={size ?? { length: 0, width: 0 }}
                  description={draft.description}
                  contact={contact}
                  onEdit={go}
                />
              )}
            </div>
            <ErrorMessage message={error} />
          </div>
        </div>
        <div className="qb-footer">
          {confirmation ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => close(true)}
            >
              Done
            </button>
          ) : (
            <>
              <EstimateSummary
                priced={!!size}
                sizeProblem={!!sizeProblem}
                estimate={estimate}
              />
              <div className="qb-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => go(step - 1)}
                  >
                    Back
                  </button>
                )}
                <button
                  className="primary-button"
                  disabled={busy || (!!size && !estimate.current)}
                >
                  {busy
                    ? "Sending…"
                    : step === STEPS.length
                      ? "Send request"
                      : "Continue"}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
      {confirmLeave && (
        <div
          className="qb-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="qb-confirm-title"
          aria-describedby="qb-confirm-text"
        >
          <div>
            <h3 id="qb-confirm-title">Leave without sending?</h3>
            <p id="qb-confirm-text">
              Your contact details will be cleared. Your project choices stay
              saved for this visit.
            </p>
            <div>
              <button
                type="button"
                className="primary-button"
                autoFocus
                onClick={dismissLeave}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="outline-button"
                onClick={() => close(true)}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
