'use client';
import {useState} from "react";

export default function RegisterPlayerToday({setError, registerTodayLoading, setRegisterTodayLoading}) {

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm w-full">
      <h2 className="mb-5 text-xl font-semibold">
        Register Player Today
      </h2>

      <input
        placeholder="Search player..."
        className="mb-5 w-full rounded-lg border p-2"
      />

      <div className="flex flex-col gap-2 px-2 overflow-y-auto max-h-[450px]">
        
          <div
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">mname</p>

              <p className="text-sm text-gray-500">
                rank
              </p>
            </div>

            <button className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              Register
            </button>
          </div>
        
      </div>
    </div>
  );
}