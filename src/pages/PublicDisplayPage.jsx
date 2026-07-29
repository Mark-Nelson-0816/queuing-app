import PublicDisplay from "../components/PublicDisplay";

const dummyCourts = [
  { id: 1, number: 1, status: "Playing", players: ["John Smith", "Sarah Johnson"] },
  { id: 2, number: 2, status: "Playing", players: ["Mike Chen", "Emma Wilson"] },
  { id: 3, number: 3, status: "Available", players: [] },
  { id: 4, number: 4, status: "Available", players: [] },
  { id: 5, number: 5, status: "Available", players: [] },
  { id: 6, number: 6, status: "Available", players: [] },
];

const dummyNextQueue = [
  { id: 1, name: "David Lee", timeJoined: "10:32 AM" },
  { id: 2, name: "Lisa Park", timeJoined: "10:35 AM" },
  { id: 3, name: "James Brown", timeJoined: "10:38 AM" },
  { id: 4, name: "Anna Martinez", timeJoined: "10:40 AM" },
  { id: 5, name: "Tom Wilson", timeJoined: "10:42 AM" },
  { id: 6, name: "Nina Patel", timeJoined: "10:45 AM" },
  { id: 7, name: "Ryan Kim", timeJoined: "10:47 AM" },
  { id: 8, name: "Olivia Taylor", timeJoined: "10:50 AM" },
  { id: 9, name: "Kevin Nguyen", timeJoined: "10:52 AM" },
];

export default function PublicDisplayPage() {
  return (
    <PublicDisplay courts={dummyCourts} queueNext={dummyNextQueue} />
  );
}

