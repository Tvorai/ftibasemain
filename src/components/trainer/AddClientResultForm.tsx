"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "@/lib/config";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AddClientResultFormProps {
  trainerId: string;
  onSuccess: () => void;
}

export default function AddClientResultForm({ trainerId, onSuccess }: AddClientResultFormProps) {
  const [loading, setLoading] = useState(false);
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "before" | "after") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert("Fotka je príliš veľká. Prosím nahrajte obrázok do 4MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new window.Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL("image/webp", 0.8);
          if (type === "before") setBeforeImage(compressedBase64);
          else setAfterImage(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const base64ToFile = (base64: string, filename: string): File => {
    const arr = base64.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/webp";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const uploadToStorage = async (base64: string, path: string) => {
    const file = base64ToFile(base64, "image.webp");
    const { data, error } = await supabase.storage
      .from("vysledky")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from("vysledky")
      .getPublicUrl(path);
      
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beforeImage || !afterImage) {
      alert("Prosím nahrajte obe fotky (Pred aj Po).");
      return;
    }

    setLoading(true);
    try {
      // 1. Upload do Storage
      const timestamp = Date.now();
      const beforeUrl = await uploadToStorage(beforeImage, `client-results/${trainerId}_${timestamp}_before.webp`);
      const afterUrl = await uploadToStorage(afterImage, `client-results/${trainerId}_${timestamp}_after.webp`);

      // 2. Uloženie do DB
      const { error: dbError } = await supabase
        .from("client_results")
        .insert({
          trainer_id: trainerId,
          before_image_url: beforeUrl,
          after_image_url: afterUrl,
          client_name: clientName || null,
          note: note || null
        });

      if (dbError) throw dbError;

      alert("Výsledok bol úspešne pridaný.");
      onSuccess();
    } catch (err: unknown) {
      console.error("Upload error:", err);
      alert("Chyba pri nahrávaní výsledku. Skontrolujte, či existuje bucket 'vysledky' v Supabase Storage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pred */}
        <div className="space-y-3 flex flex-col items-center">
          <span className="text-white font-bold uppercase tracking-widest text-xs">Fotka: PRED</span>
          <div 
            onClick={() => beforeInputRef.current?.click()}
            className="w-full aspect-[4/3] border border-dashed border-zinc-700 hover:border-emerald-500/50 rounded-3xl flex items-center justify-center cursor-pointer overflow-hidden relative bg-zinc-950/50 group transition-all"
          >
            {beforeImage ? (
              <Image src={beforeImage} alt="Pred" fill className="object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-zinc-500 text-5xl font-light">+</span>
                <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">Nahrať fotku</span>
              </div>
            )}
            {beforeImage && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold uppercase">Zmeniť</span>
              </div>
            )}
          </div>
          <input type="file" ref={beforeInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "before")} />
        </div>

        {/* Po */}
        <div className="space-y-3 flex flex-col items-center">
          <span className="text-white font-bold uppercase tracking-widest text-xs">Fotka: PO</span>
          <div 
            onClick={() => afterInputRef.current?.click()}
            className="w-full aspect-[4/3] border border-dashed border-zinc-700 hover:border-emerald-500/50 rounded-3xl flex items-center justify-center cursor-pointer overflow-hidden relative bg-zinc-950/50 group transition-all"
          >
            {afterImage ? (
              <Image src={afterImage} alt="Po" fill className="object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-zinc-500 text-5xl font-light">+</span>
                <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-tighter">Nahrať fotku</span>
              </div>
            )}
            {afterImage && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold uppercase">Zmeniť</span>
              </div>
            )}
          </div>
          <input type="file" ref={afterInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "after")} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-white font-bold uppercase tracking-widest text-[10px] ml-2">Meno klienta (voliteľné)</label>
          <input 
            type="text" 
            placeholder="Napr. Ján Mrkvička" 
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 text-white outline-none focus:border-emerald-500/50 transition-all text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-white font-bold uppercase tracking-widest text-[10px] ml-2">Poznámka / Výsledok (voliteľné)</label>
          <textarea 
            placeholder="Napr. -15kg za 3 mesiace..." 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 text-white outline-none focus:border-emerald-500/50 transition-all text-sm min-h-[100px] resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          type="submit"
          disabled={loading || !beforeImage || !afterImage}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-display text-2xl px-12 py-3 rounded-full uppercase tracking-widest disabled:opacity-50 transition-all shadow-xl shadow-emerald-500/10"
        >
          {loading ? "PRIDÁVAM..." : "PRIDAŤ VÝSLEDOK"}
        </button>
      </div>
    </form>
  );
}
