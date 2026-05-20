export type KategoriMuatan = "UTAMA" | "BALIK";
/** Muatan kembali: bermuatan (dapat % upah utama) atau kosong (hanya solar). */
export type MuatanKembaliJenis = "BERMUATAN" | "KOSONG";
export type JenisMuatan = "ASPAL" | "NON ASPAL";
export type JenisMedan = "MUDAH" | "BERAT";

export interface Driver {
  id: string;
  nama: string;
  platNomor: string;
  jenisKendaraan: string;
  aktif: boolean;
}

export interface VehicleRule {
  id: string;
  /** Nama jenis truk / kendaraan (digunakan di form ritase) */
  nama: SimpleVehicleType;
  upahPokokDefault: number;
  upahPerKm: number;
  kmPerLiter: number;
  solarPricePerLiter: number;
  solarPerKm: number;
}

export interface TripInput {
  tanggal: string;
  namaSopir: string;
  platNomor: string;
  namaPaket: string;
  lokasiAmbil: string;
  lokasiBongkar: string;
  jarakKm: number;
  jamBerangkat: string;
  jamPulang: string;
  kategoriMuatan: KategoriMuatan;
  jenisMuatan: JenisMuatan;
  jenisTruk: string;
  jenisMedan: JenisMedan;
  upahPokokDiberikan: boolean;
}

export interface Trip extends TripInput {
  id: string;
}

export interface TripComputed extends Trip {
  upah: number;
  pokok: number;
  uangMakan: number;
  totalPremi: number;
  solar: number;
  totalBiaya: number;
}

export interface DashboardFilters {
  tanggalMulai: string;
  tanggalAkhir: string;
  namaSopir: string;
  namaPaket: string;
  jenisTruk: string;
  jenisMuatan: string;
  jenisMedan: string;
  lokasiAmbil: string;
  lokasiBongkar: string;
}

export type SimpleVehicleType =
  | "DT KECIL"
  | "DT BESAR"
  | "TRONTON"
  | "TAFT/COLDBOX"
  | "ELF BAK"
  | "L300"
  | "HINO DUTRO"
  | "SL HINO"
  | "SL FUSO"
  | "TRAILER FUSO";

export type StatusSopir = "SOPIR HARIAN" | "SOPIR PREMI";

/** Menggabungkan nilai lama SOPIR RITASE ke SOPIR PREMI. */
export function normalizeKategoriMuatan(raw: unknown): KategoriMuatan {
  return raw === "BALIK" ? "BALIK" : "UTAMA";
}

export function normalizeMuatanKembaliJenis(raw: unknown): MuatanKembaliJenis {
  return raw === "BERMUATAN" ? "BERMUATAN" : "KOSONG";
}

export function normalizeStatusSopir(raw: string): StatusSopir {
  const t = raw.trim().toUpperCase();
  if (t === "SOPIR HARIAN") return "SOPIR HARIAN";
  if (t === "SOPIR RITASE" || t === "SOPIR PREMI") return "SOPIR PREMI";
  return "SOPIR PREMI";
}
export type StatusAktif = "AKTIF" | "NONAKTIF";

/** Role Supabase Auth + tabel profiles. */
export type UserRole = "ADMIN_PUSAT" | "ADMIN_CABANG" | "ID_MASTER";

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  createdAt?: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  branchId: string | null;
}

export interface Personil {
  id: string;
  /** Cabang pemilik data (wajib di mode cloud). */
  branchId?: string;
  namaSopir: string;
  statusSopir: StatusSopir;
  statusAktif: StatusAktif;
}

export interface Kendaraan {
  id: string;
  branchId?: string;
  jenisKendaraan: SimpleVehicleType;
  platNomor: string;
  statusAktif: StatusAktif;
}

export interface SimpleTripInput {
  tanggal: string;
  namaSopir: string;
  statusSopir: StatusSopir;
  platNomor: string;
  namaPaketPekerjaan: string;
  lokasiAmbil: string;
  lokasiKirim: string;
  /** Jam berangkat (UI); disimpan sebagai jamAmbil. */
  jamAmbil: string;
  /** Jam tiba (UI); disimpan sebagai jamKirim. */
  jamKirim: string;
  jarakKm: number;
  jenisKendaraan: SimpleVehicleType;
  jenisMedan: JenisMedan;
  jenisMuatan: JenisMuatan;
  kategoriMuatan: KategoriMuatan;
  /** Dipakai jika kategoriMuatan === BALIK. */
  muatanKembaliJenis: MuatanKembaliJenis;
  /** Wajib diisi jika BALIK + bermuatan: uraian muatan yang dibawa. */
  muatanKembaliUraian?: string;
  /** Catatan muatan / keperluan kendaraan / lainnya (opsional). */
  keterangan?: string;
}

export interface SimpleTrip extends SimpleTripInput {
  id: string;
  /** Cabang ritase (wajib di mode cloud). */
  branchId?: string;
  isPremiDriver: boolean;
  premiBasePaySetting: number;
  premiUpahPerKm: number;
  upahPerKm: number;
  upahPokokSetting: number;
  solarPerKm: number;
  kmPerLiter: number;
  solarPricePerLiter: number;
  jarakDihitung: number;
  /** Tambahan upah ritase karena jenis muatan (nilai saat transaksi disimpan). */
  tambahanUpahMuatan: number;
  upahRitase: number;
  upahPokok: number;
  totalUpahSopir: number;
  totalLiterSolar: number;
  totalSolar: number;
  totalBiaya: number;
  createdAt: string;
}

export interface SimpleRitaseCalculation {
  jarakInput: number;
  jarakHitungUpah: number;
  isPremiDriver: boolean;
  driverTypeLabel: "Sopir Premi" | "Sopir Harian";
  premiBasePaySetting: number;
  premiUpahPerKm: number;
  upahPerKm: number;
  upahRitase: number;
  /** Tambahan dari pengaturan muatan (Aspal / Non Aspal), untuk sopir premi. */
  tambahanUpahMuatan: number;
  /** Upah ritase + tambahan seolah muatan utama (referensi; 0 untuk sopir harian). */
  upahUtamaReferensi: number;
  /** Persentase diterapkan pada muatan kembali bermuatan; null jika tidak relevan. */
  appliedPersentaseKembali: number | null;
  upahPokokSetting: number;
  upahPokok: number;
  totalUpahSopir: number;
  solarPricePerLiter: number;
  kmPerLiter: number;
  literPerKm: number;
  solarPerKm: number;
  totalLiterSolar: number;
  totalSolar: number;
  totalBiaya: number;
}

export type DashboardPeriodType = "harian" | "bulanan" | "tahunan";

export interface DashboardPeriodState {
  periodType: DashboardPeriodType;
  /** YYYY-MM-DD */
  selectedDate: string;
  /** YYYY-MM */
  selectedMonth: string;
  selectedYear: number;
}

export interface AppSettings {
  solarPricePerLiter: number;
  premiBasePay: number;
  /** Tambahan upah ritase jika muatan Aspal (sopir premi). */
  tambahanUpahRitaseAspal: number;
  /** Tambahan upah ritase jika muatan Non Aspal (biasanya 0). */
  tambahanUpahRitaseNonAspal: number;
  /** Persentase upah muatan utama untuk muatan kembali bermuatan (0–100, default 30). */
  persentaseUpahMuatanKembaliBermuatan: number;
  vehicleRates: Record<
    SimpleVehicleType,
    {
      kmPerLiter: number;
      premiUpahPerKm: number;
    }
  >;
}
