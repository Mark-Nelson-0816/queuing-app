const registeredPlayers = [
  {
    id: 1,
    name: "John Cruz",
    level: "Beginner",
    status: "Waiting",
    matches: 2,
  },
  {
    id: 2,
    name: "Jane Santos",
    level: "Intermediate",
    status: "Playing",
    matches: 3,
  },
  {
    id: 3,
    name: "Mark Reyes",
    level: "Advanced",
    status: "Waiting",
    matches: 1,
  },
];

export default function RegisteredPlayersTodayList({searchInput}) {
  return (
    <div className="bg-white p-6">
      
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-3">Player</th>
            <th className="p-3">Level</th>
            <th className="p-3">Status</th>
            <th className="p-3">Matches</th>
            <th className="p-3 text-center">Action</th>
          </tr>
        </thead>

        <tbody>
          {registeredPlayers.map((player) => (
            <tr key={player.id} className="border-b">
              <td className="p-3">{player.name}</td>

              <td className="p-3">{player.level}</td>

              <td className="p-3">
                <span className="rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-700">
                  {player.status}
                </span>
              </td>

              <td className="p-3">{player.matches}</td>

              <td className="p-3 text-center">
                <button className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}