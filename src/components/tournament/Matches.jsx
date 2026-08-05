'use client';
import {useState, useEffect} from 'react';


export default function Matches(){
    return(
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">

        <div className="p-4 border-b border-[var(--border)]">

          <h2 className="font-semibold text-[var(--text-h)]">
            Tournament Matches
          </h2>

        </div>

        <div className="p-10 text-center text-[var(--text)]">

          Generated matches will appear here.

        </div>

      </div>
    )
}