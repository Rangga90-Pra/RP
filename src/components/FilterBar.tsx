"use client";

import type { DashboardFilters } from "@/lib/types";

interface Props {
  filters: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  jenisTrukOptions: string[];
}

export function FilterBar({ filters, onChange, jenisTrukOptions }: Props) {
  const field = (
    key: keyof DashboardFilters,
    label: string,
    type: "text" | "date" = "text",
    placeholder?: string,
  ) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        type={type}
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Filter</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {field("tanggalMulai", "Tanggal mulai", "date")}
        {field("tanggalAkhir", "Tanggal akhir", "date")}
        {field("namaSopir", "Nama sopir", "text", "Cari nama…")}
        {field("namaPaket", "Paket pekerjaan", "text", "Cari paket…")}
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Jenis truk
          <select
            value={filters.jenisTruk}
            onChange={(e) =>
              onChange({ ...filters, jenisTruk: e.target.value })
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Semua</option>
            {jenisTrukOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Jenis muatan
          <select
            value={filters.jenisMuatan}
            onChange={(e) =>
              onChange({ ...filters, jenisMuatan: e.target.value })
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Semua</option>
            <option value="ASPAL">ASPAL</option>
            <option value="NON ASPAL">NON ASPAL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Jenis medan
          <select
            value={filters.jenisMedan}
            onChange={(e) =>
              onChange({ ...filters, jenisMedan: e.target.value })
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Semua</option>
            <option value="MUDAH">MUDAH</option>
            <option value="BERAT">BERAT</option>
          </select>
        </label>
        {field(
          "lokasiAmbil",
          "Lokasi ambil",
          "text",
          "Berisi teks lokasi…",
        )}
        {field(
          "lokasiBongkar",
          "Lokasi bongkar",
          "text",
          "Berisi teks lokasi…",
        )}
      </div>
    </section>
  );
}
