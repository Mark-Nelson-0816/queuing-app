import { useEffect, useRef, useState } from "react";
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
  const refreshInFlightRef = useRef(false);

  // Refresh active courts and Rotation Queue Next Up matches every ten seconds.
  useEffect(() => {
    let isCancelled = false;

    // Load both public-display data sources without overlapping slow refreshes.
    const refreshData = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;

      try {
        const [courtsResult, queueResult] = await Promise.allSettled([
          window.api.getCourts(),
          window.api.getRotationNextUpMatches(),
        ]);
        if (isCancelled) return;

        if (courtsResult.status === "fulfilled") {
          setCourts(Array.isArray(courtsResult.value) ? courtsResult.value : []);
          setCourtError("");
        } else {
          // Do not leave an old active match visible after a failed refresh.
          setCourts([]);
          setCourtError("Unable to load court information.");
        }

        const queueMatches = queueResult.status === "fulfilled"
          ? queueResult.value?.data?.matches
          : null;
        if (queueResult.status === "fulfilled" && queueResult.value?.success && Array.isArray(queueMatches)) {
          const mappedQueue = queueMatches
            .filter((match) => match.source === "rotation")
            .map((match) => {
              const teamA = match.teamA.map((player) => player.name);
              const teamB = match.teamB.map((player) => player.name);
              return {
                id: match.id,
                source: match.source,
                queuePosition: match.queuePosition,
                teamA,
                teamB,
                name: [teamA.join(" / "), teamB.join(" / ")].join(" vs "),
                timeJoined: formatTime(match.createdAt),
              };
            });

          setQueueNext(mappedQueue);
        } else {
          setQueueNext([]);
        }
      } finally {
        refreshInFlightRef.current = false;
      }
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
