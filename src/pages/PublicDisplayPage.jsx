import { useEffect, useState } from "react";
import PublicDisplay from "../components/PublicDisplay";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}Z`);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublicDisplayPage() {
  const [courts, setCourts] = useState([]);
  const [queueNext, setQueueNext] = useState([]);
  const [courtError, setCourtError] = useState("");

  useEffect(() => {
    let isCancelled = false;

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

      window.api.getQueue()
        .then((queueData) => {
          if (isCancelled) return;

          const mappedQueue = (Array.isArray(queueData) ? queueData : []).map(
            (entry) => ({
              id: entry.id,
              name: entry.name,
              timeJoined: formatTime(entry.joined_at),
            }),
          );

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
