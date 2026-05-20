// lib/otorisasi/types.ts
// Tipe data untuk sistem otorisasi

export type UserRole = 'ADMIN_CABANG' | 'ADMIN_PUSAT' | 'ID_MASTER'

export type StatusPengajuan = 'PENDING' | 'DISETUJUI' | 'DITOLAK'

export type TipeNotifikasi = 'INFO' | 'PENGAJUAN' | 'DISETUJUI' | 'DITOLAK'

export interface Profile {
  id: string
  email: string
  nama: string
  role: UserRole
  cabang_id: string | null
}

export interface PengajuanOtorisasi {
  id: string
  created_at: string
  updated_at: string
  diajukan_oleh: string
  status: StatusPengajuan
  tanggal_mulai: string | null
  tanggal_akhir: string | null
  jenis_rekap: string
  diproses_oleh: string | null
  diproses_at: string | null
  catatan: string | null
  print_token: string | null
  print_token_exp: string | null
  // relasi (dari join)
  profiles?: Profile
}

export interface PengajuanCeklist {
  id: string
  pengajuan_id: string
  ref_type: 'sopir' | 'kendaraan' | 'personil'
  ref_id: string
  sudah_diceklis: boolean
  diceklis_at: string | null
}

export interface Notifikasi {
  id: string
  created_at: string
  untuk_user: string
  judul: string
  pesan: string
  link: string | null
  sudah_dibaca: boolean
  dibaca_at: string | null
  tipe: TipeNotifikasi
}

// Cek apakah print token masih berlaku
export function isPrintTokenValid(pengajuan: PengajuanOtorisasi): boolean {
  if (!pengajuan.print_token || !pengajuan.print_token_exp) return false
  if (pengajuan.status !== 'DISETUJUI') return false
  return new Date(pengajuan.print_token_exp) > new Date()
}
