import { useRef, type KeyboardEvent } from "react";
import ProjectIcon from "./ProjectIcon";
import { PROJECT_TYPES, type ProjectTypeId } from "./projectTypes";

export default function TypePicker({
  value,
  onChange,
}: {
  value: ProjectTypeId;
  onChange: (type: ProjectTypeId) => void;
}) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  function move(event: KeyboardEvent, index: number) {
    const last = PROJECT_TYPES.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(PROJECT_TYPES[next].id);
    chips.current[next]?.focus();
  }
  return (
    <div className="type-picker" role="radiogroup" aria-label="Project type">
      {PROJECT_TYPES.map((type, index) => (
        <button
          key={type.id}
          ref={(element) => {
            chips.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={value === type.id}
          tabIndex={value === type.id ? 0 : -1}
          className="type-chip"
          onClick={() => onChange(type.id)}
          onKeyDown={(event) => move(event, index)}
        >
          <span className="type-chip-icon">
            <ProjectIcon type={type.id} />
          </span>
          {type.label}
        </button>
      ))}
    </div>
  );
}
