import { CalendarDays, History, Plus, Trophy } from "lucide-react";
import { formatTournamentDate, getTournamentStatusClasses } from "../../utils/tournamentDisplay";

// Displays current/draft events or finished Tournament history.
export default function TournamentEventNavigator({
  view,
  events,
  history,
  selectedTournamentId,
  onViewChange,
  onSelect,
  onCreate,
}) {
  const visibleEvents = view === "history" ? history : events;

  return (
    <aside className="self-start overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:sticky xl:top-0">
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--text-h)]">Tournament Events</h2>
            <p className="mt-1 text-xs text-[var(--text)]">Drafts, current play, and history</p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-[var(--surface-hover)] p-1">
          <button
            type="button"
            onClick={() => onViewChange("current")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "current" ? "bg-[var(--surface)] text-[var(--text-h)] shadow-sm" : "text-[var(--text)]"}`}
          >
            Current & Drafts
          </button>
          <button
            type="button"
            onClick={() => onViewChange("history")}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${view === "history" ? "bg-[var(--surface)] text-[var(--text-h)] shadow-sm" : "text-[var(--text)]"}`}
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </div>

      <div className="max-h-[35rem] space-y-2 overflow-y-auto p-3">
        {visibleEvents.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 text-sm font-medium text-[var(--text-h)]">
              {view === "history" ? "No finished Tournaments" : "No current Tournaments"}
            </p>
            <p className="mt-1 text-xs text-[var(--text)]">
              {view === "history" ? "Finished events will remain available here." : "Create a draft Tournament to begin."}
            </p>
          </div>
        ) : visibleEvents.map((tournament) => {
          const selected = Number(tournament.id) === Number(selectedTournamentId);
          return (
            <button
              key={tournament.id}
              type="button"
              onClick={() => onSelect(tournament.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-[var(--primary)] bg-[var(--primary-light)]/50" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-h)]">
                  {tournament.name}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${getTournamentStatusClasses(tournament.status)}`}>
                  {tournament.status}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text)]">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{formatTournamentDate(tournament.startDate)} - {formatTournamentDate(tournament.endDate)}</span>
              </div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">
                {tournament.configurationCount} configurations · {tournament.finishedMatchCount}/{tournament.matchCount} matches finished
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
