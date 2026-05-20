import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import * as cloudApi from "@/lib/supabase/api";
import {
  getAppSettings,
  loadKendaraan,
  loadPersonil,
  loadRitaseTransactions,
} from "@/lib/storage";
import type { Kendaraan, Personil, SimpleTrip } from "@/lib/types";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureUuid(id: string): string {
  return UUID_V4_RE.test(id) ? id : newId();
}

/** Pindahkan data lokal (localStorage) ke Supabase untuk satu cabang. */
export async function migrateLocalStorageToSupabase(targetBranchId: string): Promise<{ ok: boolean; message: string }> {
  const client = getSupabaseBrowserClient();
  const errors: string[] = [];

  const personil = loadPersonil().map((p: Personil) => ({
    ...p,
    id: ensureUuid(p.id),
    branchId: targetBranchId,
  }));
  const kendaraan = loadKendaraan().map((k: Kendaraan) => ({
    ...k,
    id: ensureUuid(k.id),
    branchId: targetBranchId,
  }));
  const trips = loadRitaseTransactions().map((t: SimpleTrip) => ({
    ...t,
    id: ensureUuid(t.id),
    branchId: targetBranchId,
  }));

  try {
    for (const p of personil) {
      await cloudApi.upsertPersonil(client, p);
    }
  } catch (e) {
    errors.push(`Personil: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    for (const k of kendaraan) {
      await cloudApi.upsertKendaraan(client, k);
    }
  } catch (e) {
    errors.push(`Kendaraan: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    for (const t of trips) {
      await cloudApi.upsertTransaction(client, t, targetBranchId);
    }
  } catch (e) {
    errors.push(`Transaksi: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const settings = getAppSettings();
    await cloudApi.saveAppSettings(client, settings);
  } catch (e) {
    errors.push(`Settings: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length) {
    return { ok: false, message: errors.join(" | ") };
  }
  return { ok: true, message: `Migrasi selesai: ${personil.length} personil, ${kendaraan.length} kendaraan, ${trips.length} transaksi.` };
}
