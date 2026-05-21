"use client";

import { useMemo, useState } from "react";
import type {
  DashboardFilters,
  TripComputed,
  Trip,
  VehicleRule,
} from "@/lib/types";
import { tripMatchesDashboardFilters } from "@/lib/filters";
import { computeTrip } from "@/lib/tripComputation";
import { formatRupiah } from "@/lib/format";
import { rowsToCsv, triggerDownloadCsv } from "@/lib/csv";

interface AggRow {
  key: string;
  label: string;
  ritase: number;
  km: number;
  upah: number;
  pokok: number;
  makan: number;
  premi: number;
  solar: number;
  biaya: number;
}

type RekapTab = "sopir" | "paket" | "truk" | "rute";

interface Props {
  allTrips: Trip[];
  vehicleRules: VehicleRule[];
  filters: DashboardFilters;
}

function aggregateBy(
  rows: TripComputed[],
  getLabel: (t: TripComputed) => string,
): AggRow[] {
  const map = new Map<string, AggRow>();

  for (const t of rows) {
    const label = getLabel(t) || "(kosong)";
    let cur = map.get(label);
    if (!cur) {
      cur = {
        key: label,
        label,
        ritase: 0,
        km: 0,
        upah: 0,
        pokok: 0,
        makan: 0,
        premi: 0,
        solar: 0,
        biaya: 0,
      };
      map.set(label, cur);
    }
    cur.ritase += 1;
    cur.km += t.jarakKm;
    cur.upah += t.upah;
    cur.pokok += t.pokok;
    cur.makan += t.uangMakan;
    cur.premi += t.totalPremi;
    cur.solar += t.solar;
    cur.biaya += t.totalBiaya;
  }

  return Array.from(map.values()).sort(
    (a, b) => b.biaya - a.biaya || a.label.localeCompare(b.label, "id"),
  );
}

export function RekapSection({ allTrips, vehicleRules, filters }: Props) {
  const [tab, setTab] = useState<RekapTab>("sopir");

  const computed = useMemo(() => {
    const filtered = allTrips.filter((t) =>
      tripMatchesDashboardFilters(t, filters),
    );
    return filtered.map((t) => computeTrip(t, vehicleRules));
  }, [allTrips, vehicleRules, filters]);

  const aggRows = useMemo(() => {
    switch (tab) {
      case "sopir":
        return aggregateBy(computed, (t) => t.namaSopir.trim());
      case "paket":
        return aggregateBy(computed, (t) => t.namaPaket.trim());
      case "truk":
        return aggregateBy(computed, (t) => t.jenisTruk.trim());
      case "rute":
        return aggregateBy(computed, (t) => {
          const a = t.lokasiAmbil.trim();
          const b = t.lokasiBongkar.trim();
          if (!a && !b) return "(kosong)";
          return `${a} → ${b}`;
        });
      default:
        return [];
    }
  }, [computed, tab]);

  const tabLabel = (t: RekapTab) =>
    ({
      sopir: "Rekap per sopir",
      paket: "Rekap per muatan",
      truk: "Rekap per kendaraan",
      rute: "Rekap per rute",
    })[t];

  const groupingHeader = (): string =>
    ({
      sopir: "Sopir",
      paket: "Jenis Muatan",
      truk: "Jenis kendaraan / truk",
      rute: "Rute (ambil → bongkar)",
    })[tab];

  const exportRekapCsv = () => {
    const h = groupingHeader();
    const header = [
      h,
      "Ritase",
      "Km",
      "Upah",
      "Pokok",
      "Uang makan",
      "Total premi",
      "Solar",
      "Total biaya",
    ];
    const rows: (string | number)[][] = [header];
    aggRows.forEach((r) => {
      rows.push([
        r.label,
        r.ritase,
        Math.round(r.km * 100) / 100,
        r.upah,
        r.pokok,
        r.makan,
        r.premi,
        r.solar,
        r.biaya,
      ]);
    });
    const safeTab = tab;
    triggerDownloadCsv(
      `rekap-${safeTab}-${new Date().toISOString().slice(0, 10)}.csv`,
      rowsToCsv(rows),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 rounded-lg bg-slate-200/60 p-1">
          {(
            [
              ["sopir", "Per sopir"],
              ["paket", "Per muatan"],
              ["truk", "Per kendaraan"],
              ["rute", "Per rute"],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                tab === id
                  ? "bg-white text-brand-dark shadow"
                  : "text-slate-700 hover:bg-white/70"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportRekapCsv}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Export CSV rekap ({tab})
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {tabLabel(tab)}
          </h2>
          <p className="text-xs text-slate-500">
            Menggunakan pasangan filter yang sama dengan tab Beranda. Baris ritase saat ini:{" "}
            {computed.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">{groupingHeader()}</th>
                <th className="px-3 py-2 text-right">Ritase</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2 text-right">Upah</th>
                <th className="px-3 py-2 text-right">Pokok</th>
                <th className="px-3 py-2 text-right">Makan</th>
                <th className="px-3 py-2 text-right">Premi</th>
                <th className="px-3 py-2 text-right">Solar</th>
                <th className="px-3 py-2 text-right">Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aggRows.map((r) => (
                <tr key={r.key} className="even:bg-slate-50/40">
                  <td className="max-w-[360px] px-3 py-2 font-medium text-slate-900">
                    <span className="line-clamp-2">{r.label}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {r.ritase}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {r.km.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRupiah(r.upah)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRupiah(r.pokok)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRupiah(r.makan)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-teal-900">
                    {formatRupiah(r.premi)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRupiah(r.solar)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatRupiah(r.biaya)}
                  </td>
                </tr>
              ))}
              {aggRows.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-slate-500"
                    colSpan={9}
                  >
                    Tidak ada data dalam filter aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
