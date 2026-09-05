import { useEffect, useRef, useState } from "react";
import CourtCard from "../components/CourtCard";

// Manages courts and displays their current match assignments.
export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [courtName, setCourtName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const addCourtLockRef = useRef(false);

  // Reload all courts from the main process.
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

  // Load the initial court list while guarding against unmounted updates.
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

  // Shows a temporary court-management message.
  const showMessage = (text, duration = 3000) => {
    setMessage(text);
    setTimeout(() => setMessage(""), duration);
  };

  // Adds a named court and refreshes the list.
  const handleAddCourt = async () => {
    if (addCourtLockRef.current) return;

    const name = courtName.trim();
    if (!name) return;

    addCourtLockRef.current = true;
    setIsAddingCourt(true);
    try {
      const result = await window.api.addCourt(name);
      if (result?.success === false) {
        showMessage(result.error || "Unable to add court.");
        return;
      }
      setCourtName("");
      await loadCourts();
    } catch {
      showMessage("Unable to add court.");
    } finally {
      addCourtLockRef.current = false;
      setIsAddingCourt(false);
    }
  };

  // Removes an idle court after checking its current status.
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
    <div className="min-w-0 space-y-5">
      {/* Court action feedback */}
      {message && (
        <div className="break-words rounded-xl bg-red-500 px-4 py-3 text-white">
          {message}
        </div>
      )}

      {/* Add court controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={courtName}
          onChange={(e) => setCourtName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddCourt()}
          placeholder="Enter court name"
          className="min-w-0 flex-1 basis-64 rounded-xl border px-4 py-2"
        />
        <button
          onClick={handleAddCourt}
          disabled={isAddingCourt}
          className="shrink-0 whitespace-nowrap rounded-xl bg-green-500 px-5 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAddingCourt ? "Adding..." : "Add Court"}
        </button>
      </div>

      {/* Court status summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text)]">
        <div className="whitespace-nowrap">Playing: {playingCount}</div>
        <div className="whitespace-nowrap">Available: {availableCount}</div>
        <div className="whitespace-nowrap">Total Courts: {courts.length}</div>
      </div>

      {/* Court cards */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {isLoading && (
          <p className="text-sm text-[var(--text)]">Loading courts...</p>
        )}
        {!isLoading && courts.length === 0 && (
          <p className="text-sm text-[var(--text)]">
            No courts have been added yet.
          </p>
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
