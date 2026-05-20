"use client";

import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_DRIVERS,
  DEFAULT_VEHICLE_RULES,
  STORAGE_KEYS,
} from "./defaults";
import {
  normalizeKategoriMuatan,
  normalizeMuatanKembaliJenis,
  normalizeStatusSopir,
  type AppSettings,
  type Driver,
  type Kendaraan,
  type Personil,
  type SimpleTrip,
  type Trip,
  type VehicleRule,
} from "./types";

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadDrivers(): Driver[] {
  const data = loadJson<Driver[]>(STORAGE_KEYS.drivers, []);
  return data.length ? data : [...DEFAULT_DRIVERS];
}

export function saveDrivers(list: Driver[]): void {
  saveJson(STORAGE_KEYS.drivers, list);
}

export function loadVehicleRules(): VehicleRule[] {
  const data = loadJson<VehicleRule[]>(STORAGE_KEYS.vehicleRules, []);
  return data.length ? data : [...DEFAULT_VEHICLE_RULES];
}

export function saveVehicleRules(list: VehicleRule[]): void {
  saveJson(STORAGE_KEYS.vehicleRules, list);
}

export function loadTrips(): Trip[] {
  return loadJson<Trip[]>(STORAGE_KEYS.trips, []);
}

export function saveTrips(list: Trip[]): void {
  saveJson(STORAGE_KEYS.trips, list);
}

export function loadSimpleVehicleRules(): VehicleRule[] {
  const data = loadJson<VehicleRule[]>(STORAGE_KEYS.simpleVehicleRules, []);
  return data.length ? data : [...DEFAULT_VEHICLE_RULES];
}

export function saveSimpleVehicleRules(list: VehicleRule[]): void {
  saveJson(STORAGE_KEYS.simpleVehicleRules, list);
}

export function loadSimpleTrips(): SimpleTrip[] {
  return loadJson<SimpleTrip[]>(STORAGE_KEYS.simpleTrips, []);
}

export function saveSimpleTrips(list: SimpleTrip[]): void {
  saveJson(STORAGE_KEYS.simpleTrips, list);
}

export function loadPersonil(): Personil[] {
  const rows = loadJson<Personil[]>(STORAGE_KEYS.personil, []);
  return rows.map((p) => ({
    ...p,
    statusSopir: normalizeStatusSopir(String(p.statusSopir ?? "")),
  }));
}

export function savePersonil(list: Personil[]): void {
  saveJson(STORAGE_KEYS.personil, list);
}

export function loadKendaraan(): Kendaraan[] {
  return loadJson<Kendaraan[]>(STORAGE_KEYS.kendaraan, []);
}

export function saveKendaraan(list: Kendaraan[]): void {
  saveJson(STORAGE_KEYS.kendaraan, list);
}

export function loadRitaseTransactions(): SimpleTrip[] {
  const rows = loadJson<SimpleTrip[]>(STORAGE_KEYS.ritaseTransactions, []);
  return rows.map((row) => {
    const statusSopir = normalizeStatusSopir(String(row.statusSopir ?? ""));
    return {
      ...row,
      statusSopir,
      kategoriMuatan: normalizeKategoriMuatan(row.kategoriMuatan),
      muatanKembaliJenis: normalizeMuatanKembaliJenis(row.muatanKembaliJenis),
      muatanKembaliUraian:
        typeof row.muatanKembaliUraian === "string" ? row.muatanKembaliUraian : "",
      jenisMuatan:
        row.jenisMuatan === "ASPAL" || row.jenisMuatan === "NON ASPAL"
          ? row.jenisMuatan
          : "NON ASPAL",
      tambahanUpahMuatan:
        typeof row.tambahanUpahMuatan === "number" ? row.tambahanUpahMuatan : 0,
      isPremiDriver:
        typeof row.isPremiDriver === "boolean"
          ? row.isPremiDriver
          : statusSopir !== "SOPIR HARIAN",
      premiBasePaySetting:
        typeof row.premiBasePaySetting === "number"
          ? row.premiBasePaySetting
          : typeof row.upahPokokSetting === "number"
            ? row.upahPokokSetting
            : 40000,
      premiUpahPerKm:
        typeof row.premiUpahPerKm === "number"
          ? row.premiUpahPerKm
          : typeof row.upahPerKm === "number"
            ? row.upahPerKm
            : 0,
      upahPokokSetting:
        typeof row.upahPokokSetting === "number"
          ? row.upahPokokSetting
          : typeof row.upahPokok === "number"
            ? row.upahPokok
            : 40000,
    };
  });
}

export function saveRitaseTransactions(list: SimpleTrip[]): void {
  saveJson(STORAGE_KEYS.ritaseTransactions, list);
}

export function getAppSettings(): AppSettings {
  const data = loadJson<Partial<AppSettings> | null>(STORAGE_KEYS.appSettings, null);
  const defaults = getDefaultSettings();
  const merged: AppSettings = {
    solarPricePerLiter:
      typeof data?.solarPricePerLiter === "number"
        ? data.solarPricePerLiter
        : defaults.solarPricePerLiter,
    premiBasePay:
      typeof data?.premiBasePay === "number"
        ? data.premiBasePay
        : (() => {
            const candidateRates = data?.vehicleRates;
            if (candidateRates && typeof candidateRates === "object") {
              for (const value of Object.values(candidateRates)) {
                if (value && typeof value === "object") {
                  const oldRate = value as { upahPokok?: unknown };
                  if (typeof oldRate.upahPokok === "number") {
                    return oldRate.upahPokok;
                  }
                }
              }
            }
            return defaults.premiBasePay;
          })(),
    tambahanUpahRitaseAspal:
      typeof data?.tambahanUpahRitaseAspal === "number"
        ? data.tambahanUpahRitaseAspal
        : defaults.tambahanUpahRitaseAspal,
    tambahanUpahRitaseNonAspal:
      typeof data?.tambahanUpahRitaseNonAspal === "number"
        ? data.tambahanUpahRitaseNonAspal
        : defaults.tambahanUpahRitaseNonAspal,
    persentaseUpahMuatanKembaliBermuatan:
      typeof data?.persentaseUpahMuatanKembaliBermuatan === "number"
        ? data.persentaseUpahMuatanKembaliBermuatan
        : defaults.persentaseUpahMuatanKembaliBermuatan,
    vehicleRates: { ...defaults.vehicleRates },
  };
  const inputRates = data?.vehicleRates;
  if (inputRates && typeof inputRates === "object") {
    for (const key of Object.keys(defaults.vehicleRates) as Array<
      keyof AppSettings["vehicleRates"]
    >) {
      const src = inputRates[key];
      if (src && typeof src === "object") {
        merged.vehicleRates[key] = {
          kmPerLiter:
            typeof src.kmPerLiter === "number"
              ? src.kmPerLiter
              : defaults.vehicleRates[key].kmPerLiter,
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
  saveJson(STORAGE_KEYS.appSettings, merged);
  return merged;
}

export function saveAppSettings(settings: AppSettings): void {
  saveJson(STORAGE_KEYS.appSettings, settings);
}

export function getDefaultSettings(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS)) as AppSettings;
}
