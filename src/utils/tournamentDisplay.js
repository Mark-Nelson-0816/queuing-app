// Formats stored Tournament dates without applying a timezone offset.
export function formatTournamentDate(value) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

// Maps Tournament status to the application's existing badge colors.
export function getTournamentStatusClasses(status) {
  if (status === "ongoing") return "bg-[var(--primary-light)] text-[var(--primary)]";
  if (status === "finished") return "bg-[var(--success-light)] text-[var(--success)]";
  return "bg-[var(--warning-light)] text-[var(--warning)]";
}
