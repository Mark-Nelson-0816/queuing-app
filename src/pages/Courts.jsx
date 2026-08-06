import { useEffect, useState } from "react";
import CourtCard from "../components/CourtCard";

export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [courtName, setCourtName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadCourts = async () => {
    try {
      const data = await window.api.getCourts();
      setCourts(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Unable to load court information.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    window.api.getCourts()
      .then((data) => {
        if (!isCancelled) setCourts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!isCancelled) setMessage("Unable to load court information.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
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

    const result = await window.api.removeCourt(id);
    if (result?.success === false) {
      showMessage(result.error || "Unable to remove court.");
      return;
    }
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && (
          <p className="text-sm text-[var(--text)]">Loading courts...</p>
        )}
        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            onRemoveCourt={handleRemoveCourt}
          />
        ))}
      </div>
    </div>
  );
}
