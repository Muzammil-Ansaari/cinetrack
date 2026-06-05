"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  accentColor?: "amber" | "indigo" | "emerald" | "blue";
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  accentColor = "amber",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const accent = {
    amber:   { active: "bg-amber-500 text-zinc-950 border-amber-500 shadow-amber-500/20",   hover: "hover:border-amber-500/40 hover:text-amber-400" },
    indigo:  { active: "bg-indigo-500 text-white border-indigo-500 shadow-indigo-500/20",    hover: "hover:border-indigo-500/40 hover:text-indigo-400" },
    emerald: { active: "bg-emerald-500 text-zinc-950 border-emerald-500 shadow-emerald-500/20", hover: "hover:border-emerald-500/40 hover:text-emerald-400" },
    blue:    { active: "bg-blue-500 text-white border-blue-500 shadow-blue-500/20",          hover: "hover:border-blue-500/40 hover:text-blue-400" },
  }[accentColor];

  // Build the window of page numbers to show (at most 5 around current page)
  const buildPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    const delta = 2;
    const left  = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push("...");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const pages = buildPages();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem   = Math.min(currentPage * pageSize, totalItems);

  const btnBase = "h-8 min-w-[2rem] px-2 rounded-lg border text-[11px] font-extrabold transition-colors duration-150 flex items-center justify-center select-none";
  const btnInactive = `${btnBase} bg-zinc-900 border-zinc-800 text-zinc-400 ${accent.hover}`;
  const btnActive   = `${btnBase} border shadow-md font-black ${accent.active}`;
  const btnNav      = `${btnBase} bg-zinc-900/50 border-zinc-800 text-zinc-400 ${accent.hover} disabled:opacity-30 disabled:cursor-not-allowed`;

  return (
    <div className="flex flex-col items-center gap-3 mt-6 select-none">
      {/* Item count label */}
      <p className="text-[10px] text-zinc-500 font-semibold">
        Showing <span className="text-zinc-300 font-bold">{startItem}–{endItem}</span> of{" "}
        <span className="text-zinc-300 font-bold">{totalItems}</span> titles
      </p>

      {/* Controls row */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* First page */}
        <button
          className={btnNav}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Prev */}
        <button
          className={btnNav}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page numbers */}
        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-zinc-600 text-[11px] font-bold">…</span>
          ) : (
            <button
              key={p}
              className={p === currentPage ? btnActive : btnInactive}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          className={btnNav}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last page */}
        <button
          className={btnNav}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
