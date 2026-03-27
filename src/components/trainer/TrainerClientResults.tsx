"use client";

import React, { useState } from "react";
import ClientResultsGallery from "./ClientResultsGallery";
import AddClientResultForm from "./AddClientResultForm";

type SubTabId = "galeria" | "pridat";

interface TrainerClientResultsProps {
  trainerId: string;
}

export default function TrainerClientResults({ trainerId }: TrainerClientResultsProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("galeria");

  return (
    <div className="flex flex-col gap-6 w-full max-w-[760px] ml-auto">
      <div className="flex gap-4 mb-6 border-b border-zinc-900 pb-4">
        <button
          onClick={() => setActiveSubTab("galeria")}
          className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
            activeSubTab === "galeria"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          Galéria
        </button>
        <button
          onClick={() => setActiveSubTab("pridat")}
          className={`px-6 py-2 rounded-full font-bold uppercase tracking-widest text-xs transition-all ${
            activeSubTab === "pridat"
              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          Pridať výsledok
        </button>
      </div>

      <div className="mt-2">
        {activeSubTab === "galeria" ? (
          <ClientResultsGallery trainerId={trainerId} />
        ) : (
          <AddClientResultForm 
            trainerId={trainerId} 
            onSuccess={() => setActiveSubTab("galeria")} 
          />
        )}
      </div>
    </div>
  );
}
