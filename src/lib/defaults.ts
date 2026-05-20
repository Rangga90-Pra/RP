import type { AppSettings, Driver, VehicleRule } from "./types";

export const STORAGE_KEYS = {
  drivers: "premi_dashboard_drivers",
  vehicleRules: "premi_dashboard_vehicle_rules",
  trips: "premi_dashboard_trips",
  simpleTrips: "premi_simple_trips",
  simpleVehicleRules: "premi_simple_vehicle_rules",
  personil: "personil",
  kendaraan: "kendaraan",
  ritaseTransactions: "ritase_transactions",
  appSettings: "app_settings",
} as const;

/** Master rules kendaraan untuk input ritase sederhana. */
export const DEFAULT_VEHICLE_RULES: VehicleRule[] = [
  { id: "vr-dt-kecil", nama: "DT KECIL", upahPokokDefault: 40_000, upahPerKm: 2000, kmPerLiter: 3, solarPricePerLiter: 6800, solarPerKm: 6800 / 3 },
  { id: "vr-dt-besar", nama: "DT BESAR", upahPokokDefault: 40_000, upahPerKm: 2200, kmPerLiter: 2.5, solarPricePerLiter: 6800, solarPerKm: 6800 / 2.5 },
  { id: "vr-tronton", nama: "TRONTON", upahPokokDefault: 40_000, upahPerKm: 2200, kmPerLiter: 2, solarPricePerLiter: 6800, solarPerKm: 6800 / 2 },
  { id: "vr-taft-coldbox", nama: "TAFT/COLDBOX", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 10, solarPricePerLiter: 6800, solarPerKm: 6800 / 10 },
  { id: "vr-elf-bak", nama: "ELF BAK", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 5, solarPricePerLiter: 6800, solarPerKm: 6800 / 5 },
  { id: "vr-l300", nama: "L300", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 10, solarPricePerLiter: 6800, solarPerKm: 6800 / 10 },
  { id: "vr-hino-dutro", nama: "HINO DUTRO", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 6, solarPricePerLiter: 6800, solarPerKm: 6800 / 6 },
  { id: "vr-sl-hino", nama: "SL HINO", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 3, solarPricePerLiter: 6800, solarPerKm: 6800 / 3 },
  { id: "vr-sl-fuso", nama: "SL FUSO", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 3, solarPricePerLiter: 6800, solarPerKm: 6800 / 3 },
  { id: "vr-trailer-fuso", nama: "TRAILER FUSO", upahPokokDefault: 40_000, upahPerKm: 0, kmPerLiter: 2.5, solarPricePerLiter: 6800, solarPerKm: 6800 / 2.5 },
];

export const DEFAULT_DRIVERS: Driver[] = [];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  solarPricePerLiter: 6800,
  premiBasePay: 40000,
  tambahanUpahRitaseAspal: 20_000,
  tambahanUpahRitaseNonAspal: 0,
  persentaseUpahMuatanKembaliBermuatan: 30,
  vehicleRates: {
    "DT KECIL": { premiUpahPerKm: 2000, kmPerLiter: 3 },
    "DT BESAR": { premiUpahPerKm: 2200, kmPerLiter: 2.5 },
    TRONTON: { premiUpahPerKm: 2200, kmPerLiter: 2 },
    "TAFT/COLDBOX": { premiUpahPerKm: 0, kmPerLiter: 10 },
    "ELF BAK": { premiUpahPerKm: 0, kmPerLiter: 5 },
    L300: { premiUpahPerKm: 0, kmPerLiter: 10 },
    "HINO DUTRO": { premiUpahPerKm: 0, kmPerLiter: 6 },
    "SL HINO": { premiUpahPerKm: 0, kmPerLiter: 3 },
    "SL FUSO": { premiUpahPerKm: 0, kmPerLiter: 3 },
    "TRAILER FUSO": { premiUpahPerKm: 0, kmPerLiter: 2.5 },
  },
};
