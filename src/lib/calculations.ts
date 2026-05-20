import type {
  AppSettings,
  JenisMedan,
  JenisMuatan,
  KategoriMuatan,
  SimpleTripInput,
  SimpleRitaseCalculation,
  SimpleTrip,
  VehicleRule,
} from "./types";

/** Jarak maksimal yang dipakai untuk perhitungan upah kilometer. */
export const KM_CAP_FOR_UPAH = 65;

/** Nilai pokok ketika dicentang (sesuai rules bisnis yang diminta). */
export const POKOK_AMOUNT = 40_000;

/** Tambahan upah ASPAL */
export const TAMBAHAN_UPAH_ASPAL = 20_000;

/** Tambahan upah jarak > 100 km */
export const TAMBAHAN_UPAH_GT_100 = 30_000;

/** Tambahan upah jarak > 200 km */
export const TAMBAHAN_UPAH_GT_200 = 50_000;

/** Faktor upah untuk medan BERAT */
export const FAKTOR_MEDAN_BERAT_UPAH = 1.2;

/** Faktor solar untuk medan BERAT */
export const FAKTOR_MEDAN_BERAT_SOLAR = 1.1;

/** Batas jam untuk uang makan (format HH:mm atau H:mm). */
export const MEAL_THRESHOLD_HOURS = [12, 19, 22] as const;

export const MEAL_INCREMENT = 5_500;

/** Parse "HH:mm" atau "H:mm" ke menit dari tengah malam; null jika invalid. */
export function parseJamToMinutes(jam: string): number | null {
  const trimmed = jam.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Jam tiba lebih awal dari jam berangkat pada hari yang sama (mis. berangkat 08:00, tiba 07:00). */
export function isJamTibaBeforeJamBerangkat(jamBerangkat: string, jamTiba: string): boolean {
  const start = parseJamToMinutes(jamBerangkat);
  const end = parseJamToMinutes(jamTiba);
  if (start === null || end === null) return false;
  return end < start;
}

/**
 * Uang makan berdasarkan jam pulang:
 * - >= 12:00 tambah MEAL_INCREMENT
 * - >= 19:00 tambah MEAL_INCREMENT
 * - >= 22:00 tambah MEAL_INCREMENT
 */
export function hitungUangMakan(jamPulang: string): number {
  const minutes = parseJamToMinutes(jamPulang);
  if (minutes === null) return 0;

  let total = 0;
  for (const hour of MEAL_THRESHOLD_HOURS) {
    const thresholdMinutes = hour * 60;
    if (minutes >= thresholdMinutes) total += MEAL_INCREMENT;
  }
  return total;
}

/**
 * Upah sebelum faktor medan BERAT.
 * Urutan: base km -> BALIK -> ASPAL -> bonus jarak -> (medan BERAT dikalikan terakhir oleh caller atau di sini lengkap?)
 * Spesifikasi: BERAT menyebut upah x 120% — diterapkan setelah tambahan lain.
 */
export function hitungUpahSebelumMedanBerat(params: {
  jarakKm: number;
  upahPerKm: number;
  kategoriMuatan: KategoriMuatan;
  jenisMuatan: JenisMuatan;
}): number {
  let upah =
    Math.min(Math.max(params.jarakKm, 0), KM_CAP_FOR_UPAH) * params.upahPerKm;

  if (params.kategoriMuatan === "BALIK") {
    upah = upah * 0.5;
  }

  if (params.jenisMuatan === "ASPAL") {
    upah += TAMBAHAN_UPAH_ASPAL;
  }

  const d = params.jarakKm;
  if (d > 100) upah += TAMBAHAN_UPAH_GT_100;
  if (d > 200) upah += TAMBAHAN_UPAH_GT_200;

  return upah;
}

export function aplikasikanMedanPadaUpah(
  upah: number,
  medan: JenisMedan
): number {
  if (medan === "BERAT") return Math.round(upah * FAKTOR_MEDAN_BERAT_UPAH);
  return Math.round(upah);
}

/** Solar sebelum faktor medan. */
export function hitungSolarSebelumMedanBerat(params: {
  jarakKm: number;
  solarPerKm: number;
}): number {
  return Math.max(params.jarakKm, 0) * params.solarPerKm;
}

export function aplikasikanMedanPadaSolar(
  solar: number,
  medan: JenisMedan
): number {
  if (medan === "BERAT") return Math.round(solar * FAKTOR_MEDAN_BERAT_SOLAR);
  return Math.round(solar);
}

export function hitungPokok(upahPokokDiberikan: boolean): number {
  return upahPokokDiberikan ? POKOK_AMOUNT : 0;
}

/** Satu blok perhitungan agar konsisten untuk form, tabel, dan CSV. */
export function hitungRitase(params: {
  jarakKm: number;
  kategoriMuatan: KategoriMuatan;
  jenisMuatan: JenisMuatan;
  jenisMedan: JenisMedan;
  jamPulang: string;
  upahPokokDiberikan: boolean;
  rule: VehicleRule;
}) {
  const upahDasar = hitungUpahSebelumMedanBerat({
    jarakKm: params.jarakKm,
    upahPerKm: params.rule.upahPerKm,
    kategoriMuatan: params.kategoriMuatan,
    jenisMuatan: params.jenisMuatan,
  });
  const upah = aplikasikanMedanPadaUpah(upahDasar, params.jenisMedan);

  const pokok = hitungPokok(params.upahPokokDiberikan);
  const uangMakan = hitungUangMakan(params.jamPulang);

  const solarDasar = hitungSolarSebelumMedanBerat({
    jarakKm: params.jarakKm,
    solarPerKm: params.rule.solarPerKm,
  });
  const solar = aplikasikanMedanPadaSolar(solarDasar, params.jenisMedan);

  const totalPremi = upah + pokok + uangMakan;
  const totalBiaya = totalPremi + solar;

  return {
    upah,
    pokok,
    uangMakan,
    totalPremi,
    solar,
    totalBiaya,
  };
}

export function findVehicleRuleByName(
  rules: VehicleRule[],
  nama: string
): VehicleRule | undefined {
  return rules.find((r) => r.nama === nama);
}

/**
 * Perhitungan ritase sederhana sesuai rules terbaru.
 * Semua layar/form sederhana harus memakai fungsi ini.
 */
export function calculateRitase(params: {
  formData: SimpleTripInput;
  existingTransactions: SimpleTrip[];
  settings: AppSettings;
}): SimpleRitaseCalculation {
  const { formData, existingTransactions, settings } = params;
  const jarakInput = Math.max(0, Number(formData.jarakKm) || 0);
  const jarakHitungUpah = Math.min(jarakInput, KM_CAP_FOR_UPAH);
  const vehicleRate = settings.vehicleRates[formData.jenisKendaraan];
  const kmPerLiter = Math.max(0.0001, Number(vehicleRate?.kmPerLiter) || 0.0001);
  const solarPricePerLiter = Math.max(0, Number(settings.solarPricePerLiter) || 0);
  const premiUpahPerKm = Math.max(0, Number(vehicleRate?.premiUpahPerKm) || 0);
  const premiBasePaySetting = Math.max(0, Number(settings.premiBasePay) || 0);
  const isPremiDriver = formData.statusSopir === "SOPIR PREMI";
  const literPerKm = 1 / kmPerLiter;
  const solarPerKm = solarPricePerLiter / kmPerLiter;
  let upahRitaseKm = 0;
  let tambahanUpahMuatan = 0;
  let upahPokok = 0;
  let upahUtamaReferensi = 0;
  let appliedPersentaseKembali: number | null = null;

  if (isPremiDriver) {
    let upahRitaseKmUtama = jarakHitungUpah * premiUpahPerKm;
    if (formData.jenisMedan === "BERAT") {
      upahRitaseKmUtama = upahRitaseKmUtama * FAKTOR_MEDAN_BERAT_UPAH;
    }
    upahRitaseKmUtama = Math.round(upahRitaseKmUtama);
    const tambahUtama =
      formData.jenisMuatan === "ASPAL"
        ? Math.max(0, Math.round(Number(settings.tambahanUpahRitaseAspal) || 0))
        : Math.max(0, Math.round(Number(settings.tambahanUpahRitaseNonAspal) || 0));
    upahUtamaReferensi = upahRitaseKmUtama + tambahUtama;

    if (formData.kategoriMuatan === "BALIK") {
      if (formData.muatanKembaliJenis === "KOSONG") {
        upahRitaseKm = 0;
        tambahanUpahMuatan = 0;
        upahPokok = 0;
      } else {
        const pctRaw = Number(settings.persentaseUpahMuatanKembaliBermuatan);
        const pct = Number.isFinite(pctRaw)
          ? Math.max(0, Math.min(100, pctRaw))
          : 30;
        appliedPersentaseKembali = pct;
        upahRitaseKm = Math.round(upahRitaseKmUtama * (pct / 100));
        tambahanUpahMuatan = Math.round(tambahUtama * (pct / 100));
        upahPokok = 0;
      }
    } else {
      upahRitaseKm = upahRitaseKmUtama;
      tambahanUpahMuatan = tambahUtama;
      upahPokok = getPokokForTransaction(
        formData,
        existingTransactions,
        premiBasePaySetting,
      );
    }
  }
  const upahRitase = upahRitaseKm + tambahanUpahMuatan;

  let totalLiterSolar = jarakInput / kmPerLiter;
  let totalSolar = totalLiterSolar * solarPricePerLiter;
  if (formData.jenisMedan === "BERAT") {
    totalSolar = totalSolar * FAKTOR_MEDAN_BERAT_SOLAR;
  }
  totalLiterSolar = Number(totalLiterSolar.toFixed(3));
  totalSolar = Math.round(totalSolar);

  const totalUpahSopir = upahRitase + upahPokok;
  const totalBiaya = totalUpahSopir + totalSolar;

  return {
    jarakInput,
    jarakHitungUpah,
    isPremiDriver,
    driverTypeLabel: isPremiDriver ? "Sopir Premi" : "Sopir Harian",
    premiBasePaySetting,
    premiUpahPerKm,
    upahPerKm: premiUpahPerKm,
    upahRitase,
    tambahanUpahMuatan,
    upahUtamaReferensi,
    appliedPersentaseKembali,
    upahPokokSetting: premiBasePaySetting,
    upahPokok,
    totalUpahSopir,
    solarPricePerLiter,
    kmPerLiter,
    literPerKm,
    solarPerKm,
    totalLiterSolar,
    totalSolar,
    totalBiaya,
  };
}

export function getPokokForTransaction(
  newData: Pick<SimpleTrip, "tanggal" | "namaSopir">,
  existingTransactions: SimpleTrip[],
  upahPokokSetting = 40_000,
): number {
  const tanggal = newData.tanggal.slice(0, 10);
  const namaSopir = newData.namaSopir.trim().toLowerCase();
  if (!tanggal || !namaSopir) {
    return upahPokokSetting;
  }

  /** Muatan kembali tanpa upah pokok tidak menghabiskan kuota harian. */
  const sudahDapatPokok = existingTransactions.some((item) => {
    return (
      item.tanggal.slice(0, 10) === tanggal &&
      item.namaSopir.trim().toLowerCase() === namaSopir &&
      item.upahPokok > 0
    );
  });
  return sudahDapatPokok ? 0 : upahPokokSetting;
}

/**
 * Interval menit untuk bentrok jadwal. Jika jam selesai sebelum jam mulai pada jam yang sama,
 * diperlakukan sebagai melewati tengah malam (+24 jam) agar data lama tetap konsisten.
 */
export function ritaseIntervalMinutes(
  jamAmbil: string,
  jamKirim: string,
): { start: number; end: number } | null {
  const a = parseJamToMinutes(jamAmbil);
  const b = parseJamToMinutes(jamKirim);
  if (a === null || b === null) return null;
  let start = a;
  let end = b;
  if (end < start) end += 24 * 60;
  else if (end === start) end = start + 1;
  return { start, end };
}

/** True jika dua interval saling tumpang tindih (ujung bersentuhan dianggap tidak bentrok). */
export function ritaseIntervalsOverlap(
  i1: { start: number; end: number },
  i2: { start: number; end: number },
): boolean {
  return i1.end > i2.start && i2.end > i1.start;
}

/** Cari ritase lain di tanggal & plat sama dengan rentang jam yang bertabrakan. */
export function findPlatJadwalConflict(params: {
  tanggal: string;
  platNomor: string;
  jamAmbil: string;
  jamKirim: string;
  existingTransactions: SimpleTrip[];
  excludeTripId?: string;
}): SimpleTrip | null {
  const date = params.tanggal.slice(0, 10);
  const plat = params.platNomor.trim().toLowerCase();
  if (!plat) return null;

  const baru = ritaseIntervalMinutes(params.jamAmbil, params.jamKirim);
  if (!baru) return null;

  for (const t of params.existingTransactions) {
    if (params.excludeTripId && t.id === params.excludeTripId) continue;
    if (t.tanggal.slice(0, 10) !== date) continue;
    if (t.platNomor.trim().toLowerCase() !== plat) continue;
    const ada = ritaseIntervalMinutes(t.jamAmbil, t.jamKirim);
    if (!ada) continue;
    if (ritaseIntervalsOverlap(baru, ada)) return t;
  }
  return null;
}

/**
 * Sopir yang sama tidak boleh punya jadwal tumpang tindih pada kendaraan berbeda (beda plat)
 * pada waktu yang sama — satu sopir tidak bisa mengemudi dua truk bersamaan.
 */
export function findSopirBedaPlatJadwalConflict(params: {
  tanggal: string;
  namaSopir: string;
  platNomor: string;
  jamAmbil: string;
  jamKirim: string;
  existingTransactions: SimpleTrip[];
  excludeTripId?: string;
}): SimpleTrip | null {
  const date = params.tanggal.slice(0, 10);
  const sopir = params.namaSopir.trim().toLowerCase();
  const plat = params.platNomor.trim().toLowerCase();
  if (!sopir || !plat) return null;

  const baru = ritaseIntervalMinutes(params.jamAmbil, params.jamKirim);
  if (!baru) return null;

  for (const t of params.existingTransactions) {
    if (params.excludeTripId && t.id === params.excludeTripId) continue;
    if (t.tanggal.slice(0, 10) !== date) continue;
    if (t.namaSopir.trim().toLowerCase() !== sopir) continue;
    if (t.platNomor.trim().toLowerCase() === plat) continue;
    const ada = ritaseIntervalMinutes(t.jamAmbil, t.jamKirim);
    if (!ada) continue;
    if (ritaseIntervalsOverlap(baru, ada)) return t;
  }
  return null;
}
