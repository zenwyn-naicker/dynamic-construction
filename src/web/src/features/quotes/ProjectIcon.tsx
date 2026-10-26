import type { ProjectTypeId } from "./projectTypes";

const PATHS: Record<ProjectTypeId, string> = {
  "Boundary wall":
    "M3 6h18v12H3z M3 10h18 M3 14h18 M9 6v4 M15 6v4 M6 10v4 M12 10v4 M18 10v4 M9 14v4 M15 14v4",
  Deck: "M3 8h18v7H3z M3 10.5h18 M3 13h18 M5.5 15v4 M18.5 15v4",
  Pool: "M3 5h18v14H3z M6 10.5q1.5-1.5 3 0t3 0t3 0t3 0 M6 14.5q1.5-1.5 3 0t3 0t3 0t3 0",
  "Room addition":
    "M2.5 11.5 8 6.5l5.5 5 M4 10.2V19h16.5v-6.5h-8 M12.5 10.2V19",
  Other: "M12 5v14 M5 12h14",
};

export default function ProjectIcon({ type }: { type: ProjectTypeId }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[type]} />
    </svg>
  );
}
