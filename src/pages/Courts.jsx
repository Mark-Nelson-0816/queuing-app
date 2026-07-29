import { useEffect, useState } from "react";
import CourtCard from "../components/CourtCard";

export default function Courts() {

  const [courts, setCourts] = useState([]);


  useEffect(() => {

    async function loadCourts(){

      const data = await window.api.getCourts();

      console.log("Received courts:", data);

      setCourts(data);

    }

    loadCourts();

  }, []);


  const handleEndMatch = (courtId) => {

    setCourts((prev) =>
      prev.map((court) =>
        court.id === courtId
          ? {
              ...court,
              status: "available",
              players: []
            }
          : court
      )
    );

  };


  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4 flex-wrap">

        <div>
          Playing: {
            courts.filter(
              c => c.status === "playing"
            ).length
          }
        </div>

        <div>
          Available: {
            courts.filter(
              c => c.status === "available"
            ).length
          }
        </div>

        <div>
          Total Courts: {courts.length}
        </div>

      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            onEndMatch={handleEndMatch}
          />
        ))}

      </div>

    </div>
  );
}