"use client";

import type { TripComputed } from "@/lib/types";
import { formatRupiah } from "@/lib/format";

interface Props {
  rows: TripComputed[];
  onEdit: (trip: TripComputed) => void;
  onDelete: (id: string) => void;
}

export function TransactionsTable({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Belum ada data yang cocok dengan filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1400px] w-full divide-y divide-slate-200 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-2 py-2">No</th>
            <th className="px-2 py-2 whitespace-nowrap">Tanggal</th>
            <th className="px-2 py-2">Sopir</th>
            <th className="px-2 py-2">Plat</th>
            <th className="px-2 py-2">Paket</th>
            <th className="px-2 py-2 min-w-[100px]">Ambil</th>
            <th className="px-2 py-2 min-w-[100px]">Bongkar</th>
            <th className="px-2 py-2 text-right">Km</th>
            <th className="px-2 py-2 whitespace-nowrap">Brkt</th>
            <th className="px-2 py-2 whitespace-nowrap">Plg</th>
            <th className="px-2 py-2">Kat.</th>
            <th className="px-2 py-2">Muatan</th>
            <th className="px-2 py-2">Truk</th>
            <th className="px-2 py-2">Medan</th>
            <th className="px-2 py-2 text-right">Upah</th>
            <th className="px-2 py-2 text-right">Pokok</th>
            <th className="px-2 py-2 text-right">Makan</th>
            <th className="px-2 py-2 text-right">Premi</th>
            <th className="px-2 py-2 text-right">Solar</th>
            <th className="px-2 py-2 text-right">Total</th>
            <th className="px-2 py-2">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t, i) => (
            <tr key={t.id} className="even:bg-slate-50/60 hover:bg-teal-50/40">
              <td className="px-2 py-2 text-slate-500">{i + 1}</td>
              <td className="px-2 py-2 whitespace-nowrap text-slate-800">
                {t.tanggal}
              </td>
              <td className="px-2 py-2 font-medium text-slate-900">
                {t.namaSopir}
              </td>
              <td className="px-2 py-2 text-slate-700">{t.platNomor}</td>
              <td className="px-2 py-2 text-slate-700">{t.namaPaket}</td>
              <td className="px-2 py-2 text-slate-600">{t.lokasiAmbil}</td>
              <td className="px-2 py-2 text-slate-600">{t.lokasiBongkar}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {t.jarakKm}
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-slate-700">
                {t.jamBerangkat}
              </td>
              <td className="px-2 py-2 whitespace-nowrap text-slate-700">
                {t.jamPulang}
              </td>
              <td className="px-2 py-2 text-slate-600">{t.kategoriMuatan}</td>
              <td className="px-2 py-2 text-slate-600">{t.jenisMuatan}</td>
              <td className="px-2 py-2 text-slate-600">{t.jenisTruk}</td>
              <td className="px-2 py-2 text-slate-600">{t.jenisMedan}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatRupiah(t.upah)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatRupiah(t.pokok)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatRupiah(t.uangMakan)}
              </td>
              <td className="px-2 py-2 text-right font-medium tabular-nums text-teal-900">
                {formatRupiah(t.totalPremi)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatRupiah(t.solar)}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                {formatRupiah(t.totalBiaya)}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="mr-1 text-teal-700 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="text-rose-600 hover:underline"
                >
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
