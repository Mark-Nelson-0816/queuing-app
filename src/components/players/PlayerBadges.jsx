import { getLevelClasses, getLevelLabel } from "../../utils/playerLevel";

const STATUS_DETAILS = {
  available: {
    label: "Available",
    classes: "bg-[var(--success-light)] text-[var(--success)]",
  },
  assigned: {
    label: "Assigned",
    classes: "bg-[var(--warning-light)] text-[var(--warning)]",
  },
  playing: {
    label: "Playing",
    classes: "bg-[var(--primary-light)] text-[var(--primary)]",
  },
  done: {
    label: "Done",
    classes: "bg-[var(--surface-hover)] text-[var(--text)]",
  },
};

export function PlayerLevelBadge({ level }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(level)}`}>
      {getLevelLabel(level)}
    </span>
  );
}

export function PlayerStatusBadge({ status }) {
  const normalizedStatus = ["waiting", "finished"].includes(status)
    ? "available"
    : status;
  const details = STATUS_DETAILS[normalizedStatus] || {
    label: status || "Unknown",
    classes: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${details.classes}`}>
      {details.label}
    </span>
  );
}
