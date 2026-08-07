import { useEffect, useState } from "react";
import PublicDisplay from "../components/PublicDisplay";

// Formats queue creation times for the public screen.
function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}Z`);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Loads and refreshes the data shown on the public display.
export default function PublicDisplayPage() {
  const [courts, setCourts] = useState([]);
  const [queueNext, setQueueNext] = useState([]);
  const [courtError, setCourtError] = useState("");

  // Refresh active courts and Rotation Queue Next Up matches every ten seconds.
  useEffect(() => {
    let isCancelled = false;

    // Load both public-display data sources without blocking each other.
    const refreshData = () => {
      window.api.getCourts()
        .then((courtsData) => {
          if (isCancelled) return;
          setCourts(Array.isArray(courtsData) ? courtsData : []);
          setCourtError("");
        })
        .catch(() => {
          if (!isCancelled) {
            setCourtError("Unable to load court information.");
          }
        });

      window.api.getRotationNextUpMatches()
        .then((result) => {
          if (isCancelled) return;

          const mappedQueue = result?.success
            ? result.data.matches
              .filter((match) => match.source === "rotation")
              .map((match) => ({
                id: match.id,
                source: match.source,
                queuePosition: match.queuePosition,
                name: [
                  match.teamA.map((player) => player.name).join(" / "),
                  match.teamB.map((player) => player.name).join(" / "),
                ].join(" vs "),
                timeJoined: formatTime(match.createdAt),
              }))
            : [];

          setQueueNext(mappedQueue);
        })
        .catch(() => {
          if (!isCancelled) setQueueNext([]);
        });
    };

    const initialRefresh = setTimeout(refreshData, 0);
    const interval = setInterval(refreshData, 10000);

    return () => {
      isCancelled = true;
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, []);

  return (
    <PublicDisplay
      courts={courts}
      queueNext={queueNext}
      courtError={courtError}
    />
  );
}
