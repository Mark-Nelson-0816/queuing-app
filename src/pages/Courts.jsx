import { useEffect, useState } from "react";
import CourtCard from "../components/CourtCard";

export default function Courts() {

  const [courts, setCourts] = useState([]);
  const [courtName, setCourtName] = useState("");
  const [message, setMessage] = useState("");


  async function loadCourts(){

    const data = await window.api.getCourts();

    console.log("Received courts:", data);

    setCourts(data);

  }


  useEffect(() => {

    loadCourts();

  }, []);



  const handleAddCourt = async()=>{

    if(!courtName.trim()) return;


    await window.api.addCourt(courtName);


    setCourtName("");

    loadCourts();

  };



  const handleRemoveCourt = async(id)=>{

    const court = courts.find(
      c => c.id === id
    );


    if(court.status === "playing"){

      setMessage("Cannot remove a court currently playing");

      setTimeout(()=>{
        setMessage("");
      },3000);

      return;
    }


    await window.api.removeCourt(id);


    loadCourts();

  };



  const handleEndMatch = async(courtId)=>{

    await window.api.endMatch(courtId);


    loadCourts();

  };



  return (
    <div className="space-y-6">


      {
        message &&
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl">
          {message}
        </div>
      }



      <div className="flex gap-3">

        <input
          value={courtName}
          onChange={(e)=>setCourtName(e.target.value)}
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


        {
          courts.map((court)=>(

            <CourtCard

              key={court.id}

              court={court}

              onEndMatch={handleEndMatch}

              onRemoveCourt={handleRemoveCourt}

            />

          ))
        }


      </div>


    </div>
  );
}