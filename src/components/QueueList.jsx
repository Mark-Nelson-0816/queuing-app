import { useState } from "react";

const statusColors = {
  waiting: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  finished: "bg-[var(--success-light)] text-[var(--success)]",
};

export default function QueueList({ queue, players, onAddToQueue, onRemovePlayer, onStartMatch }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredQueue =
  selectedLevel === "All"
    ? queue
    : queue.filter(player => player.level === selectedLevel);

  // Filter players that are NOT already in the queue
  const queuePlayerIds = new Set(queue.map(p => p.player_id));
  const availablePlayers = players.filter(p => !queuePlayerIds.has(p.id));

  // Apply search filter
  const searchedPlayers = searchTerm.trim()
    ? availablePlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : availablePlayers;

  const handleAdd = () => {
    if (selectedPlayerId) {
      onAddToQueue?.(Number(selectedPlayerId));
      setSelectedPlayerId("");
      setSearchTerm("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      {/* Add Player to Queue Bar */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-hover)]/50">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedPlayerId("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search registered players..."
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] text-sm placeholder:text-[var(--text)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            />
            {searchTerm && searchedPlayers.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {searchedPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPlayerId(p.id);
                      setSearchTerm(p.name);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium">
                      {p.name.charAt(0)}
                    </span>
                    <span className="text-[var(--text-h)]">{p.name}</span>
                    <span className="text-xs text-[var(--text)] ml-auto">{p.level}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
          >
            <option value="All">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedPlayerId}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add to Queue
          </button>
          <button
            onClick={() => onStartMatch?.()}
            className="px-5 py-2.5 rounded-xl bg-[var(--success)] text-white"
          >
            Start Match
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Player Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">
                Level
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase">
                Matches Played
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[var(--text)]">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium">Queue is empty</p>
                    <p className="text-xs">Search and select a player above to add them to the queue</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredQueue.map((player, index) => (
                <tr
                  key={player.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] text-sm font-bold">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-white text-sm flex items-center justify-center font-medium">
                        {player.name.charAt(0)}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-h)]">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[var(--text)]">{player.level}</td>
                  <td className="px-4 py-4 text-sm text-[var(--text)]">
                    {player.matches_played}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        statusColors[player.status] || "bg-[var(--surface-hover)] text-[var(--text)]"
                      }`}
                    >
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onRemovePlayer?.(player.id)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--danger-light)] text-[var(--danger)] text-xs font-semibold hover:opacity-80 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
