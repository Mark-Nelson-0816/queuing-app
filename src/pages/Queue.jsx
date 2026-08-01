import { useEffect, useState } from "react";
import QueueList from "../components/QueueList";
import Modal from "../components/Modal";

export default function Queue() {
  const [queue, setQueue] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matchType, setMatchType] = useState("singles");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    const [queueData, playerData] = await Promise.all([
      window.api.getQueue(),
      window.api.getPlayers()
    ]);
    console.log("Queue data:", queueData);
    setQueue(queueData);
    setPlayers(playerData);
  };

const loadPreview = async () => {
    const previewData = await window.api.previewNextMatch(matchType);
    setPreview(previewData);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Read persisted default match type from settings
    window.api.getSettings().then((data) => {
      if (data.defaultMatchType === "singles" || data.defaultMatchType === "doubles") {
        setMatchType(data.defaultMatchType);
      }
    }).catch((err) => console.error("Failed to load default match type:", err));
  }, []);

  useEffect(() => {
    // Reset preview when matchType changes to avoid stale data mismatch
    setPreview(null);
    loadPreview();
  }, [matchType, queue]);

  const handleRemovePlayer = async (id) => {
    await window.api.removeQueue(id);
    setQueue(prev => prev.filter(player => player.id !== id));
  };

  const handleAddToQueue = async (playerId) => {
    const result = await window.api.addQueue(playerId);
    if (result.error) {
      setError(result.error);
      return;
    }
    const updatedQueue = await window.api.getQueue();
    setQueue(updatedQueue);
  };

  const handleStartMatch = async () => {
    const result = await window.api.createMatch(matchType);
    if (result.error) {
      setError(result.error);
      return;
    }
    console.log(result);
    const updatedQueue = await window.api.getQueue();
    setQueue(updatedQueue);
  };

  return (
    <div className="space-y-6">

      <QueueList
        queue={queue}
        players={players}
        preview={preview}
        onAddToQueue={handleAddToQueue}
        onRemovePlayer={handleRemovePlayer}
        onStartMatch={handleStartMatch}
        matchType={matchType}
        onMatchTypeChange={setMatchType}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          Waiting: {queue.filter(p => p.status === "waiting").length}
        </div>
        <div>
          Playing: {queue.filter(p => p.status === "playing").length}
        </div>
        <div>
          Total: {queue.length}
        </div>
      </div>

      <Modal open={!!error} onClose={() => setError("")} title="Error">
        <p className="text-sm text-[var(--text)] mb-5">{error}</p>
        <div className="flex justify-end">
          <button
            onClick={() => setError("")}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold"
          >
            OK
          </button>
        </div>
      </Modal>

    </div>
  );
}
