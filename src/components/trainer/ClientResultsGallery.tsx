"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ClientResult {
  id: string;
  before_image_url: string;
  after_image_url: string;
  client_name?: string;
  note?: string;
  created_at: string;
}

interface ClientResultsGalleryProps {
  trainerId: string;
}

export default function ClientResultsGallery({ trainerId }: ClientResultsGalleryProps) {
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_results")
        .select("*")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nepodarilo sa načítať galériu výsledkov.");
    } finally {
      setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  const handleDelete = async (id: string, beforeUrl: string, afterUrl: string) => {
    if (!confirm("Naozaj chcete vymazať tento výsledok?")) return;
    
    setDeletingId(id);
    try {
      // 1. Vymazať z DB
      const { error: dbError } = await supabase
        .from("client_results")
        .delete()
        .eq("id", id);
      
      if (dbError) throw dbError;

      // 2. Vymazať zo storage (ak je to URL zo storage)
      // Skúsime extrahovať cestu zo storage URL (predpokladáme Supabase storage formát)
      const extractPath = (url: string) => {
        const parts = url.split("/public/client-results/");
        return parts.length > 1 ? parts[1] : null;
      };

      const beforeStoragePath = extractPath(beforeUrl);
      const afterStoragePath = extractPath(afterUrl);

      const filesToDelete = [beforeStoragePath, afterStoragePath].filter((p): p is string => !!p);
      
      if (filesToDelete.length > 0) {
        await supabase.storage.from("client-results").remove(filesToDelete);
      }

      setResults((prev) => prev.filter((r) => r.id !== id));
      alert("Výsledok bol úspešne vymazaný.");
    } catch (err: unknown) {
      console.error("Delete error:", err);
      alert("Chyba pri mazaní výsledku.");
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse">Načítavam galériu...</div>;
  if (error) return <div className="text-red-400">Chyba: {error}</div>;

  if (results.length === 0) {
    return (
      <div className="px-6 py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
        <p className="text-zinc-500 italic">Zatiaľ tu nie sú žiadne výsledky klientov.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {openMenuId !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenuId(null)}
          onPointerDown={() => setOpenMenuId(null)}
        />
      )}
      {results.map((result) => (
        <div key={result.id} className="relative group bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden p-4">
          <div className="flex gap-2 aspect-[4/3] mb-4">
            <div className="relative flex-1 rounded-2xl overflow-hidden border border-zinc-800">
              <Image src={result.before_image_url} alt="Pred" fill className="object-cover" />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white tracking-widest">
                Pred
              </div>
            </div>
            <div className="relative flex-1 rounded-2xl overflow-hidden border border-emerald-500/30">
              <Image src={result.after_image_url} alt="Po" fill className="object-cover" />
              <div className="absolute bottom-2 right-2 bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] uppercase font-bold text-black tracking-widest">
                Po
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold truncate">
                {result.client_name || "Bez mena"}
              </div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider">
                {new Date(result.created_at).toLocaleDateString("sk-SK")}
              </div>
            </div>

            <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="h-8 px-3 inline-flex items-center gap-2 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800"
                disabled={deletingId === result.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId((prev) => (prev === result.id ? null : result.id));
                }}
              >
                Upraviť
              </button>

              {openMenuId === result.id && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl border border-zinc-700/60 bg-zinc-950 shadow-2xl overflow-hidden z-50">
                  <div className="py-1">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors font-medium flex items-center gap-2"
                      disabled={deletingId === result.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(result.id, result.before_image_url, result.after_image_url);
                      }}
                    >
                      <span>Vymazať výsledok</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
