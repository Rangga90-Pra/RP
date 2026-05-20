"use client";

import { formatRupiah } from "@/lib/format";
import { SUMMARY_LABELS } from "./dashboardConstants";

interface SummaryShape {
  n: number;
  totalKm: number;
  totalUpah: number;
  totalPokok: number;
  totalMakan: number;
  totalPremi: number;
  totalSolar: number;
  totalBiaya: number;
  avgPerRitase: number;
  avgPerKm: number;
}

interface Props {
  summary: SummaryShape;
}

export function SummaryCards({ summary }: Props) {
  const values: string[] = [
    String(summary.n),
    `${summary.totalKm.toLocaleString("id-ID")} km`,
    formatRupiah(summary.totalUpah),
    formatRupiah(summary.totalPokok),
    formatRupiah(summary.totalMakan),
    formatRupiah(summary.totalPremi),
    formatRupiah(summary.totalSolar),
    formatRupiah(summary.totalBiaya),
    formatRupiah(summary.avgPerRitase),
    formatRupiah(summary.avgPerKm),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {SUMMARY_LABELS.map((label, i) => (
        <div
          key={label}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-teal-900/5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
            {values[i]}
          </p>
        </div>
      ))}
    </div>
  );
}
