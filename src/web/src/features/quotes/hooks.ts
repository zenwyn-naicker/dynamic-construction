import { useEffect, useRef, useState, type RefObject } from "react";
import { api } from "../../shared/api";

export type EstimateInput = {
  type: string;
  length: number;
  width: number;
  finish: string;
};

export type Estimate = {
  total: number | null;
  area: number;
  unitRate: number | null;
  assumptions: string;
  rateVersion: string;
};

export const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Debounced, abortable estimate that keeps the last amount while refreshing. */
export function useEstimate(input: EstimateInput | null) {
  const inputKey = input
    ? JSON.stringify([input.type, input.length, input.width, input.finish])
    : "";
  const [estimate, setEstimate] = useState<Estimate>();
  const [estimatedKey, setEstimatedKey] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!input) {
      setUpdating(false);
      setError("");
      return;
    }
    let current = true;
    const controller = new AbortController();
    setUpdating(true);
    setError("");
    const timer = setTimeout(() => {
      api<Estimate>("/quotes/estimate", "POST", input, controller.signal)
        .then((result) => {
          if (!current) return;
          setEstimate(result);
          setEstimatedKey(inputKey);
          setError("");
          setUpdating(false);
        })
        .catch((e) => {
          if (!current) return;
          setError(e.message);
          setEstimatedKey("");
          setUpdating(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputKey, attempt]);
  return {
    estimate,
    current: !!input && !updating && estimatedKey === inputKey,
    updating: !!input && (updating || estimatedKey !== inputKey) && !error,
    error,
    retry: () => setAttempt((x) => x + 1),
  };
}

/** Whether the element is on screen, so work can wait until someone can see it. */
export function useInView(ref: RefObject<Element | null>, threshold = 0.35) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) return setVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return visible;
}

/** Eases a number towards its target for counters and drawings. */
export function useAnimatedNumber(target: number, duration = 450) {
  const [value, setValue] = useState(target);
  const latest = useRef(target);
  useEffect(() => {
    const from = latest.current;
    if (from === target || prefersReducedMotion()) {
      latest.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      latest.current = from + (target - from) * (1 - (1 - progress) ** 3);
      setValue(latest.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
