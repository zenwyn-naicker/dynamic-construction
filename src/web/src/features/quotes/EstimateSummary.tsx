import type { ReactNode } from "react";
import { money } from "../../shared/api";
import { useAnimatedNumber, useEstimate } from "./hooks";
import { squareMetres } from "./projectTypes";

export default function EstimateSummary({
  label = "Indicative estimate",
  priced,
  sizeProblem = false,
  estimate,
}: {
  label?: string;
  /** False for custom work, which is never priced online. */
  priced: boolean;
  sizeProblem?: boolean;
  estimate: ReturnType<typeof useEstimate>;
}) {
  const result = estimate.estimate;
  const total = result?.total ?? null;
  const shown = useAnimatedNumber(total ?? 0);
  // Messages sit in the same line box as an amount, so the height never changes.
  const note = (text: string) => <span className="qb-total-note">{text}</span>;
  let heading = label;
  let value: ReactNode;
  let detail = "";
  if (!priced) value = note("Priced after a site visit");
  else if (sizeProblem) value = note("Check the sizes");
  else if (estimate.error) {
    heading = "Estimate unavailable";
    value = (
      <button type="button" className="link-button" onClick={estimate.retry}>
        Retry estimate
      </button>
    );
  } else if (!result) value = note("Calculating…");
  else if (total === null) {
    value = note("Priced after a site visit");
    detail = "No online rate for this option yet";
  } else {
    value = money(Math.abs(shown - total) < 0.01 ? total : Math.round(shown));
    if (result.unitRate !== null)
      detail = `${squareMetres(result.area)} × ${money(result.unitRate)}/m²`;
  }
  return (
    <div className="qb-total" aria-busy={estimate.updating}>
      <small>{heading}</small>
      <strong>{value}</strong>
      <span className="qb-breakdown" aria-hidden={!detail}>
        {detail || "\u00a0"}
      </span>
      <span className="sr-only" aria-live="polite">
        {estimate.current && total !== null ? heading + " " + money(total) : ""}
      </span>
    </div>
  );
}
