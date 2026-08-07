import { useEffect, useRef, useState } from "react";
import RegisteredPlayers from "../components/tournament/RegisteredPlayers";
import TournamentOptions from "../components/tournament/TournamentOptions";
import Matches from "../components/tournament/Matches";

// Returns a useful message from an unknown error value.
function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
}

// Manages Tournament generation, match starts, and winner results.
export default function Tournament() {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [matchType, setMatchType] = useState("doubles");
  const [category, setCategory] = useState("no_gender");
  const [tournamentData, setTournamentData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startingMatchId, setStartingMatchId] = useState(null);
  const [savingMatchId, setSavingMatchId] = useState(null);
  const startingMatchLockRef = useRef(false);
  const savingMatchLockRef = useRef(false);

  // Load saved Tournament defaults when the page opens.
  useEffect(() => {
    let isCancelled = false;

    window.api.getSettings()
      .then((settings) => {
        if (isCancelled) return;
        const defaultMatchType = ["singles", "doubles"].includes(
          settings.defaultTournamentMatchType,
        ) ? settings.defaultTournamentMatchType : "doubles";
        const defaultCategory = ["no_gender", "mens", "womens", "mixed"].includes(
          settings.defaultTournamentCategory,
        ) ? settings.defaultTournamentCategory : "no_gender";
        setMatchType(defaultMatchType);
        setCategory(
          defaultMatchType === "singles" && defaultCategory === "mixed"
            ? "no_gender"
            : defaultCategory,
        );
      })
      .catch(() => {
        // Existing tournament defaults remain in place when settings cannot load.
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Reload the latest saved Tournament when the page opens.
  useEffect(() => {
    let isCancelled = false;

    window.api.getLatestTournament()
      .then((result) => {
        if (isCancelled) return;

        if (!result.success) {
          setError(result.message || "Failed to load Tournament.");
          return;
        }

        setTournamentData(result.data);
      })
      .catch((loadError) => {
        if (!isCancelled) {
          setError(getErrorMessage(loadError, "Failed to load Tournament."));
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Generate a complete Tournament from the selected players once per click.
  const handleGenerateTournament = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setError("");
    setNotice("");

    try {
      const result = await window.api.createRoundRobinTournament(
        selectedPlayers,
        matchType,
        category,
      );

      if (!result.success) {
        setError(result.message || "Failed to create Tournament.");
        return;
      }

      setTournamentData(result.data);
      setSelectedPlayers([]);
      setNotice("Tournament matches generated successfully.");
    } catch (createError) {
      setError(getErrorMessage(createError, "Failed to create Tournament."));
    } finally {
      setIsGenerating(false);
    }
  };

  // Start one pending Tournament match on an available court.
  const handleStartMatch = async (matchId, courtId) => {
    if (startingMatchLockRef.current) {
      return { success: false, message: "A match is already being started." };
    }

    startingMatchLockRef.current = true;
    setStartingMatchId(matchId);
    setError("");
    setNotice("");

    try {
      const result = await window.api.startTournamentMatch(matchId, courtId);

      if (!result.success) {
        setError(result.message || "Failed to start Tournament match.");
        return result;
      }

      setTournamentData(result.data);
      const startedMatch = result.data.rounds
        .flatMap((round) => round.matches)
        .find((match) => match.id === matchId);
      setNotice(`Match started on ${startedMatch?.court?.name || "the selected court"}.`);
      return result;
    } catch (startError) {
      const message = getErrorMessage(startError, "Failed to start Tournament match.");
      setError(message);
      return { success: false, message };
    } finally {
      startingMatchLockRef.current = false;
      setStartingMatchId(null);
    }
  };

  // Change category and remove players with an incompatible gender.
  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);

    if (nextCategory === "mens") {
      setSelectedPlayers((currentPlayers) => (
        currentPlayers.filter((player) => player.gender === "male")
      ));
    } else if (nextCategory === "womens") {
      setSelectedPlayers((currentPlayers) => (
        currentPlayers.filter((player) => player.gender === "female")
      ));
    }
  };

  // Save one Tournament winner and apply the refreshed Tournament data.
  const handleFinishMatch = async (matchId, winnerTeamId) => {
    if (savingMatchLockRef.current) return false;

    savingMatchLockRef.current = true;
    setSavingMatchId(matchId);
    setError("");
    setNotice("");

    try {
      const result = await window.api.finishTournamentMatch(
        matchId,
        winnerTeamId,
      );

      if (!result.success) {
        setError(result.message || "Failed to complete Tournament match.");
        return false;
      }

      setTournamentData(result.data);
      setNotice("Match completed and its court is available again.");
      return true;
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to complete Tournament match."));
      return false;
    } finally {
      savingMatchLockRef.current = false;
      setSavingMatchId(null);
    }
  };

  // Provide zeroed summary values before a Tournament is loaded.
  const summary = tournamentData?.summary || {
    totalMatches: 0,
    pendingMatches: 0,
    completedMatches: 0,
    playingMatches: 0,
    totalTeams: 0,
  };

  const hasActiveTournament = Boolean(
    tournamentData?.tournament.status === "ongoing"
    && summary.totalMatches > 0,
  );

  return (
    <div className="space-y-6">
      {/* Tournament action feedback */}
      {error && (
        <div className="rounded-xl bg-red-500 text-white p-4 flex justify-between gap-4">
          <p>{error}</p>
          <button
            type="button"
            className="text-lg font-bold"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            X
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/30 p-4 flex justify-between gap-4">
          <p>{notice}</p>
          <button
            type="button"
            className="font-bold"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            X
          </button>
        </div>
      )}

      {/* Tournament status summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-center">
          <p className="text-2xl font-bold">{summary.totalMatches}</p>
          <p className="text-sm text-[var(--text)]">Total Matches</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--warning)]">
            {summary.pendingMatches}
          </p>
          <p className="text-sm text-[var(--text)]">Pending</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--primary)]">
            {summary.playingMatches}
          </p>
          <p className="text-sm text-[var(--text)]">Playing</p>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--success)]">
            {summary.completedMatches}
          </p>
          <p className="text-sm text-[var(--text)]">Finished</p>
        </div>
      </div>

      {/* Tournament configuration and player selection */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <TournamentOptions
          matchType={matchType}
          category={category}
          setCategory={handleCategoryChange}
          setMatchType={setMatchType}
          onGenerate={handleGenerateTournament}
          isGenerating={isGenerating}
          generationDisabled={hasActiveTournament}
        />

        <RegisteredPlayers
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
          category={category}
        />
      </div>

      {/* Tournament matches and standings */}
      <Matches
        tournamentData={tournamentData}
        isLoading={isLoading}
        startingMatchId={startingMatchId}
        savingMatchId={savingMatchId}
        onStartMatch={handleStartMatch}
        onFinishMatch={handleFinishMatch}
      />
    </div>
  );
}
