import { useEffect, useState } from "react";

const statusColors = {
  pending: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  completed: "bg-[var(--success-light)] text-[var(--success)]",
};

const levelStyles = {
  Beginner: "bg-blue-100 text-blue-700",
  Intermediate: "bg-amber-100 text-amber-700",
  Advanced: "bg-purple-100 text-purple-700",
};

export default function RoundRobin() {
  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [matches, setMatches] = useState([]);
  const [courts, setCourts] = useState([]);
  const [message, setMessage] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");

  async function loadData() {
    const allPlayers = await window.api.getRRPlayers();
    setPlayers(allPlayers);
    const allMatches = await window.api.getRRMatches();
    setMatches(allMatches);
    const allCourts = await window.api.getCourts();
    setCourts(allCourts);
  }

  useEffect(() => {
    loadData();
  }, []);

  function togglePlayer(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === players.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(players.map((p) => p.id)));
    }
  }

  async function handleGenerateMatches() {
    if (selectedIds.size < 2) {
      setMessage("Select at least 2 players to generate matches.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const playerIds = Array.from(selectedIds);
    await window.api.generateRRMatches(playerIds);
    const allMatches = await window.api.getRRMatches();
    setMatches(allMatches);
    setMessage(`Generated ${allMatches.length} matches!`);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleAssignToCourt(matchId) {
    const availableCourt = courts.find((c) => c.status === "available");
    if (!availableCourt) {
      setMessage("No available court. Please free up a court first.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const result = await window.api.assignRRMatch(matchId, availableCourt.id);
    if (result.success) {
      await loadData();
      setMessage(`Match assigned to ${availableCourt.name}`);
    } else {
      setMessage(result.error || "Failed to assign match.");
    }
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleEndMatch(matchId, courtId) {
    await window.api.endRRMatch(matchId, courtId);
    await loadData();
    setMessage("Match ended, court is now available.");
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleClearMatches() {
    await window.api.generateRRMatches([]);
    setMatches([]);
    setMessage("All pending matches cleared.");
    setTimeout(() => setMessage(""), 3000);
  }

  // Build a set of player IDs that are currently playing (busy)
  const busyPlayerIds = new Set();
  matches
    .filter((m) => m.status === "playing")
    .forEach((m) => {
      busyPlayerIds.add(m.player_one_id);
      busyPlayerIds.add(m.player_two_id);
    });

  // Filter matches by level
  const filteredMatches = levelFilter === "All"
    ? matches
    : matches.filter((m) => m.player_one_level === levelFilter);

  const pendingCount = filteredMatches.filter((m) => m.status === "pending").length;
  const playingCount = filteredMatches.filter((m) => m.status === "playing").length;
  const completedCount = filteredMatches.filter((m) => m.status === "completed").length;

  // Get unique levels present in the matches
  const matchLevels = ["All", ...new Set(matches.map((m) => m.player_one_level).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className="bg-[var(--primary)] text-white px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold">{filteredMatches.length}</p>
          <p className="text-sm text-[var(--text)]">Total Matches</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--warning)]">{pendingCount}</p>
          <p className="text-sm text-[var(--text)]">Pending</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--primary)]">{playingCount}</p>
          <p className="text-sm text-[var(--text)]">Playing</p>
        </div>
        <div className="bg-[var(--surface)] rounded-2xl border p-4 text-center">
          <p className="text-2xl font-bold text-[var(--success)]">{completedCount}</p>
          <p className="text-sm text-[var(--text)]">Completed</p>
        </div>
      </div>

      {/* Player Selection */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-h)]">Select Players for Round Robin</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
              <input
                type="checkbox"
                checked={players.length > 0 && selectedIds.size === players.length}
                onChange={toggleSelectAll}
                className="rounded"
              />
              Select All
            </label>
            <span className="text-sm text-[var(--text)]">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleGenerateMatches}
              disabled={selectedIds.size < 2}
              className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Matches
            </button>
          </div>
        </div>
        {players.length === 0 ? (
          <div className="p-8 text-center text-[var(--text)]">
            <p className="text-sm">No players found. Add players in the Players page first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
            {players.map((player) => (
              <label
                key={player.id}
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-sm ${
                  selectedIds.has(player.id)
                    ? "bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  className="rounded"
                />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{player.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text)] shrink-0">
                    {player.level}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Matches List */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-[var(--text-h)]">Round Robin Matches</h3>
          <div className="flex items-center gap-3">
            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
            >
              {matchLevels.map((level) => (
                <option key={level} value={level}>
                  {level === "All" ? "All Levels" : level}
                </option>
              ))}
            </select>
            {matches.length > 0 && (
              <button
                onClick={handleClearMatches}
                className="px-4 py-1.5 rounded-lg bg-[var(--danger-light)] text-[var(--danger)] text-xs font-semibold hover:opacity-80"
              >
                Clear Pending
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">Player 1</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">Player 2</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text)]">
                    <p className="text-sm">
                      {levelFilter === "All"
                        ? "No matches generated yet. Select players and generate matches."
                        : `No ${levelFilter} matches found.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match, index) => (
                  <tr
                    key={match.id}
                    className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-sm font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium">
                          {match.player_one_name?.charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-h)]">{match.player_one_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium">
                          {match.player_two_name?.charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-h)]">{match.player_two_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          levelStyles[match.player_one_level] || "bg-[var(--surface-hover)] text-[var(--text)]"
                        }`}
                      >
                        {match.player_one_level}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          statusColors[match.status] || "bg-[var(--surface-hover)] text-[var(--text)]"
                        }`}
                      >
                        {match.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {match.status === "pending" &&
                        (() => {
                          const isPlayerBusy =
                            busyPlayerIds.has(match.player_one_id) ||
                            busyPlayerIds.has(match.player_two_id);
                          return (
                            <button
                              onClick={() => !isPlayerBusy && handleAssignToCourt(match.id)}
                              disabled={isPlayerBusy}
                              title={
                                isPlayerBusy
                                  ? "One of the players is already playing. End that match first."
                                  : "Assign to an available court"
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity ${
                                isPlayerBusy
                                  ? "bg-[var(--surface-hover)] text-[var(--text)] cursor-not-allowed"
                                  : "bg-[var(--success)] text-white hover:opacity-80"
                              }`}
                            >
                              {isPlayerBusy ? "Player Busy" : "Assign to Court"}
                            </button>
                          );
                        })()}
                      {match.status === "playing" && match.court_id && (
                        <button
                          onClick={() => handleEndMatch(match.id, match.court_id)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--danger)] text-white text-xs font-semibold hover:opacity-80 transition-opacity"
                        >
                          End Match
                        </button>
                      )}
                      {match.status === "completed" && (
                        <span className="text-xs text-[var(--text)]">Done</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

