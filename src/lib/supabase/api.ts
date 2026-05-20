import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings, Branch, Kendaraan, Personil, SimpleTrip, UserProfile } from "@/lib/types";
import {
  mapBranchRow,
  mapKendaraanRow,
  mapPersonilRow,
  mapProfileRow,
  mapTransactionRow,
  mergeAppSettingsJson,
  tripToPayload,
} from "@/lib/supabase/mappers";

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapProfileRow(data as Parameters<typeof mapProfileRow>[0]);
}

export async function fetchBranches(client: SupabaseClient): Promise<Branch[]> {
  const { data, error } = await client.from("branches").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapBranchRow(r as Parameters<typeof mapBranchRow>[0]));
}

export async function insertBranch(client: SupabaseClient, name: string, code: string): Promise<Branch> {
  const { data, error } = await client.from("branches").insert({ name, code: code || null }).select().single();
  if (error) throw error;
  return mapBranchRow(data as Parameters<typeof mapBranchRow>[0]);
}

export async function updateBranch(
  client: SupabaseClient,
  id: string,
  patch: { name?: string; code?: string | null },
): Promise<void> {
  const { error } = await client.from("branches").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBranch(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("branches").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPersonil(
  client: SupabaseClient,
  profile: UserProfile,
  filterBranchId: string | null,
): Promise<Personil[]> {
  let q = client.from("personil").select("*").order("nama_sopir");
  if (profile.role === "ADMIN_PUSAT") {
    if (filterBranchId) q = q.eq("branch_id", filterBranchId);
  } else if (profile.role === "ID_MASTER") {
    // ID Master bisa lihat semua data
  } else {
    if (!profile.branchId) throw new Error("Profil cabang belum memiliki branch_id.");
    q = q.eq("branch_id", profile.branchId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapPersonilRow(r as Parameters<typeof mapPersonilRow>[0]));
}

export async function upsertPersonil(client: SupabaseClient, row: Personil): Promise<void> {
  const payload = {
    id: row.id,
    branch_id: row.branchId!,
    nama_sopir: row.namaSopir,
    status_sopir: row.statusSopir,
    status_aktif: row.statusAktif,
  };
  const { error } = await client.from("personil").upsert(payload);
  if (error) throw error;
}

export async function deletePersonil(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("personil").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchKendaraan(
  client: SupabaseClient,
  profile: UserProfile,
  filterBranchId: string | null,
): Promise<Kendaraan[]> {
  let q = client.from("kendaraan").select("*").order("plat_nomor");
  if (profile.role === "ADMIN_PUSAT") {
    if (filterBranchId) q = q.eq("branch_id", filterBranchId);
  } else if (profile.role === 'ID_MASTER') {
    // ID Master bisa lihat semua data
  } else {
    if (!profile.branchId) throw new Error("Profil cabang belum memiliki branch_id.");
    q = q.eq("branch_id", profile.branchId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapKendaraanRow(r as Parameters<typeof mapKendaraanRow>[0]));
}

export async function upsertKendaraan(client: SupabaseClient, row: Kendaraan): Promise<void> {
  const payload = {
    id: row.id,
    branch_id: row.branchId!,
    jenis_kendaraan: row.jenisKendaraan,
    plat_nomor: row.platNomor,
    status_aktif: row.statusAktif,
  };
  const { error } = await client.from("kendaraan").upsert(payload);
  if (error) throw error;
}

export async function deleteKendaraan(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("kendaraan").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchTransactions(
  client: SupabaseClient,
  profile: UserProfile,
  filterBranchId: string | null,
): Promise<SimpleTrip[]> {
  let q = client.from("transactions").select("id, branch_id, tanggal, payload").order("tanggal", { ascending: false });
  if (profile.role === "ADMIN_PUSAT") {
    if (filterBranchId) q = q.eq("branch_id", filterBranchId);
  } else if (profile.role === 'ID_MASTER') {
    // ID Master bisa lihat semua data
  } else {
    if (!profile.branchId) throw new Error("Profil cabang belum memiliki branch_id.");
    q = q.eq("branch_id", profile.branchId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) =>
    mapTransactionRow(r as { id: string; branch_id: string; tanggal: string; payload: Record<string, unknown> }),
  );
}

export async function insertTransaction(client: SupabaseClient, trip: SimpleTrip, branchId: string): Promise<void> {
  const payload = tripToPayload({ ...trip, branchId });
  const { error } = await client.from("transactions").insert({
    id: trip.id,
    branch_id: branchId,
    tanggal: trip.tanggal.slice(0, 10),
    payload,
  });
  if (error) throw error;
}

/** Upsert by primary key (untuk migrasi / sinkron ulang tanpa error duplikat). */
export async function upsertTransaction(client: SupabaseClient, trip: SimpleTrip, branchId: string): Promise<void> {
  const payload = tripToPayload({ ...trip, branchId });
  const { error } = await client.from("transactions").upsert(
    {
      id: trip.id,
      branch_id: branchId,
      tanggal: trip.tanggal.slice(0, 10),
      payload,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function deleteTransaction(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAppSettings(client: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await client.from("app_settings").select("settings").eq("id", "global").maybeSingle();
  if (error) throw error;
  return mergeAppSettingsJson(data?.settings ?? {});
}

export async function saveAppSettings(client: SupabaseClient, settings: AppSettings): Promise<void> {
  const { error } = await client
    .from("app_settings")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("id", "global");
  if (error) throw error;
}

export async function updateUserProfileBranch(
  client: SupabaseClient,
  userId: string,
  branchId: string | null,
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ branch_id: branchId, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

