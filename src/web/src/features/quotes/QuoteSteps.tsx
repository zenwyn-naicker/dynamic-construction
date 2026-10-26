import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { money } from "../../shared/api";
import BuildDrawing, { type Replay } from "./BuildDrawing";
import TypePicker from "./TypePicker";
import {
  OTHER,
  area,
  decimal,
  includesText,
  parseDecimal,
  sizeSummary,
  squareMetres,
  type Dimension,
  type ProjectType,
  type ProjectTypeId,
  type Size,
} from "./projectTypes";
import {
  DESCRIPTION_LIMITS,
  type Contact,
  type ContactErrors,
} from "./validation";

export type Confirmation = {
  reference: string;
  estimate: number | null;
  assumptions: string;
};

function StepHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      <h2 tabIndex={-1}>{title}</h2>
      {children && <p className="qb-lead">{children}</p>}
    </>
  );
}

function SizeInput({
  id,
  dimension,
  value,
  onChange,
}: {
  id: string;
  dimension: Dimension;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(decimal(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing && Number.isFinite(value)) setText(decimal(value));
  }, [value, editing]);
  const valid = Number.isFinite(value);
  const nudge = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key];
    if (!direction || !valid) return;
    event.preventDefault();
    const next =
      Math.round((value + direction * (event.shiftKey ? 1 : 0.1)) * 100) / 100;
    onChange(Math.min(dimension.max, Math.max(dimension.min, next)));
  };
  return (
    <div className="qb-dimension">
      <label htmlFor={id}>{dimension.label}</label>
      <span className="qb-number">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={
            !valid || value < dimension.min || value > dimension.max
          }
          aria-describedby="qb-size-error"
          value={text}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onKeyDown={nudge}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseDecimal(event.target.value));
          }}
        />
        <span aria-hidden="true">m</span>
      </span>
    </div>
  );
}

export function ProjectStep({
  type,
  size,
  description,
  replay,
  sizeProblem,
  descriptionProblem,
  onType,
  onSize,
  onDescription,
}: {
  type: ProjectType;
  size?: Size;
  description: string;
  replay: Replay;
  sizeProblem: string;
  descriptionProblem: string;
  onType: (type: ProjectTypeId) => void;
  onSize: (size: Size) => void;
  onDescription: (description: string) => void;
}) {
  return (
    <>
      <StepHeading title={type.question} />
      <TypePicker value={type.id} onChange={onType} />
      <div className="qb-project">
        <BuildDrawing
          type={type}
          size={size ?? { length: 0, width: 0 }}
          replay={replay}
          onSize={size && onSize}
        />
        {size ? (
          <div className="qb-controls">
            <div className="qb-dimensions">
              <SizeInput
                id="qb-length"
                dimension={type.length!}
                value={size.length}
                onChange={(length) => onSize({ ...size, length })}
              />
              <SizeInput
                id="qb-width"
                dimension={type.width!}
                value={size.width}
                onChange={(width) => onSize({ ...size, width })}
              />
            </div>
            {sizeProblem ? (
              <p
                className="field-error qb-area"
                id="qb-size-error"
                role="alert"
              >
                {sizeProblem}
              </p>
            ) : (
              <p className="qb-area" id="qb-size-error">
                {type.id === "Boundary wall" ? "Wall face" : "Area"}:{" "}
                <b>{squareMetres(area(size))}</b>
              </p>
            )}
            <p className="qb-includes">{includesText(type)}</p>
            <p className="qb-hint">
              Drag the handles on the drawing or type exact sizes. A rough guide
              is fine; we measure on site.
            </p>
          </div>
        ) : (
          <div className="qb-controls">
            <div className="qb-field">
              <label htmlFor="qb-description">What would you like built?</label>
              <textarea
                id="qb-description"
                rows={5}
                maxLength={DESCRIPTION_LIMITS.max}
                placeholder="For example: a 6 × 4 m concrete slab for a garden shed, with access from the driveway."
                aria-invalid={!!descriptionProblem}
                aria-describedby="qb-description-help"
                value={description}
                onChange={(event) => onDescription(event.target.value)}
              />
              <div className="qb-field-foot" id="qb-description-help">
                {descriptionProblem ? (
                  <span className="field-error" role="alert">
                    {descriptionProblem}
                  </span>
                ) : (
                  <span />
                )}
                <small>
                  {description.length} / {DESCRIPTION_LIMITS.max}
                </small>
              </div>
            </div>
            <p className="qb-note">
              Custom work has no online price. We will price it after a site
              assessment and send you a formal quotation.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

const CONTACT_FIELDS: {
  key: "name" | "email" | "phone" | "site";
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "email" | "tel";
  wide?: boolean;
}[] = [
  {
    key: "name",
    label: "Full name",
    type: "text",
    autoComplete: "name",
    wide: true,
  },
  {
    key: "email",
    label: "Email address",
    type: "email",
    autoComplete: "email",
    inputMode: "email",
  },
  {
    key: "phone",
    label: "Phone number",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
  },
  {
    key: "site",
    label: "Site address",
    type: "text",
    autoComplete: "street-address",
    wide: true,
  },
];

export function DetailsStep({
  contact,
  errors,
  onChange,
}: {
  contact: Contact;
  errors: ContactErrors;
  onChange: <K extends keyof Contact>(key: K, value: Contact[K]) => void;
}) {
  return (
    <>
      <StepHeading title="How can we reach you?">
        We will use these details to arrange a site assessment and prepare your
        formal quote.
      </StepHeading>
      <div className="qb-fields">
        {CONTACT_FIELDS.map((field) => (
          <div
            className={"qb-field" + (field.wide ? " wide" : "")}
            key={field.key}
          >
            <label htmlFor={"qb-" + field.key}>{field.label}</label>
            <input
              id={"qb-" + field.key}
              name={field.key}
              type={field.type}
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              maxLength={
                field.key === "site" ? 500 : field.key === "email" ? 254 : 160
              }
              aria-invalid={!!errors[field.key]}
              aria-describedby={
                errors[field.key] ? "qb-" + field.key + "-error" : undefined
              }
              value={contact[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            {errors[field.key] && (
              <span className="field-error" id={"qb-" + field.key + "-error"}>
                {errors[field.key]}
              </span>
            )}
          </div>
        ))}
        <div className="qb-field wide">
          <label htmlFor="qb-notes">
            Anything else we should know?{" "}
            <span className="optional">(optional)</span>
          </label>
          <textarea
            id="qb-notes"
            rows={3}
            maxLength={2000}
            placeholder="Access, timing, materials you like…"
            value={contact.notes}
            onChange={(event) => onChange("notes", event.target.value)}
          />
        </div>
      </div>
      <label className="check-label qb-consent">
        <input
          type="checkbox"
          checked={contact.consent}
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? "qb-consent-error" : undefined}
          onChange={(event) => onChange("consent", event.target.checked)}
        />
        <span>
          I agree to use of these details to prepare and manage my request.{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy notice
          </a>
        </span>
      </label>
      {errors.consent && (
        <span className="field-error" id="qb-consent-error">
          {errors.consent}
        </span>
      )}
    </>
  );
}

export function ReviewStep({
  type,
  size,
  description,
  contact,
  onEdit,
}: {
  type: ProjectType;
  size: Size;
  description: string;
  contact: Contact;
  onEdit: (step: number) => void;
}) {
  const rows: [string, ReactNode, number][] = [
    ["Project", type.label, 1],
    type.id === OTHER
      ? ["Description", description.trim(), 1]
      : ["Size", sizeSummary(type, size), 1],
    [
      "Contact",
      <>
        {contact.name.trim()}
        <br />
        {contact.email.trim()} · {contact.phone.trim()}
      </>,
      2,
    ],
    ["Site", contact.site.trim(), 2],
  ];
  if (contact.notes.trim()) rows.push(["Notes", contact.notes.trim(), 2]);
  return (
    <>
      <StepHeading title="Check and send.">
        Make sure everything looks right. You can change anything before you
        send it.
      </StepHeading>
      <dl className="qb-review">
        {rows.map(([label, value, step]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
            <button
              type="button"
              aria-label={"Edit " + label.toLowerCase()}
              onClick={() => onEdit(step)}
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      <p className="qb-disclaimer">
        Indicative estimates are non-binding and subject to a site assessment
        and a formal quotation.
      </p>
    </>
  );
}

export function SuccessView({
  confirmation,
  name,
}: {
  confirmation: Confirmation;
  name: string;
}) {
  const [copied, setCopied] = useState(false);
  const firstName = name.trim().split(/\s+/)[0];
  return (
    <div className="qb-success" role="status">
      <svg className="qb-success-mark" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="M16 27l7 7 14-15" />
      </svg>
      <h2 tabIndex={-1}>Request received.</h2>
      <p className="qb-lead">
        Thank you{firstName ? ", " + firstName : ""}. We will review your
        request and contact you to arrange a site assessment.
      </p>
      <div className="qb-reference">
        <span>Your reference</span>
        <strong>{confirmation.reference}</strong>
        <button
          type="button"
          className="link-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(confirmation.reference);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy reference"}
        </button>
      </div>
      <p className="qb-success-estimate">
        {confirmation.estimate === null
          ? "Your project will be priced after a site assessment."
          : `Indicative estimate: ${money(confirmation.estimate)}`}
      </p>
      <ol className="qb-next">
        <li>
          <b>01</b>We review your request
        </li>
        <li>
          <b>02</b>We arrange a site assessment
        </li>
        <li>
          <b>03</b>You receive a formal quote
        </li>
      </ol>
    </div>
  );
}
