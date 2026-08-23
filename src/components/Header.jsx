import { useEffect, useState } from "react";
import { Clock3, UserRound } from "lucide-react";

// Displays the current page title, time, date, and optional actions.
export default function Header({ title, actions }) {
  const [now, setNow] = useState(new Date());

  // Keep the operator clock current while the application is open.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-5 lg:px-6">

      {/* Current page title */}
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="hidden h-7 w-1 rounded-full bg-[var(--primary)] sm:block" />
        <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--text-h)]">
          {title}
        </h1>
      </div>

      {/* Clock, page actions, and operator badge */}
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        <div className="hidden h-8 w-px bg-[var(--border)] sm:block" />

        <div className="flex items-center gap-2 text-right" aria-label={`${dateStr}, ${timeStr}`}>
          <Clock3 aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <div>
            <p className="text-sm font-semibold leading-tight text-[var(--text-h)]">{timeStr}</p>
            <p className="hidden text-[11px] leading-tight text-[var(--text)] sm:block">{dateStr}</p>
          </div>
        </div>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]"
          aria-label="Operator"
          title="Operator"
        >
          <UserRound aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
    </header>
  );
}
