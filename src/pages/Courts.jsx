import { useEffect, useState } from "react";
import CourtCard from "../components/CourtCard";

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--text)] cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${checked ? "bg-[var(--primary)]" : "bg-[var(--border)]"}
        `}
      >
        <span
          className={`
            inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
            ${checked ? "translate-x-4.5" : "translate-x-1"}
          `}
        />
      </button>
      {label}
    </label>
  );
}

export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [courtName, setCourtName] = useState("");
  const [message, setMessage] = useState("");
  const [requeuePlayers, setRequeuePlayers] = useState(true);

  const loadCourts = async () => {
    const data = await window.api.getCourts();
    setCourts(data);
  };

  useEffect(() => {
    loadCourts();
  }, []);

  useEffect(() => {
    // Read persisted auto-requeue default from settings
    window.api.getSettings().then((data) => {
      if (data.autoRequeue === "true" || data.autoRequeue === "false") {
        setRequeuePlayers(data.autoRequeue === "true");
      }
    }).catch((err) => console.error("Failed to load auto-requeue setting:", err));
  }, []);

  const showMessage = (text, duration = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(""), duration);
  };

  const handleAddCourt = async () => {
    const name = courtName.trim();
    if (!name) return;

    await window.api.addCourt(name);
    setCourtName("");
    loadCourts();
  };

  const handleRemoveCourt = async (id) => {
    const court = courts.find((c) => c.id === id);
    if (court?.status === "playing") {
      showMessage("Cannot remove a court currently playing");
      return;
    }

    await window.api.removeCourt(id);
    loadCourts();
  };

  const handleEndMatch = async (courtId, requeue = true) => {
    await window.api.endMatch(courtId, requeue);
    loadCourts();
  };

  const playingCount = courts.filter((c) => c.status === "playing").length;
  const availableCount = courts.filter((c) => c.status === "available").length;

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      <div className="flex gap-3">
        <input
          value={courtName}
          onChange={(e) => setCourtName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCourt()}
          placeholder="Enter court name"
          className="px-4 py-2 rounded-xl border"
        />
        <button
          onClick={handleAddCourt}
          className="px-5 py-2 rounded-xl bg-green-500 text-white"
        >
          Add Court
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div>Playing: {playingCount}</div>
        <div>Available: {availableCount}</div>
        <div>Total Courts: {courts.length}</div>
        <div className="ml-auto">
          <Toggle
            checked={requeuePlayers}
            onChange={setRequeuePlayers}
            label="Requeue players after match"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            requeuePlayers={requeuePlayers}
            onEndMatch={handleEndMatch}
            onRemoveCourt={handleRemoveCourt}
          />
        ))}
      </div>
    </div>
  );
}