import { useEffect, useState } from "react";
import QueueList from "../components/QueueList";

export default function Queue() {
  const [queue, setQueue] = useState([]);
  const [players, setPlayers] = useState([]);

  const loadData = async () => {
    const [queueData, playerData] = await Promise.all([
      window.api.getQueue(),
      window.api.getPlayers()
    ]);
    console.log("Queue data:", queueData);
    setQueue(queueData);
    setPlayers(playerData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRemovePlayer = async (id) => {
    await window.api.removeQueue(id);
    setQueue(prev => prev.filter(player => player.id !== id));
  };

  const handleAddToQueue = async (playerId) => {
    const result = await window.api.addQueue(playerId);
    if (result.error) {
      alert(result.error);
      return;
    }
    const updatedQueue = await window.api.getQueue();
    setQueue(updatedQueue);
  };

  const handleStartMatch = async () => {
    const result = await window.api.createMatch();
    if (result.error) {
      alert(result.error);
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
        onAddToQueue={handleAddToQueue}
        onRemovePlayer={handleRemovePlayer}
        onStartMatch={handleStartMatch}
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

    </div>
  );
}
