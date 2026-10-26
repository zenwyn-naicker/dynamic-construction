import { useLocation, useNavigate, type Location } from "react-router-dom";
import type { ProjectTypeId } from "./projectTypes";

export type QuoteLocationState = { backgroundLocation?: Location };

/** Opens the quote builder over the current page instead of replacing it. */
export function useQuoteLinkState(): QuoteLocationState {
  return { backgroundLocation: useLocation() };
}

export function useStartQuote() {
  const navigate = useNavigate();
  const state = useQuoteLinkState();
  return (type?: ProjectTypeId) =>
    navigate("/quote" + (type ? "?type=" + encodeURIComponent(type) : ""), {
      state,
    });
}
