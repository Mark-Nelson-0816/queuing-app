import { Search, UserCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import Modal from "../Modal";
import {
  PlayerLevelBadge,
} from "./PlayerBadges";
import {
  formatPlayerPreferences,
  genderLabel,
  rankPreferenceLabel,
} from "./playerDisplay";

// Selects an existing profile for today's active player list.
export default function RegisterPlayerToday({
  open,
  profiles,
  onClose,
  onRegistered,
}) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const submissionRef = useRef(false);

  // Keep unregistered and done profiles available for registration.
  const eligibleProfiles = useMemo(() => profiles.filter((player) => (
    !player.todayRegistration || player.todayRegistration.isDone
  )), [profiles]);

  // Filter eligible profiles by the operator's search and selections.
  const filteredProfiles = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return eligibleProfiles.filter((player) => (
      (!searchText || player.name.toLowerCase().includes(searchText))
      && (levelFilter === "all" || player.level === levelFilter)
      && (genderFilter === "all" || player.gender === genderFilter)
    ));
  }, [eligibleProfiles, genderFilter, levelFilter, search]);

  const selectedPlayer = eligibleProfiles.find((player) => player.id === selectedId);

  // Register or reactivate the selected profile for today.
  const handleRegister = async () => {
    if (!selectedPlayer || submissionRef.current) return;
    submissionRef.current = true;
    setIsRegistering(true);
    setError("");
    try {
      const result = await window.api.registerPlayer(selectedPlayer.id);
      if (!result?.success) {
        setError(result?.message || "Failed to register player today.");
        return;
      }
      await onRegistered?.(selectedPlayer, result.data);
      onClose?.();
    } catch (registerError) {
      setError(registerError instanceof Error
        ? registerError.message
        : "Failed to register player today.");
    } finally {
      submissionRef.current = false;
      setIsRegistering(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !isRegistering && onClose?.()}
      title="Register Player Today"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Registration instructions and errors */}
        <p className="text-sm text-[var(--text)]">
          Select an existing profile to add to today&apos;s player list.
        </p>

        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {/* Profile search and filters */}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_9rem]">
          <label className="relative">
            <span className="sr-only">Search profiles</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text)]" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search profiles..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            aria-label="Filter profiles by level"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
          >
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="upper_intermediate">Upper Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            value={genderFilter}
            onChange={(event) => setGenderFilter(event.target.value)}
            aria-label="Filter profiles by gender"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
          >
            <option value="all">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        {/* Eligible profiles */}
        <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {filteredProfiles.map((player) => {
            const isSelected = player.id === selectedId;
            const preferences = formatPlayerPreferences(player);
            return (
              <button
                type="button"
                key={player.id}
                onClick={() => setSelectedId(player.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary-light)]"
                    : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--text-h)]">{player.name}</span>
                      {player.todayRegistration?.isDone && (
                        <span className="rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]">
                          Reactivate
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text)]">
                      {genderLabel(player.gender)} · {rankPreferenceLabel(player.rankPreference)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text)]">
                      {preferences.length ? preferences.join(" · ") : "No match preferences"}
                    </p>
                  </div>
                  <PlayerLevelBadge level={player.level} />
                </div>
              </button>
            );
          })}

          {filteredProfiles.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
              <UserCheck className="mx-auto mb-2 h-7 w-7 text-[var(--text)]" />
              <p className="font-medium text-[var(--text-h)]">
                {eligibleProfiles.length === 0
                  ? "Every profile is already active today"
                  : "No eligible profiles match these filters"}
              </p>
              <p className="mt-1 text-sm text-[var(--text)]">
                Done players can be reactivated from this list.
              </p>
            </div>
          )}
        </div>

        {/* Registration actions */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--text)]">
            {filteredProfiles.length} eligible profile{filteredProfiles.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isRegistering}
              className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={!selectedPlayer || isRegistering}
              className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRegistering
                ? "Registering..."
                : selectedPlayer?.todayRegistration?.isDone ? "Reactivate Player" : "Register Player"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
