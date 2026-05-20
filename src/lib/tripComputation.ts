import { findVehicleRuleByName, hitungRitase } from "./calculations";
import type { Trip, TripComputed, VehicleRule } from "./types";

/** Gabungkan data ritase dengan hasil hitungan; rule fallback ke DT KECIL jika nama tidak dikenal. */
export function computeTrip(
  trip: Trip,
  rules: VehicleRule[],
): TripComputed {
  const rule =
    findVehicleRuleByName(rules, trip.jenisTruk) ??
    findVehicleRuleByName(rules, "DT KECIL") ??
    rules[0];

  const calc = hitungRitase({
    jarakKm: trip.jarakKm,
    kategoriMuatan: trip.kategoriMuatan,
    jenisMuatan: trip.jenisMuatan,
    jenisMedan: trip.jenisMedan,
    jamPulang: trip.jamPulang,
    upahPokokDiberikan: trip.upahPokokDiberikan,
    rule,
  });

  return { ...trip, ...calc };
}
