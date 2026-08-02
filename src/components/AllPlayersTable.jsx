import { useState } from "react";
import EditPlayer from "./EditPlayer";

const players = [
  {
    id: 1,
    name: "John Cruz",
    level: "Beginner",
    gender: "Male",
    contact: "09123456789",

    preferMens: false,
    preferWomens: false,
    preferMixed: true,
    preferNoGender: false,

    matches: 12,
    wins: 7,
    losses: 5,
  },
  {
    id: 2,
    name: "Jane Santos",
    level: "Intermediate",
    gender: "Female",
    contact: "09998887777",

    preferMens: false,
    preferWomens: true,
    preferMixed: true,
    preferNoGender: false,

    matches: 20,
    wins: 12,
    losses: 8,
  },
];

export default function AllPlayersTable({searchInput}) {


  return (
    <>
      <div className="bg-white p-6">

        <table className="w-full border-collapse">

          <thead>

            <tr className="border-b bg-gray-100">

              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Level</th>
              <th className="p-3 text-left">Gender</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-center">Matches</th>
              <th className="p-3 text-center">W/L</th>
              <th className="p-3 text-center">Action</th>

            </tr>

          </thead>

          <tbody>

            {players.map((player) => (

              <tr
                key={player.id}
                className="border-b hover:bg-gray-50"
              >

                <td className="p-3 font-medium">
                  {player.name}
                </td>

                <td className="p-3">
                  {player.level}
                </td>

                <td className="p-3">
                  {player.gender}
                </td>

                <td className="p-3">
                  {player.contact}
                </td>

                <td className="p-3 text-center">
                  {player.matches}
                </td>

                <td className="p-3 text-center">
                  {player.wins} / {player.losses}
                </td>

                <td className="p-3">

                  <div className="flex justify-center gap-2">

                    <button
                      className="rounded-lg bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600"
                    >
                      Edit
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* <EditPlayerModal
        open={true}
        onClose={null}
        player={null}
      /> */}
    </>
  );
}