import { useEffect, useRef, useState, type CSSProperties } from "react";
import BuildDrawing, { type Replay } from "./BuildDrawing";
import EstimateSummary from "./EstimateSummary";
import TypePicker from "./TypePicker";
import { updateDraft, useDraft } from "./draft";
import { useEstimate, useInView } from "./hooks";
import {
  FINISH,
  decimal,
  includesText,
  initialSize,
  projectType,
  sizeError,
  type Dimension,
  type ProjectTypeId,
} from "./projectTypes";

function SizeSlider({
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
  const shown = Number.isFinite(value) ? value : dimension.initial;
  const [low, high] = dimension.range;
  const top = Math.max(high, shown);
  const position = Math.min(Math.max(shown, low), top);
  return (
    <div className="quote-card-size">
      <label htmlFor={id}>{dimension.label}</label>
      <input
        id={id}
        className="qb-range"
        type="range"
        min={low}
        max={top}
        step={0.1}
        value={position}
        aria-valuetext={`${decimal(shown)} metres`}
        style={
          {
            "--fill": ((position - low) / (top - low)) * 100 + "%",
          } as CSSProperties
        }
        onChange={(event) =>
          onChange(Math.round(Number(event.target.value) * 10) / 10)
        }
      />
      <output htmlFor={id}>{decimal(shown)} m</output>
    </div>
  );
}

/** The homepage starting point: pick, size and price a project, then continue in the builder. */
export default function QuoteCard({
  paused,
  onContinue,
}: {
  /** True while the builder is open over the page. */
  paused: boolean;
  onContinue: (type: ProjectTypeId) => void;
}) {
  const draft = useDraft();
  const type = projectType(draft.type)!;
  const size = type.length
    ? (draft.sizes[type.id] ?? initialSize(type))
    : undefined;
  const [replay, setReplay] = useState<Replay>({ key: 0, from: 0 });
  const card = useRef<HTMLElement>(null);
  const visible = useInView(card, 0.2);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (visible) setSeen(true);
  }, [visible]);
  const estimate = useEstimate(
    seen && !paused && size && !sizeError(type, size)
      ? {
          type: type.id,
          length: size.length,
          width: size.width,
          finish: FINISH,
        }
      : null,
  );

  return (
    <section
      className="quote-card"
      ref={card}
      aria-labelledby="quote-card-title"
    >
      <p className="quote-card-top">
        <span>INSTANT ESTIMATE</span>
        <span>No sign-up needed</span>
      </p>
      <h2 id="quote-card-title">What are you planning?</h2>
      <TypePicker
        value={type.id}
        onChange={(next) => {
          updateDraft({ type: next });
          setReplay((current) => ({ key: current.key + 1, from: 0 }));
        }}
      />
      <BuildDrawing
        type={type}
        size={size ?? { length: 0, width: 0 }}
        replay={replay}
        compact
        paused={paused}
      />
      {/* Every option fills the same space, so the card never changes height. */}
      <div className="quote-card-body">
        {size ? (
          <>
            <div className="quote-card-sizes">
              {(["length", "width"] as const).map((key) => (
                <SizeSlider
                  key={type.id + key}
                  id={"quote-card-" + key}
                  dimension={type[key]!}
                  value={size[key]}
                  onChange={(value) =>
                    updateDraft({
                      sizes: {
                        ...draft.sizes,
                        [type.id]: { ...size, [key]: value },
                      },
                    })
                  }
                />
              ))}
            </div>
            <p className="quote-card-includes">{includesText(type)}</p>
          </>
        ) : (
          <p className="quote-card-note">
            Describe what you have in mind next. We price custom work after a
            site visit.
          </p>
        )}
      </div>
      <div className="quote-card-foot">
        <EstimateSummary
          label="Your indicative estimate"
          priced={!!size}
          estimate={estimate}
        />
        <button
          type="button"
          className="primary-button"
          onClick={() => onContinue(type.id)}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
