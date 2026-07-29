import { useEffect, useState } from "react";
import PublicDisplay from "../components/PublicDisplay";

export default function PublicDisplayPage() {
  const [courts, setCourts] = useState([]);
  const [queueNext, setQueueNext] = useState([]);

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "Z");
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [courtsData, queueData] = await Promise.all([
          window.api.getCourts(),
          window.api.getQueue(),
        ]);

        setCourts(courtsData);

        // Map queue data to match PublicDisplay's expected format
        const mappedQueue = queueData.map((entry) => ({
          id: entry.id,
          name: entry.name,
          timeJoined: formatTime(entry.joined_at),
        }));

        setQueueNext(mappedQueue);
      } catch (err) {
        console.error("Failed to load public display data:", err);
      }
    }

    // Load immediately
    loadData();

    // Refresh every 10 seconds to stay up-to-date
    const interval = setInterval(loadData, 10000);

    return () => clearInterval(interval);
  }, []);

  return <PublicDisplay courts={courts} queueNext={queueNext} />;
}

