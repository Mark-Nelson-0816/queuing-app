import { useEffect, useState } from "react";
import QueueList from "../components/QueueList";


export default function Queue() {

  const [queue, setQueue] = useState([]);

  useEffect(() => {
    async function loadQueue(){
      const data = await window.api.getQueue();
      console.log("Queue data:", data);
      setQueue(data);
    }

    loadQueue();

  }, []);



  const handleRemovePlayer = async (id) => {

    await window.api.removeQueue(id);


    setQueue(prev =>
      prev.filter(
        player => player.id !== id
      )
    );

  };

  const handleAddPlayer = async (name, level) => {

    await window.api.addPlayer(name, level);
    const updatedQueue = await window.api.getQueue();
    setQueue(updatedQueue);
  };

  const handleStartMatch = async()=>{
    const result = await window.api.createMatch();
    if(result.error){
        alert(result.error);
        return;
    }
    console.log(result);
    const updatedQueue =
        await window.api.getQueue();
    setQueue(updatedQueue);
  };

  return (
    <div className="space-y-6">

      <QueueList
        queue={queue}
        onAddPlayer={handleAddPlayer}
        onRemovePlayer={handleRemovePlayer}
        onStartMatch={handleStartMatch}
      />


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div>
          Waiting:
          {
            queue.filter(
              p => p.status === "waiting"
            ).length
          }
        </div>


        <div>
          Playing:
          {
            queue.filter(
              p => p.status === "playing"
            ).length
          }
        </div>


        <div>
          Total:
          {queue.length}
        </div>


      </div>

    </div>
  );
}