'use client';
import {useState, useEffect} from 'react';

export default function TournamentOptions({matchType = 'doubles', category = 'mens', setMatchType, setCategory}){

    return(
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 space-y-6">

          <div>
            <h2 className="text-lg font-semibold text-[var(--text-h)]">
              Tournament Configuration
            </h2>

            <p className="text-sm text-[var(--text)] mt-1">
              Configure the tournament before selecting participants.
            </p>
          </div>

          {/* Match Type */}

          <div>
            <label className="block text-sm font-medium mb-2">
              Match Type
            </label>

            <div className="grid grid-cols-2 gap-2">

              <button
                onClick={() => {
                  setMatchType("singles");
                  setCategory("mens");
                }}
                className={`rounded-xl border py-2 transition
                  ${
                    matchType === "singles"
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : ""
                  }`}
              >
                Singles
              </button>

              <button
                onClick={() => setMatchType("doubles")}
                className={`rounded-xl border py-2 transition
                  ${
                    matchType === "doubles"
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : ""
                  }`}
              >
                Doubles
              </button>

            </div>

          </div>
          {/* Category */}

          <div>

            <label className="block text-sm font-medium mb-2">
              Category
            </label>

            <div className="space-y-2">

              <button
                onClick={() => setCategory("mens")}
                className={`w-full rounded-xl border py-2 ${
                  category === "mens"
                    ? "bg-[var(--primary)] text-white"
                    : ""
                }`}
              >
                Men's
              </button>

              <button
                onClick={() => setCategory("womens")}
                className={`w-full rounded-xl border py-2 ${
                  category === "womens"
                    ? "bg-[var(--primary)] text-white"
                    : ""
                }`}
              >
                Women's
              </button>

              {matchType === "doubles" && (
                <button
                  onClick={() => setCategory("mixed")}
                  className={`w-full rounded-xl border py-2 ${
                    category === "mixed"
                      ? "bg-[var(--primary)] text-white"
                      : ""
                  }`}
                >
                  Mixed
                </button>
              )}

              <button
                onClick={() => setCategory("no_gender")}
                className={`w-full rounded-xl border py-2 ${
                  category === "no_gender"
                    ? "bg-[var(--primary)] text-white"
                    : ""
                }`}
              >
                No Gender
              </button>

            </div>

          </div>

          <div className="rounded-xl border bg-[var(--background)] p-3 text-sm text-[var(--text)]">

            {category === "mens" &&
              "2 men vs 2 men (or 1 vs 1 for Singles)."}

            {category === "womens" &&
              "2 women vs 2 women (or 1 vs 1 for Singles)."}

            {category === "mixed" &&
              "1 man + 1 woman vs 1 man + 1 woman."}

            {category === "no_gender" &&
              "Any player combination is allowed."}

          </div>

          <button className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold hover:bg-[var(--primary-hover)] transition">
            Generate Matches
          </button>

        </div>
    )
}