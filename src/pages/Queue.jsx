import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import RotationMatches from "../components/rotation/RotationMatches";
import RotationPlayerPool from "../components/rotation/RotationPlayerPool";
import { getLevelClasses, getLevelLabel } from "../utils/playerLevel";
import {
  getPlayerConfigurationReason,
  playerFitsConfiguration,
} from "../utils/rotationUi";

const EMPTY_STATE = {
  players: [],
  locks: [],
  matches: [],
  summary: { waiting: 0, incomplete: 0, playing: 0, finished: 0 },
};

const ROTATION_DRAFT_KEY = "rotationQueueDraft";
const DEFAULT_ROTATION_DRAFT = {
  selectedPlayerIds: [],
  matchType: "doubles",
  category: "no_gender",
};

function loadRotationDraft() {
  try {
    const savedDraft = JSON.parse(sessionStorage.getItem(ROTATION_DRAFT_KEY) || "null");
    const matchType = ["singles", "doubles"].includes(savedDraft?.matchType)
      ? savedDraft.matchType
      : DEFAULT_ROTATION_DRAFT.matchType;
    const savedCategory = ["no_gender", "mens", "womens", "mixed"].includes(
      savedDraft?.category,
    )
      ? savedDraft.category
      : DEFAULT_ROTATION_DRAFT.category;
    const category = matchType === "singles" && savedCategory === "mixed"
      ? "no_gender"
      : savedCategory;
    const selectedPlayerIds = Array.isArray(savedDraft?.selectedPlayerIds)
      ? [...new Set(savedDraft.selectedPlayerIds.map(Number).filter((id) => (
        Number.isInteger(id) && id > 0
      )))]
      : [];
    return { selectedPlayerIds, matchType, category };
  } catch {
    return { ...DEFAULT_ROTATION_DRAFT };
  }
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function PlayerOption({ player }) {
  return (
    <option value={player.id}>
      {player.name} — {player.level}
    </option>
  );
}

export default function Queue() {
  const [initialDraft] = useState(loadRotationDraft);
  const [rotationState, setRotationState] = useState(EMPTY_STATE);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(
    initialDraft.selectedPlayerIds,
  );
  const [matchType, setMatchType] = useState(initialDraft.matchType);
  const [category, setCategory] = useState(initialDraft.category);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [lockActionId, setLockActionId] = useState(null);
  const [preferenceActionId, setPreferenceActionId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [unmatchedPlayers, setUnmatchedPlayers] = useState([]);

  const [startTarget, setStartTarget] = useState(null);
  const [availableCourts, setAvailableCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [isLoadingCourts, setIsLoadingCourts] = useState(false);
  const [courtError, setCourtError] = useState("");

  const [finishTarget, setFinishTarget] = useState(null);
  const [winnerTeam, setWinnerTeam] = useState(null);
  const [donePlayerIds, setDonePlayerIds] = useState([]);
  const [autoRequeue, setAutoRequeue] = useState(true);

  const [editTarget, setEditTarget] = useState(null);
  const [editTeamA, setEditTeamA] = useState([]);
  const [editTeamB, setEditTeamB] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [configurationChange, setConfigurationChange] = useState(null);

  const generationLockRef = useRef(false);
  const actionLockRef = useRef(false);
  const configurationRef = useRef({ matchType, category });

  useEffect(() => {
    sessionStorage.setItem(ROTATION_DRAFT_KEY, JSON.stringify({
      selectedPlayerIds,
      matchType,
      category,
    }));
  }, [selectedPlayerIds, matchType, category]);

  const applyState = useCallback((data) => {
    if (!data) return;
    setRotationState(data);
    const activeConfiguration = configurationRef.current;
    const eligibleIds = new Set(
      data.players
        .filter((player) => playerFitsConfiguration(
          player,
          activeConfiguration.matchType,
          activeConfiguration.category,
        ))
        .map((player) => player.id),
    );
    setSelectedPlayerIds((current) => current.filter((id) => eligibleIds.has(id)));
  }, []);

  const loadState = async ({ showLoading = false } = {}) => {
    if (showLoading) setIsLoading(true);
    try {
      const result = await window.api.getRotationState();
      if (!result.success) {
        setError(result.message || "Failed to load the rotation queue.");
        return false;
      }
      applyState(result.data);
      return true;
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load the rotation queue."));
      return false;
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      window.api.getRotationState(),
      window.api.getSettings(),
    ]).then(([stateRequest, settingsRequest]) => {
      if (cancelled) return;
      if (stateRequest.status === "fulfilled") {
        if (stateRequest.value.success) applyState(stateRequest.value.data);
        else setError(stateRequest.value.message || "Failed to load the rotation queue.");
      } else {
        setError(errorMessage(
          stateRequest.reason,
          "Failed to load the rotation queue.",
        ));
      }
      if (settingsRequest.status === "fulfilled") {
        setAutoRequeue(settingsRequest.value.autoRequeue !== "false");
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [applyState]);

  const applyConfiguration = (nextMatchType, nextCategory, removedPlayerIds = []) => {
    const removedIds = new Set(removedPlayerIds);
    configurationRef.current = { matchType: nextMatchType, category: nextCategory };
    setMatchType(nextMatchType);
    setCategory(nextCategory);
    if (removedIds.size > 0) {
      setSelectedPlayerIds((current) => current.filter((id) => !removedIds.has(id)));
      setNotice(`${removedIds.size} incompatible selected player${removedIds.size === 1 ? " was" : "s were"} removed.`);
    }
  };

  const requestConfigurationChange = (nextMatchType, nextCategory) => {
    const currentIds = new Set(selectedPlayerIds);
    const invalidPlayers = rotationState.players.filter((player) => (
      currentIds.has(player.id)
      && !playerFitsConfiguration(player, nextMatchType, nextCategory)
    ));
    if (invalidPlayers.length > 0) {
      setConfigurationChange({ nextMatchType, nextCategory, invalidPlayers });
      return;
    }
    applyConfiguration(nextMatchType, nextCategory);
  };

  const handleMatchTypeChange = (nextMatchType) => {
    const nextCategory = nextMatchType === "singles" && category === "mixed"
      ? "no_gender"
      : category;
    requestConfigurationChange(nextMatchType, nextCategory);
  };

  const handleCategoryChange = (nextCategory) => {
    requestConfigurationChange(matchType, nextCategory);
  };

  const handleGenerate = async () => {
    if (generationLockRef.current) return;
    generationLockRef.current = true;
    setIsGenerating(true);
    setError("");
    setNotice("");
    setWarnings([]);
    setUnmatchedPlayers([]);
    try {
      const result = await window.api.generateRotationMatches(
        selectedPlayerIds,
        matchType,
        category,
      );
      if (!result.success) {
        setError(result.message || "Failed to generate rotation matches.");
        return;
      }
      setWarnings(result.data.warnings || []);
      setUnmatchedPlayers(result.data.unmatchedPlayers || []);
      await loadState();
      setNotice(
        result.data.generatedCount > 0
          ? "Rotation matches generated and saved in queue order."
          : "No compatible complete matches were generated.",
      );
    } catch (generationError) {
      setError(errorMessage(generationError, "Failed to generate rotation matches."));
    } finally {
      generationLockRef.current = false;
      setIsGenerating(false);
    }
  };

  const runStateAction = async (key, request, successMessage) => {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setBusyAction(key);
    setError("");
    setNotice("");
    try {
      const result = await request();
      if (!result.success) {
        setError(result.message || "The rotation action failed.");
        return false;
      }
      applyState(result.data);
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError, "The rotation action failed."));
      return false;
    } finally {
      actionLockRef.current = false;
      setBusyAction(null);
    }
  };

  const handleCreateLock = async (firstPlayerId, secondPlayerId) => {
    setLockActionId("create");
    const saved = await runStateAction(
      "lock-create",
      () => window.api.createTeamLock(
        firstPlayerId,
        secondPlayerId,
        matchType,
        category,
      ),
      "Teammates locked together for today.",
    );
    setLockActionId(null);
    return saved;
  };

  const handleRemoveLock = async (lockId) => {
    setLockActionId(lockId);
    const saved = await runStateAction(
      `unlock-${lockId}`,
      () => window.api.removeTeamLock(lockId),
      "Teammate lock removed. Waiting match arrangements were kept.",
    );
    setLockActionId(null);
    return saved;
  };

  const handlePreferenceChange = async (playerId, preference) => {
    setPreferenceActionId(playerId);
    await runStateAction(
      `preference-${playerId}`,
      () => window.api.updateRotationRankPreference(playerId, preference),
      "Rank-match preference updated.",
    );
    setPreferenceActionId(null);
  };

  const handleReorder = (matchId, direction) => runStateAction(
    `reorder-${matchId}`,
    () => window.api.reorderWaitingMatch(matchId, direction),
  );

  const handleRebalance = (matchId) => runStateAction(
    `rebalance-${matchId}`,
    () => window.api.rebalanceWaitingMatch(matchId),
    "Waiting match rebalanced.",
  );

  const openEdit = (match) => {
    const teamSize = match.matchType === "doubles" ? 2 : 1;
    setEditTarget(match);
    setEditTeamA(Array.from(
      { length: teamSize },
      (_, index) => String(match.teamA[index]?.id || ""),
    ));
    setEditTeamB(Array.from(
      { length: teamSize },
      (_, index) => String(match.teamB[index]?.id || ""),
    ));
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const teamAIds = editTeamA.filter(Boolean).map(Number);
    const teamBIds = editTeamB.filter(Boolean).map(Number);
    const saved = await runStateAction(
      `edit-${editTarget.id}`,
      () => window.api.updateWaitingMatch(editTarget.id, teamAIds, teamBIds),
      "Waiting match updated and revalidated.",
    );
    if (saved) setEditTarget(null);
  };

  const loadAvailableCourts = async () => {
    setIsLoadingCourts(true);
    try {
      const courts = await window.api.getAvailableCourts();
      const available = Array.isArray(courts) ? courts : [];
      setAvailableCourts(available);
      return available;
    } catch {
      setAvailableCourts([]);
      return null;
    } finally {
      setIsLoadingCourts(false);
    }
  };

  const openStart = async (match) => {
    setStartTarget(match);
    setSelectedCourtId("");
    setCourtError("");
    const courts = await loadAvailableCourts();
    if (courts === null) setCourtError("Unable to load court information.");
    else if (courts.length === 0) setCourtError("No courts are currently available.");
  };

  const confirmStart = async () => {
    if (!startTarget || !selectedCourtId) return;
    const courtId = Number(selectedCourtId);
    const saved = await runStateAction(
      `start-${startTarget.id}`,
      () => window.api.startRotationMatch(startTarget.id, courtId),
      "Rotation match started.",
    );
    if (saved) {
      setStartTarget(null);
      return;
    }
    const refreshedCourts = await loadAvailableCourts();
    if (!refreshedCourts?.some((court) => court.id === courtId)) {
      setSelectedCourtId("");
    }
    setCourtError(
      refreshedCourts?.length === 0
        ? "No courts are currently available."
        : "The selected court could not be assigned. Choose another available court.",
    );
  };

  const openFinish = (match, winningTeam) => {
    setFinishTarget(match);
    setWinnerTeam(winningTeam);
    setDonePlayerIds(autoRequeue ? [] : match.players.map((player) => player.id));
  };

  const confirmFinish = async () => {
    if (!finishTarget || !winnerTeam) return;
    const saved = await runStateAction(
      `finish-${finishTarget.id}`,
      () => window.api.finishRotationMatch(
        finishTarget.id,
        winnerTeam,
        donePlayerIds,
      ),
      "Match completed, statistics updated, and the court released.",
    );
    if (saved) {
      setFinishTarget(null);
      setWinnerTeam(null);
      setDonePlayerIds([]);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const saved = await runStateAction(
      `cancel-${cancelTarget.id}`,
      () => window.api.cancelWaitingMatch(cancelTarget.id),
      "Waiting match cancelled and its players returned to rotation.",
    );
    if (saved) setCancelTarget(null);
  };

  const editCurrentPlayerIds = new Set(editTarget?.players.map((player) => player.id) || []);
  const editorPlayers = rotationState.players.filter((player) => (
    player.eligible || editCurrentPlayerIds.has(player.id)
  ));
  const summary = rotationState.summary || EMPTY_STATE.summary;
  const availablePlayerCount = rotationState.players.filter((player) => player.eligible).length;
  const displayMatches = rotationState.matches;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 p-4 text-[var(--danger)] flex justify-between gap-3">
          <p>{error}</p>
          <button type="button" onClick={() => setError("")} className="font-bold">X</button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-[var(--success-light)] border border-[var(--success)]/30 p-4 text-[var(--success)] flex justify-between gap-3">
          <p>{notice}</p>
          <button type="button" onClick={() => setNotice("")} className="font-bold">X</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [availablePlayerCount, "Available Players", "text-[var(--success)]"],
          [summary.waiting + summary.incomplete, "Waiting", "text-[var(--warning)]"],
          [summary.playing, "Playing", "text-[var(--primary)]"],
          [summary.finished, "Finished", "text-[var(--success)]"],
        ].map(([value, label, color]) => (
          <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-[var(--text)]">{label}</p>
          </div>
        ))}
      </div>

      <RotationPlayerPool
        players={rotationState.players}
        locks={rotationState.locks}
        selectedPlayerIds={selectedPlayerIds}
        matchType={matchType}
        category={category}
        isLoading={isLoading}
        isGenerating={isGenerating}
        lockActionId={lockActionId}
        preferenceActionId={preferenceActionId}
        onMatchTypeChange={handleMatchTypeChange}
        onCategoryChange={handleCategoryChange}
        onSelectionChange={setSelectedPlayerIds}
        onCreateLock={handleCreateLock}
        onRemoveLock={handleRemoveLock}
        onPreferenceChange={handlePreferenceChange}
        onGenerate={handleGenerate}
      />

      {(warnings.length > 0 || unmatchedPlayers.length > 0) && (
        <section className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] px-4 py-3 space-y-2">
          <h2 className="text-sm font-bold text-[var(--text-h)]">Generation Notes</h2>
          {warnings.map((warning) => <p key={warning} className="text-sm text-[var(--warning)]">{warning}</p>)}
          {unmatchedPlayers.map((player) => (
            <div key={player.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface)] p-3">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(player.level)}`}>
                {player.name}
              </span>
              <span className="text-xs text-[var(--text)]">{player.reason}</span>
            </div>
          ))}
        </section>
      )}

      <RotationMatches
        matches={displayMatches}
        isLoading={isLoading}
        busyAction={busyAction}
        onEdit={openEdit}
        onRebalance={handleRebalance}
        onReorder={handleReorder}
        onCancel={setCancelTarget}
        onStart={openStart}
        onFinish={openFinish}
        onUnlock={handleRemoveLock}
      />

      <Modal
        open={configurationChange !== null}
        onClose={() => setConfigurationChange(null)}
        title="Review Selected Players"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-h)]">
            The following selected players are not valid for the new match type or category:
          </p>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {configurationChange?.invalidPlayers.map((player) => (
              <div key={player.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2">
                <p className="font-semibold text-[var(--text-h)]">{player.name}</p>
                <p className="text-xs text-[var(--text)]">{getLevelLabel(player.level)} · {player.gender || "Unknown gender"}</p>
                <p className="mt-1 text-xs font-medium text-[var(--danger)]">
                  {getPlayerConfigurationReason(
                    player,
                    configurationChange.nextMatchType,
                    configurationChange.nextCategory,
                  )}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--text)]">
            Remove them from selection and apply the new configuration?
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfigurationChange(null)} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text-h)]">Cancel</button>
            <button
              type="button"
              onClick={() => {
                applyConfiguration(
                  configurationChange.nextMatchType,
                  configurationChange.nextCategory,
                  configurationChange.invalidPlayers.map((player) => player.id),
                );
                setConfigurationChange(null);
              }}
              className="rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white"
            >
              Remove and Continue
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit Waiting Match">
        <div className="space-y-4">
          {[{ label: "Team 1", values: editTeamA, setter: setEditTeamA }, { label: "Team 2", values: editTeamB, setter: setEditTeamB }].map((team) => (
            <div key={team.label}>
              <p className="text-sm font-semibold text-[var(--text-h)] mb-2">{team.label}</p>
              <div className="space-y-2">
                {team.values.map((value, index) => {
                  const selectedPlayer = editorPlayers.find((player) => (
                    player.id === Number(value)
                  ));
                  return (
                    <div key={`${team.label}-${index}`} className="space-y-1.5">
                      <select
                        value={value}
                        onChange={(event) => team.setter((current) => current.map((item, itemIndex) => (
                          itemIndex === index ? event.target.value : item
                        )))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        <option value="">Empty slot</option>
                        {editorPlayers.map((player) => <PlayerOption key={player.id} player={player} />)}
                      </select>
                      {selectedPlayer && (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(selectedPlayer.level)}`}>
                          {selectedPlayer.name} - {getLevelLabel(selectedPlayer.level)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setEditTeamA(editTeamB);
              setEditTeamB(editTeamA);
            }}
            className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Swap Teams
          </button>
          <p className="text-xs text-[var(--text)]">
            Empty slots save the match as incomplete. Active teammate locks are revalidated when saved.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditTarget(null)} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm">Cancel</button>
            <button type="button" disabled={busyAction !== null} onClick={saveEdit} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Match</button>
          </div>
        </div>
      </Modal>

      <Modal open={startTarget !== null} onClose={() => setStartTarget(null)} title="Select Court">
        <div className="space-y-4">
          {isLoadingCourts ? (
            <p className="text-sm text-[var(--text)]">Loading available courts...</p>
          ) : (
            <select
              value={selectedCourtId}
              onChange={(event) => setSelectedCourtId(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <option value="">Select an available court</option>
              {availableCourts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
            </select>
          )}
          {courtError && <p className="rounded-xl bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">{courtError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStartTarget(null)} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm">Cancel</button>
            <button type="button" disabled={!selectedCourtId || busyAction !== null || isLoadingCourts} onClick={confirmStart} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm Start</button>
          </div>
        </div>
      </Modal>

      <Modal open={finishTarget !== null} onClose={() => setFinishTarget(null)} title="Confirm Winner and Player Return">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-h)]">
            {finishTarget?.matchType === "singles"
              ? `${winnerTeam === 1 ? finishTarget?.teamA[0]?.name : finishTarget?.teamB[0]?.name} will be saved as the winner.`
              : `Team ${winnerTeam} will be saved as the winner.`}
          </p>
          <div>
            <p className="text-sm font-semibold text-[var(--text-h)] mb-2">Mark players done for today</p>
            <div className="space-y-2">
              {finishTarget?.players.map((player) => (
                <label key={player.id} className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={donePlayerIds.includes(player.id)}
                    onChange={(event) => setDonePlayerIds((current) => (
                      event.target.checked
                        ? [...current, player.id]
                        : current.filter((id) => id !== player.id)
                    ))}
                  />
                  {player.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--text)] mt-2">Unchecked players return to rotation behind players who have waited longer.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFinishTarget(null)} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm">Cancel</button>
            <button type="button" disabled={busyAction !== null} onClick={confirmFinish} className="rounded-xl bg-[var(--success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Finish Match</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Waiting Match"
        message="Cancel this match and return its players to the available rotation pool?"
        confirmLabel="Cancel Match"
        confirmDisabled={busyAction !== null}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
