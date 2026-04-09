"use client";

import React, { useEffect } from "react";
import clsx from "clsx";

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function ModalWrapper({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-[500px]",
}: ModalWrapperProps) {
  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Overlay: Fixed full screen, centered content
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal Container: Max height 90vh to prevent keyboard resize issues */}
      <div
        className={clsx(
          "w-full flex flex-col bg-zinc-950 border border-zinc-800 rounded-[30px] overflow-hidden shadow-2xl transition-all animate-in fade-in zoom-in duration-200",
          "max-h-[90vh]",
          maxWidth
        )}
      >
        {/* Header: Sticky at the top, non-scrolling */}
        <div className="sticky top-0 z-[110] flex items-center justify-between p-6 border-b border-white/5 bg-zinc-950">
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            aria-label="Zatvoriť"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body: Scrollable area with padding bottom for keyboard */}
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain p-6 md:p-8 custom-scrollbar">
          <div className="pb-[120px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
