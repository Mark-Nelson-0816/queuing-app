import { useState } from "react";

const statusColors = {
  waiting: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  finished: "bg-[var(--success-light)] text-[var(--success)]",
};

export default function QueueList({ queue, onAddPlayer, onRemovePlayer, onStartMatch }) {
  const [newPlayerName, setNewPlayerName] = useState("");

  const handleAdd = () => {
    if (newPlayerName.trim()) {
      onAddPlayer?.(newPlayerName.trim());
      setNewPlayerName("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      {/* Add Player Bar */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-hover)]/50">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter player name..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-h)] text-sm placeholder:text-[var(--text)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newPlayerName.trim()}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Player
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                Time Joined
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
            {queue.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[var(--text)]">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📋</span>
                    <p className="text-sm font-medium">Queue is empty</p>
                    <p className="text-xs">Add players to start the queue</p>
                  </div>
                </td>
              </tr>
            ) : (
              queue.map((player, index) => (
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
                  <td className="px-4 py-4 text-sm text-[var(--text)]">{player.joined_at}</td>
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
                      {player.status === "Waiting" && (
                        <button
                          onClick={() => onStartMatch?.(player.id)}
                          className="px-3 py-1.5 rounded-lg bg-[var(--success)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Start Match
                        </button>
                      )}
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

