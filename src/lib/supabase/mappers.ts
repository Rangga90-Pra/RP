import { getDefaultSettings } from "@/lib/storage";
import {
  normalizeKategoriMuatan,
  normalizeMuatanKembaliJenis,
  normalizeStatusSopir,
  type AppSettings,
  type Branch,
  type Kendaraan,
  type Personil,
  type SimpleTrip,
  type UserProfile,
} from "@/lib/types";

export function mapProfileRow(row: {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  branch_id: string | null;
}): UserProfile {
  const role: UserProfile["role"] =
  row.role === "ADMIN_PUSAT" ? "ADMIN_PUSAT" :
  row.role === "ID_MASTER"   ? "ID_MASTER"   :
  "ADMIN_CABANG";
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role,
    branchId: row.branch_id,
  };
}

export function mapBranchRow(row: { id: string; name: string; code: string | null; created_at: string }): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
  };
}

export function mapPersonilRow(row: {
  id: string;
  branch_id: string;
  nama_sopir: string;
  status_sopir: string;
  status_aktif: string;
}): Personil {
  return {
    id: row.id,
    branchId: row.branch_id,
    namaSopir: row.nama_sopir,
    statusSopir: normalizeStatusSopir(row.status_sopir),
    statusAktif: row.status_aktif as Personil["statusAktif"],
  };
}

export function mapKendaraanRow(row: {
  id: string;
  branch_id: string;
  jenis_kendaraan: string;
  plat_nomor: string;
  status_aktif: string;
}): Kendaraan {
  return {
    id: row.id,
    branchId: row.branch_id,
    jenisKendaraan: row.jenis_kendaraan as Kendaraan["jenisKendaraan"],
    platNomor: row.plat_nomor,
    statusAktif: row.status_aktif as Kendaraan["statusAktif"],
  };
}

export function mapTransactionRow(row: {
  id: string;
  branch_id: string;
  tanggal: string;
  payload: Record<string, unknown>;
}): SimpleTrip {
  const rowPayload = row.payload as Partial<SimpleTrip>;
  const statusSopir = normalizeStatusSopir(String(rowPayload.statusSopir ?? ""));
  return {
    ...(rowPayload as SimpleTrip),
    id: row.id,
    branchId: row.branch_id,
    tanggal: String(rowPayload.tanggal ?? row.tanggal).slice(0, 10),
    statusSopir,
    kategoriMuatan: normalizeKategoriMuatan(rowPayload.kategoriMuatan),
    muatanKembaliJenis: normalizeMuatanKembaliJenis(rowPayload.muatanKembaliJenis),
    muatanKembaliUraian:
      typeof rowPayload.muatanKembaliUraian === "string" ? rowPayload.muatanKembaliUraian : "",
    jenisMuatan:
      rowPayload.jenisMuatan === "ASPAL" || rowPayload.jenisMuatan === "NON ASPAL"
        ? rowPayload.jenisMuatan
        : "NON ASPAL",
    tambahanUpahMuatan:
      typeof rowPayload.tambahanUpahMuatan === "number" ? rowPayload.tambahanUpahMuatan : 0,
    isPremiDriver:
      typeof rowPayload.isPremiDriver === "boolean" ? rowPayload.isPremiDriver : statusSopir !== "SOPIR HARIAN",
    premiBasePaySetting:
      typeof rowPayload.premiBasePaySetting === "number"
        ? rowPayload.premiBasePaySetting
        : typeof rowPayload.upahPokokSetting === "number"
          ? rowPayload.upahPokokSetting
          : 40000,
    premiUpahPerKm:
      typeof rowPayload.premiUpahPerKm === "number"
        ? rowPayload.premiUpahPerKm
        : typeof rowPayload.upahPerKm === "number"
          ? rowPayload.upahPerKm
          : 0,
    upahPokokSetting:
      typeof rowPayload.upahPokokSetting === "number"
        ? rowPayload.upahPokokSetting
        : typeof rowPayload.upahPokok === "number"
          ? rowPayload.upahPokok
          : 40000,
    createdAt: typeof rowPayload.createdAt === "string" ? rowPayload.createdAt : new Date().toISOString(),
  };
}

export function tripToPayload(trip: SimpleTrip): Record<string, unknown> {
  const { branchId: _b, ...rest } = trip;
  return rest as Record<string, unknown>;
}

export function mergeAppSettingsJson(raw: unknown): AppSettings {
  const data = raw && typeof raw === "object" ? (raw as Partial<AppSettings>) : {};
  const defaults = getDefaultSettings();
  const merged: AppSettings = {
    solarPricePerLiter:
      typeof data.solarPricePerLiter === "number" ? data.solarPricePerLiter : defaults.solarPricePerLiter,
    premiBasePay:
      typeof data.premiBasePay === "number"
        ? data.premiBasePay
        : (() => {
            const candidateRates = data.vehicleRates;
            if (candidateRates && typeof candidateRates === "object") {
              for (const value of Object.values(candidateRates)) {
                if (value && typeof value === "object") {
                  const oldRate = value as { upahPokok?: unknown };
                  if (typeof oldRate.upahPokok === "number") return oldRate.upahPokok;
                }
              }
            }
            return defaults.premiBasePay;
          })(),
    tambahanUpahRitaseAspal:
      typeof data.tambahanUpahRitaseAspal === "number"
        ? data.tambahanUpahRitaseAspal
        : defaults.tambahanUpahRitaseAspal,
    tambahanUpahRitaseNonAspal:
      typeof data.tambahanUpahRitaseNonAspal === "number"
        ? data.tambahanUpahRitaseNonAspal
        : defaults.tambahanUpahRitaseNonAspal,
    persentaseUpahMuatanKembaliBermuatan:
      typeof data.persentaseUpahMuatanKembaliBermuatan === "number"
        ? data.persentaseUpahMuatanKembaliBermuatan
        : defaults.persentaseUpahMuatanKembaliBermuatan,
    vehicleRates: { ...defaults.vehicleRates },
  };
  const inputRates = data.vehicleRates;
  if (inputRates && typeof inputRates === "object") {
    for (const key of Object.keys(defaults.vehicleRates) as Array<keyof AppSettings["vehicleRates"]>) {
      const src = inputRates[key];
      if (src && typeof src === "object") {
        merged.vehicleRates[key] = {
          kmPerLiter:
            typeof src.kmPerLiter === "number" ? src.kmPerLiter : defaults.vehicleRates[key].kmPerLiter,
          premiUpahPerKm:
            typeof src.premiUpahPerKm === "number"
              ? src.premiUpahPerKm
              : (() => {
                  const oldRate = src as { upahPerKm?: unknown };
                  return typeof oldRate.upahPerKm === "number"
                    ? oldRate.upahPerKm
                    : defaults.vehicleRates[key].premiUpahPerKm;
                })(),
        };
      }
    }
  }
  return merged;
}
