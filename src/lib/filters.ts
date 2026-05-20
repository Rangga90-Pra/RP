import type { DashboardFilters, Trip } from "./types";

export function tripMatchesDashboardFilters(
  trip: Trip,
  filters: DashboardFilters,
): boolean {
  const d = trip.tanggal.slice(0, 10);
  if (filters.tanggalMulai && d < filters.tanggalMulai) return false;
  if (filters.tanggalAkhir && d > filters.tanggalAkhir) return false;
  if (
    filters.namaSopir &&
    !trip.namaSopir.toLowerCase().includes(filters.namaSopir.toLowerCase())
  )
    return false;
  if (
    filters.namaPaket &&
    !trip.namaPaket.toLowerCase().includes(filters.namaPaket.toLowerCase())
  )
    return false;
  if (filters.jenisTruk && trip.jenisTruk !== filters.jenisTruk) return false;
  if (filters.jenisMuatan && trip.jenisMuatan !== filters.jenisMuatan)
    return false;
  if (filters.jenisMedan && trip.jenisMedan !== filters.jenisMedan)
    return false;
  if (
    filters.lokasiAmbil &&
    !trip.lokasiAmbil.toLowerCase().includes(filters.lokasiAmbil.toLowerCase())
  )
    return false;
  if (
    filters.lokasiBongkar &&
    !trip.lokasiBongkar
      .toLowerCase()
      .includes(filters.lokasiBongkar.toLowerCase())
  )
    return false;
  return true;
}
