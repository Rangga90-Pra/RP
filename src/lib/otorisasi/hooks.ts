import { useEffect, useState, useCallback } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Notifikasi, PengajuanOtorisasi, Profile, PengajuanCeklist } from "./types"
import { isPrintTokenValid } from "./types"

const supabase = getSupabaseBrowserClient()

export function useMyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      setProfile(data)
      setLoading(false)
    })
  }, [])
  return { profile, loading }
}

export function useNotifikasi() {
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([])
  const [unread, setUnread] = useState(0)
  const fetchNotif = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("notifikasi").select("*").eq("untuk_user", user.id).order("created_at", { ascending: false }).limit(20)
    setNotifikasi(data ?? [])
    setUnread((data ?? []).filter((n: Notifikasi) => !n.sudah_dibaca).length)
  }, [])
  useEffect(() => {
    fetchNotif()
    const channel = supabase.channel("notifikasi-realtime").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifikasi" }, () => { fetchNotif() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchNotif])
  const tandaiDibaca = useCallback(async (id: string) => {
    await supabase.from("notifikasi").update({ sudah_dibaca: true, dibaca_at: new Date().toISOString() }).eq("id", id)
    fetchNotif()
  }, [fetchNotif])
  const tandaiSemuaDibaca = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("notifikasi").update({ sudah_dibaca: true, dibaca_at: new Date().toISOString() }).eq("untuk_user", user.id).eq("sudah_dibaca", false)
    fetchNotif()
  }, [fetchNotif])
  return { notifikasi, unread, tandaiDibaca, tandaiSemuaDibaca }
}

export function usePengajuan(pengajuanId?: string) {
  const [pengajuan, setPengajuan] = useState<PengajuanOtorisasi | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchPengajuan = useCallback(async (id: string) => {
    setLoading(true)
    const { data } = await supabase.from("pengajuan_otorisasi").select("*, profiles(*)").eq("id", id).single()
    setPengajuan(data)
    setLoading(false)
  }, [])
  useEffect(() => { if (pengajuanId) fetchPengajuan(pengajuanId) }, [pengajuanId, fetchPengajuan])
  const canPrint = pengajuan ? isPrintTokenValid(pengajuan) : false
  return { pengajuan, loading, canPrint, refetch: () => pengajuanId && fetchPengajuan(pengajuanId) }
}

export function useDaftarPengajuan(filter: "PENDING" | "SEMUA" = "SEMUA") {
  const [list, setList] = useState<PengajuanOtorisasi[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from("pengajuan_otorisasi").select("*, profiles(*)").order("created_at", { ascending: false })
    if (filter === "PENDING") query = query.eq("status", "PENDING")
    const { data } = await query
    setList(data ?? [])
    setLoading(false)
  }, [filter])
  useEffect(() => { fetch() }, [fetch])
  return { list, loading, refetch: fetch }
}

export function useCeklist(pengajuanId: string) {
  const [ceklist, setCeklist] = useState<PengajuanCeklist[]>([])
  useEffect(() => {
    if (!pengajuanId) return
    supabase.from("pengajuan_ceklist").select("*").eq("pengajuan_id", pengajuanId).then(({ data }) => setCeklist(data ?? []))
  }, [pengajuanId])
  const toggleCeklist = useCallback(async (refType: string, refId: string) => {
    const existing = ceklist.find(c => c.ref_type === refType && c.ref_id === refId)
    if (!existing) {
      const { data } = await supabase.from("pengajuan_ceklist").insert({ pengajuan_id: pengajuanId, ref_type: refType, ref_id: refId, sudah_diceklis: true, diceklis_at: new Date().toISOString() }).select().single()
      if (data) setCeklist(prev => [...prev, data])
    } else {
      const newVal = !existing.sudah_diceklis
      await supabase.from("pengajuan_ceklist").update({ sudah_diceklis: newVal, diceklis_at: newVal ? new Date().toISOString() : null }).eq("id", existing.id)
      setCeklist(prev => prev.map(c => c.id === existing.id ? { ...c, sudah_diceklis: newVal } : c))
    }
  }, [pengajuanId, ceklist])
  const semuaDiceklis = ceklist.length > 0 && ceklist.every(c => c.sudah_diceklis)
  return { ceklist, toggleCeklist, semuaDiceklis }
}
