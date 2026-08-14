import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Trash2, Trophy } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import RegisteredPlayers from "../components/tournament/RegisteredPlayers";
import TournamentConfigurationSummary from "../components/tournament/TournamentConfigurationSummary";
import TournamentEventNavigator from "../components/tournament/TournamentEventNavigator";
import TournamentMatchManagement from "../components/tournament/TournamentMatchManagement";
import TournamentOptions, {
  CATEGORY_LABELS,
  DIVISION_LABELS,
  LEVEL_LABELS,
} from "../components/tournament/TournamentOptions";
import {
  formatTournamentDate,
  getTournamentStatusClasses,
} from "../utils/tournamentDisplay";
import { validateTournamentSelection } from "../utils/tournamentSelection";
import { buildPlayingTournamentPlayerMap } from "../utils/tournamentMatchStatus";

const DEFAULT_OPTIONS = {
  divisions: ["adult", "u17", "u15", "u13", "u11", "u9"],
  levels: ["beginner", "intermediate", "upper_intermediate", "advanced"],
  matchTypes: ["singles", "doubles"],
  categories: ["mens", "womens", "mixed", "no_gender"],
  categoriesByMatchType: {
    singles: ["mens", "womens", "no_gender"],
    doubles: ["mens", "womens", "mixed", "no_gender"],
  },
};

// Returns a readable message from an unknown IPC error value.
function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Creates a stable key so each exact configuration keeps its own selection.
function getSelectionKey(tournamentId, division, matchType, category, level) {
  return [tournamentId, division, matchType, category, level].join(":");
}

// Provides today's local date for the create-event form.
function getTodayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Manages revised Tournament events and exact generated configurations.
export default function Tournament() {
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("current");
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [tournamentData, setTournamentData] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [division, setDivision] = useState("adult");
  const [matchType, setMatchType] = useState("doubles");
  const [category, setCategory] = useState("no_gender");
  const [level, setLevel] = useState("beginner");
  const [selections, setSelections] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [startingMatchId, setStartingMatchId] = useState(null);
  const [finishingMatchId, setFinishingMatchId] = useState(null);
  const [winnerSelection, setWinnerSelection] = useState(null);
  const [showFinishTournamentConfirm, setShowFinishTournamentConfirm] = useState(false);
  const [isFinishingTournament, setIsFinishingTournament] = useState(false);
  const [showDeleteTournamentConfirm, setShowDeleteTournamentConfirm] = useState(false);
  const [isDeletingTournament, setIsDeletingTournament] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetConfiguration, setResetConfiguration] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    startDate: getTodayValue(),
    endDate: getTodayValue(),
  });
  const [isCreating, setIsCreating] = useState(false);
  const generationLockRef = useRef(false);
  const resetLockRef = useRef(false);
  const createLockRef = useRef(false);
  const startMatchLockRef = useRef(false);
  const finishMatchLockRef = useRef(false);
  const finishTournamentLockRef = useRef(false);
  const deleteTournamentLockRef = useRef(false);

  // Applies a loaded event and opens its first existing configuration when present.
  const applyTournamentData = useCallback((data) => {
    setTournamentData(data);
    const firstConfiguration = data?.configurations?.[0];
    if (firstConfiguration) {
      setDivision(firstConfiguration.division);
      setMatchType(firstConfiguration.matchType);
      setCategory(firstConfiguration.category);
      setLevel(firstConfiguration.level);
    }
  }, []);

  // Loads one explicit event instead of relying on the obsolete latest-event API.
  const loadTournament = useCallback(async (tournamentId) => {
    if (!tournamentId) {
      setSelectedTournamentId(null);
      setTournamentData(null);
      return;
    }

    setIsEventLoading(true);
    setError("");
    try {
      const result = await window.api.getTournament(tournamentId);
      if (!result.success) throw new Error(result.message || "Failed to load Tournament.");
      setSelectedTournamentId(Number(tournamentId));
      applyTournamentData(result.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load Tournament."));
    } finally {
      setIsEventLoading(false);
    }
  }, [applyTournamentData]);

  // Refreshes lightweight current and history lists after each mutation.
  const refreshEventLists = useCallback(async () => {
    const [listResult, historyResult] = await Promise.all([
      window.api.listTournaments(),
      window.api.getTournamentHistory(),
    ]);
    if (!listResult.success) throw new Error(listResult.message || "Failed to list Tournaments.");
    if (!historyResult.success) throw new Error(historyResult.message || "Failed to load Tournament history.");
    setEvents(listResult.data.filter((event) => event.status !== "finished"));
    setHistory(historyResult.data);
    return { events: listResult.data, history: historyResult.data };
  }, []);

  // Loads event lists, permanent profiles, legal options, and current defaults once.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [listResult, historyResult, configurationResult, settings] = await Promise.all([
          window.api.listTournaments(),
          window.api.getTournamentHistory(),
          window.api.getTournamentConfigurationData(),
          window.api.getSettings().catch(() => ({})),
        ]);
        if (cancelled) return;
        if (!listResult.success) throw new Error(listResult.message || "Failed to list Tournaments.");
        if (!historyResult.success) throw new Error(historyResult.message || "Failed to load Tournament history.");
        if (!configurationResult.success) {
          throw new Error(configurationResult.message || "Failed to load Tournament player profiles.");
        }

        const currentEvents = listResult.data.filter((event) => event.status !== "finished");
        setEvents(currentEvents);
        setHistory(historyResult.data);
        setProfiles(configurationResult.data.players);
        setOptions(configurationResult.data.options);

        const defaultType = settings.defaultTournamentMatchType === "singles" ? "singles" : "doubles";
        const allowedCategories = configurationResult.data.options.categoriesByMatchType[defaultType];
        const defaultCategory = allowedCategories.includes(settings.defaultTournamentCategory)
          ? settings.defaultTournamentCategory
          : "no_gender";
        setMatchType(defaultType);
        setCategory(defaultCategory);

        const initialEvent = currentEvents.find((event) => event.status === "ongoing") || currentEvents[0];
        if (initialEvent) {
          const eventResult = await window.api.getTournament(initialEvent.id);
          if (cancelled) return;
          if (!eventResult.success) throw new Error(eventResult.message || "Failed to load Tournament.");
          setSelectedTournamentId(Number(initialEvent.id));
          applyTournamentData(eventResult.data);
        }
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, "Failed to load Tournament page."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [applyTournamentData]);

  const selectionKey = getSelectionKey(
    selectedTournamentId,
    division,
    matchType,
    category,
    level,
  );
  const selectedIds = useMemo(
    () => selections[selectionKey] || [],
    [selectionKey, selections],
  );

  // Updates only the selection belonging to the visible exact configuration.
  const setSelectedIds = useCallback((nextSelection) => {
    setSelections((current) => {
      const currentSelection = current[selectionKey] || [];
      const value = typeof nextSelection === "function"
        ? nextSelection(currentSelection)
        : nextSelection;
      return { ...current, [selectionKey]: value };
    });
  }, [selectionKey]);

  const existingConfiguration = useMemo(() => (
    tournamentData?.configurations.find((configuration) => (
      configuration.division === division
      && configuration.matchType === matchType
      && configuration.category === category
      && configuration.level === level
    )) || null
  ), [category, division, level, matchType, tournamentData]);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [Number(profile.id), profile])),
    [profiles],
  );
  const validation = useMemo(() => validateTournamentSelection(
    selectedIds,
    profileById,
    matchType,
    category,
  ), [category, matchType, profileById, selectedIds]);

  const isFinished = tournamentData?.tournament.status === "finished";
  const playingPlayerById = useMemo(
    () => buildPlayingTournamentPlayerMap(tournamentData?.configurations || []),
    [tournamentData],
  );

  // Keeps category valid when changing between Singles and Doubles.
  const handleMatchTypeChange = (nextMatchType) => {
    setMatchType(nextMatchType);
    const allowedCategories = options.categoriesByMatchType[nextMatchType] || [];
    if (!allowedCategories.includes(category)) setCategory("no_gender");
  };

  // Opens a generated configuration directly from its compact event index.
  const openConfiguration = (configuration) => {
    setDivision(configuration.division);
    setMatchType(configuration.matchType);
    setCategory(configuration.category);
    setLevel(configuration.level);
  };

  // Switches between editable events and immutable history.
  const handleViewChange = async (nextView) => {
    setView(nextView);
    const nextList = nextView === "history" ? history : events;
    await loadTournament(nextList[0]?.id || null);
  };

  // Creates a new draft event without generating any configuration automatically.
  const handleCreateTournament = async () => {
    if (createLockRef.current) return;
    const name = createForm.name.trim();
    if (!name) {
      setError("Tournament name is required.");
      return;
    }
    if (!createForm.startDate || !createForm.endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (createForm.startDate > createForm.endDate) {
      setError("Tournament start date must not be after its end date.");
      return;
    }

    createLockRef.current = true;
    setIsCreating(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.createTournament(
        name,
        createForm.startDate,
        createForm.endDate,
      );
      if (!result.success) throw new Error(result.message || "Failed to create Tournament.");
      setView("current");
      setSelectedTournamentId(Number(result.data.tournament.id));
      setTournamentData(result.data);
      await refreshEventLists();
      setShowCreateModal(false);
      setCreateForm({ name: "", startDate: getTodayValue(), endDate: getTodayValue() });
      setNotice("Draft Tournament created. Choose a configuration and select players.");
    } catch (createError) {
      setError(getErrorMessage(createError, "Failed to create Tournament."));
    } finally {
      createLockRef.current = false;
      setIsCreating(false);
    }
  };

  // Generates only the visible exact configuration with one guarded IPC call.
  const handleGenerateConfiguration = async () => {
    if (generationLockRef.current || !validation.ready || existingConfiguration) return;
    generationLockRef.current = true;
    setIsGenerating(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.generateTournamentConfiguration(
        selectedTournamentId,
        selectedIds,
        division,
        matchType,
        category,
        level,
      );
      if (!result.success) {
        throw new Error(result.message || "Failed to generate Tournament configuration.");
      }
      setTournamentData(result.data.tournament);
      if (result.data.configuration) {
        setDivision(result.data.configuration.division);
        setMatchType(result.data.configuration.matchType);
        setCategory(result.data.configuration.category);
        setLevel(result.data.configuration.level);
      }
      setSelections((current) => {
        const next = { ...current };
        delete next[selectionKey];
        return next;
      });
      await refreshEventLists();
      setNotice("Tournament teams, groups, and round-robin matches generated successfully.");
    } catch (generateError) {
      setError(getErrorMessage(generateError, "Failed to generate Tournament configuration."));
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
    }
  };

  // Resets exactly one confirmed configuration and keeps all others untouched.
  const handleResetConfiguration = async () => {
    if (resetLockRef.current || !resetConfiguration) return;
    resetLockRef.current = true;
    setIsResetting(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.resetTournamentConfiguration(resetConfiguration.id);
      if (!result.success) throw new Error(result.message || "Failed to reset Tournament configuration.");
      setTournamentData(result.data);
      await refreshEventLists();
      setResetConfiguration(null);
      setNotice("Configuration reset. Its courts were released; lifetime statistics were not reversed.");
    } catch (resetError) {
      setError(getErrorMessage(resetError, "Failed to reset Tournament configuration."));
    } finally {
      resetLockRef.current = false;
      setIsResetting(false);
    }
  };

  // Starts any administrator-selected waiting match on a currently available court.
  const handleStartMatch = async (matchId, courtId) => {
    if (startMatchLockRef.current) return;
    startMatchLockRef.current = true;
    setStartingMatchId(matchId);
    setError("");
    setNotice("");
    try {
      const result = await window.api.startTournamentMatch(matchId, courtId);
      if (!result.success) throw new Error(result.message || "Failed to start Tournament match.");
      setTournamentData(result.data);
      await refreshEventLists();
      const startedMatch = result.data.configurations
        .flatMap((configuration) => configuration.groups)
        .flatMap((group) => group.rounds)
        .flatMap((round) => round.matches)
        .find((match) => Number(match.id) === Number(matchId));
      setNotice(`Tournament match started on ${startedMatch?.court?.name || "the selected court"}.`);
    } catch (startError) {
      setError(getErrorMessage(startError, "Failed to start Tournament match."));
    } finally {
      startMatchLockRef.current = false;
      setStartingMatchId(null);
    }
  };

  // Saves a confirmed Team A or Team B winner and refreshes standings and courts.
  const handleFinishMatch = async () => {
    if (finishMatchLockRef.current || !winnerSelection) return;
    finishMatchLockRef.current = true;
    setFinishingMatchId(winnerSelection.match.id);
    setError("");
    setNotice("");
    try {
      const result = await window.api.finishTournamentMatch(
        winnerSelection.match.id,
        winnerSelection.team.id,
      );
      if (!result.success) throw new Error(result.message || "Failed to finish Tournament match.");
      setTournamentData(result.data);
      await refreshEventLists();
      setWinnerSelection(null);
      setNotice("Tournament winner saved and the court is available again.");
    } catch (finishError) {
      setError(getErrorMessage(finishError, "Failed to finish Tournament match."));
    } finally {
      finishMatchLockRef.current = false;
      setFinishingMatchId(null);
    }
  };

  // Performs the explicit event finish after every generated match is complete.
  const handleFinishTournament = async () => {
    if (finishTournamentLockRef.current || !selectedTournamentId) return;
    finishTournamentLockRef.current = true;
    setIsFinishingTournament(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.finishTournament(selectedTournamentId);
      if (!result.success) throw new Error(result.message || "Failed to finish Tournament.");
      setTournamentData(result.data);
      await refreshEventLists();
      setView("history");
      setShowFinishTournamentConfirm(false);
      setNotice("Tournament finished and moved to read-only history.");
    } catch (finishError) {
      setError(getErrorMessage(finishError, "Failed to finish Tournament."));
    } finally {
      finishTournamentLockRef.current = false;
      setIsFinishingTournament(false);
    }
  };

  // Permanently deletes one confirmed event and selects the next event in this view.
  const handleDeleteTournament = async () => {
    if (deleteTournamentLockRef.current || !selectedTournamentId) return;
    deleteTournamentLockRef.current = true;
    setIsDeletingTournament(true);
    setError("");
    setNotice("");
    try {
      const deletedTournamentId = Number(selectedTournamentId);
      const result = await window.api.deleteTournament(deletedTournamentId);
      if (!result.success) throw new Error(result.message || "Failed to delete Tournament.");

      const refreshed = await refreshEventLists();
      const nextList = view === "history"
        ? refreshed.history
        : refreshed.events.filter((event) => event.status !== "finished");
      setShowDeleteTournamentConfirm(false);
      setTournamentData(null);
      setSelectedTournamentId(null);
      setSelections((current) => {
        const next = {};
        const prefix = `${deletedTournamentId}:`;
        for (const [key, value] of Object.entries(current)) {
          if (!key.startsWith(prefix)) next[key] = value;
        }
        return next;
      });
      await loadTournament(nextList[0]?.id || null);
      setNotice("Tournament permanently deleted. Lifetime player statistics were preserved.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Failed to delete Tournament."));
    } finally {
      deleteTournamentLockRef.current = false;
      setIsDeletingTournament(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--text)]">
        Loading Tournament events and player profiles...
      </div>
    );
  }

  const tournament = tournamentData?.tournament;
  const summary = tournamentData?.summary;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex justify-between gap-4 rounded-xl bg-red-500 p-4 text-white">
          <p>{error}</p>
          <button type="button" className="font-bold" onClick={() => setError("")} aria-label="Dismiss error">X</button>
        </div>
      )}
      {notice && (
        <div className="flex justify-between gap-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] p-4 text-[var(--success)]">
          <p>{notice}</p>
          <button type="button" className="font-bold" onClick={() => setNotice("")} aria-label="Dismiss message">X</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <TournamentEventNavigator
          view={view}
          events={events}
          history={history}
          selectedTournamentId={selectedTournamentId}
          onViewChange={handleViewChange}
          onSelect={loadTournament}
          onCreate={() => setShowCreateModal(true)}
        />

        <main className="min-w-0 space-y-5">
          {isEventLoading ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--text)]">
              Loading Tournament...
            </div>
          ) : !tournament ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center">
              <Trophy className="mx-auto h-9 w-9 text-[var(--text)]" />
              <h2 className="mt-3 font-semibold text-[var(--text-h)]">Select or create a Tournament</h2>
              <p className="mt-1 text-sm text-[var(--text)]">
                Create a draft event, or open an existing event from the left.
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-[var(--text-h)]">{tournament.name}</h1>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getTournamentStatusClasses(tournament.status)}`}>
                        {tournament.status}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--text)]">
                      <CalendarDays className="h-4 w-4" />
                      {formatTournamentDate(tournament.startDate)} - {formatTournamentDate(tournament.endDate)}
                    </p>
                    {isFinished && (
                      <p className="mt-2 text-xs font-semibold text-[var(--text)]">
                        Finished Tournaments are read-only.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2">
                        <p className="font-bold text-[var(--text-h)]">{summary.totalConfigurations}</p>
                        <p className="text-[10px] text-[var(--text)]">Configurations</p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2">
                        <p className="font-bold text-[var(--text-h)]">{summary.totalTeams}</p>
                        <p className="text-[10px] text-[var(--text)]">Teams</p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2">
                        <p className="font-bold text-[var(--text-h)]">{summary.totalMatches}</p>
                        <p className="text-[10px] text-[var(--text)]">Matches</p>
                      </div>
                    </div>
                    {!isFinished && (
                      <div className="mt-3 text-right">
                        <button
                          type="button"
                          disabled={summary.waitingMatches > 0 || summary.playingMatches > 0}
                          onClick={() => setShowFinishTournamentConfirm(true)}
                          className="rounded-xl bg-green-500 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Finish Tournament
                        </button>
                        {(summary.waitingMatches > 0 || summary.playingMatches > 0) && (
                          <p className="mt-1 text-[10px] text-[var(--text)]">
                            Complete {summary.waitingMatches + summary.playingMatches} remaining matches first.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-3 text-right">
                      <button
                        type="button"
                        onClick={() => setShowDeleteTournamentConfirm(true)}
                        className="inline-flex bg-red-500 items-center gap-1.5 rounded-xl text-white px-4 py-2 text-xs font-semibold transition hover:bg-red-700"
                      >
                        Delete Tournament
                      </button>
                    </div>
                  </div>
                </div>

                {tournamentData.configurations.length > 0 && (
                  <div className="mt-5 border-t border-[var(--border)] pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
                      Existing Configurations
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tournamentData.configurations.map((configuration) => (
                        <button
                          key={configuration.id}
                          type="button"
                          onClick={() => openConfiguration(configuration)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs transition ${existingConfiguration?.id === configuration.id ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--surface-hover)]"}`}
                        >
                          <span className="font-semibold">{DIVISION_LABELS[configuration.division]}</span>
                          <span className="mx-1.5 text-[var(--text)]">·</span>
                          <span className="capitalize">{configuration.matchType}</span>
                          <span className="mx-1.5 text-[var(--text)]">·</span>
                          {CATEGORY_LABELS[configuration.category]}
                          <span className="mx-1.5 text-[var(--text)]">·</span>
                          {LEVEL_LABELS[configuration.level]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <TournamentOptions
                division={division}
                matchType={matchType}
                category={category}
                level={level}
                options={options}
                existingConfiguration={existingConfiguration}
                disabled={isFinished}
                onDivisionChange={setDivision}
                onMatchTypeChange={handleMatchTypeChange}
                onCategoryChange={setCategory}
                onLevelChange={setLevel}
              />

              {existingConfiguration ? (
                <>
                  <TournamentConfigurationSummary
                    configuration={existingConfiguration}
                    readOnly={isFinished}
                    isResetting={isResetting}
                    onReset={() => setResetConfiguration(existingConfiguration)}
                  />
                  <TournamentMatchManagement
                    key={`${existingConfiguration.id}:${isFinished ? "history" : "active"}`}
                    tournament={tournament}
                    configuration={existingConfiguration}
                    readOnly={isFinished}
                    startingMatchId={startingMatchId}
                    finishingMatchId={finishingMatchId}
                    playingPlayerById={playingPlayerById}
                    onStartMatch={handleStartMatch}
                    onSelectWinner={(match, team) => setWinnerSelection({ match, team })}
                  />
                </>
              ) : isFinished ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text)]">
                  Choose one of this Tournament&apos;s existing configurations above.
                </div>
              ) : (
                <RegisteredPlayers
                  players={profiles}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  level={level}
                  category={category}
                  matchType={matchType}
                  validation={validation}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerateConfiguration}
                />
              )}
            </>
          )}
        </main>
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => !isCreating && setShowCreateModal(false)}
        title="Create Tournament"
      >
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-[var(--text-h)]">
            <span>Tournament Name</span>
            <input
              value={createForm.name}
              maxLength={100}
              autoFocus
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Example: August Club Championship"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm font-medium text-[var(--text-h)]">
              <span>Start Date</span>
              <input
                type="date"
                value={createForm.startDate}
                onChange={(event) => setCreateForm((current) => ({ ...current, startDate: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-[var(--text-h)]">
              <span>End Date</span>
              <input
                type="date"
                value={createForm.endDate}
                min={createForm.startDate}
                onChange={(event) => setCreateForm((current) => ({ ...current, endDate: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <div className="rounded-xl bg-[var(--surface-hover)] p-3 text-xs text-[var(--text)]">
            The event starts as Draft. Teams and matches are created separately for each exact configuration.
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              disabled={isCreating}
              onClick={() => setShowCreateModal(false)}
              className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreateTournament}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Draft"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(resetConfiguration)}
        title="Reset Tournament Configuration"
        message="This removes every team, group, match, and saved result in this exact configuration and releases any courts it is using. Existing lifetime player statistics are NOT reversed. Other Tournament configurations remain unchanged. Continue?"
        confirmLabel={isResetting ? "Resetting..." : "Reset Configuration"}
        confirmDisabled={isResetting}
        onConfirm={handleResetConfiguration}
        onCancel={() => !isResetting && setResetConfiguration(null)}
      />

      <ConfirmDialog
        open={Boolean(winnerSelection)}
        title="Confirm Tournament Winner"
        message={winnerSelection
          ? `Save ${winnerSelection.team.players.map((player) => player.name).join(" / ")} as the winner? Finished match results cannot be changed.`
          : "Save this Tournament winner?"}
        confirmLabel={finishingMatchId ? "Saving Winner..." : "Confirm Winner"}
        variant="primary"
        confirmDisabled={Boolean(finishingMatchId)}
        onConfirm={handleFinishMatch}
        onCancel={() => !finishingMatchId && setWinnerSelection(null)}
      />

      <ConfirmDialog
        open={showDeleteTournamentConfirm}
        title="Permanently Delete Tournament"
        message="This permanently deletes the entire Tournament event, including every configuration, participant entry, team, group, match, and result. Any courts used by its playing matches will be safely released. Player profiles and lifetime statistics will NOT be deleted or reversed. This cannot be undone."
        confirmLabel={isDeletingTournament ? "Deleting..." : "Delete Tournament Permanently"}
        confirmDisabled={isDeletingTournament}
        onConfirm={handleDeleteTournament}
        onCancel={() => !isDeletingTournament && setShowDeleteTournamentConfirm(false)}
      />

      <ConfirmDialog
        open={showFinishTournamentConfirm}
        title="Finish Tournament"
        message="Mark this Tournament as finished? All configurations, groups, matches, standings, and results will become permanently read-only history."
        confirmLabel={isFinishingTournament ? "Finishing..." : "Finish Tournament"}
        variant="primary"
        confirmDisabled={isFinishingTournament}
        onConfirm={handleFinishTournament}
        onCancel={() => !isFinishingTournament && setShowFinishTournamentConfirm(false)}
      />
    </div>
  );
}
