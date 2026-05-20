// app/rekap/page.tsx  ← GANTIKAN file rekap yang sudah ada
// Halaman Rekap dengan sistem otorisasi 3 role

'use client'
import { Suspense } from 'react'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMyProfile, usePengajuan, useCeklist } from '@/lib/otorisasi/hooks'
import type { PengajuanOtorisasi, StatusPengajuan } from '@/lib/otorisasi/types'
import { isPrintTokenValid } from '@/lib/otorisasi/types'

const supabase = getSupabaseBrowserClient()

// ─────────────────────────────────────────────────────────────
// Tipe baris rekap sopir (sesuaikan dengan struktur data Anda)
// ─────────────────────────────────────────────────────────────
interface RekapRow {
  sopir_id: string
  nama_sopir: string
  status_sopir: string
  total_ritase: number
  total_km: number
  total_upah_ritase: number
  total_upah_pokok: number
  total_upah_sopir: number
  total_solar: number
  total_biaya: number
}

// ─────────────────────────────────────────────────────────────
// Komponen Badge Status
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusPengajuan | null }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    PENDING:   { label: 'Menunggu Otorisasi', bg: '#fef3c7', color: '#92400e' },
    DISETUJUI: { label: 'Disetujui',          bg: '#d1fae5', color: '#065f46' },
    DITOLAK:   { label: 'Ditolak',            bg: '#fee2e2', color: '#991b1b' },
  }
  if (!status) return null
  const c = cfg[status]
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '20px',
      background: c.bg, color: c.color,
      fontSize: '13px', fontWeight: 600,
    }}>
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
function RekapPageInner() {
  const { profile, loading: profileLoading } = useMyProfile()
  const searchParams = useSearchParams()
  const router = useRouter()

  // State filter tanggal (sama seperti sebelumnya)
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [jenisRekap, setJenisRekap] = useState('Rekap Sopir')

  // Data rekap
  const [rows, setRows] = useState<RekapRow[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Pengajuan otorisasi aktif (dari URL param atau fetch terbaru)
  const [pengajuanId, setPengajuanId] = useState<string | null>(
    searchParams.get('pengajuan')
  )
  const { pengajuan, canPrint, refetch: refetchPengajuan } = usePengajuan(pengajuanId ?? undefined)
  const { ceklist, toggleCeklist, semuaDiceklis } = useCeklist(pengajuanId ?? '')

  // Modal otorisasi (ID Master)
  const [showModalOtorisasi, setShowModalOtorisasi] = useState(false)
  const [catatanOtorisasi, setCatatanOtorisasi] = useState('')
  const [loadingOtorisasi, setLoadingOtorisasi] = useState(false)

  // Fetch rekap data (sesuaikan query dengan struktur tabel Anda)
  const fetchRekap = useCallback(async () => {
    setLoadingData(true)
    // ── GANTI QUERY INI SESUAI TABEL ANDA ──
    const { data } = await supabase.rpc('get_rekap_sopir', {
      p_tanggal_mulai: tanggalMulai || null,
      p_tanggal_akhir: tanggalAkhir || null,
    })
    setRows(data ?? [])
    setLoadingData(false)
  }, [tanggalMulai, tanggalAkhir])

  useEffect(() => { fetchRekap() }, [fetchRekap])

  // Fetch pengajuan terbaru untuk Admin Pusat (jika belum ada di URL)
  useEffect(() => {
    if (profile?.role === 'ADMIN_PUSAT' && !pengajuanId) {
      supabase
        .from('pengajuan_otorisasi')
        .select('id')
        .eq('diajukan_oleh', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => { if (data) setPengajuanId(data.id) })
    }
  }, [profile, pengajuanId])

  // ── FUNGSI: Buat & kirim pengajuan otorisasi ──
  const handleAjukanOtorisasi = async () => {
    if (!semuaDiceklis) {
      alert('Ceklis semua data terlebih dahulu sebelum mengajukan otorisasi.')
      return
    }
    setLoadingOtorisasi(true)
    const { data, error } = await supabase
      .from('pengajuan_otorisasi')
      .insert({
        diajukan_oleh: profile!.id,
        status: 'PENDING',
        tanggal_mulai: tanggalMulai || null,
        tanggal_akhir: tanggalAkhir || null,
        jenis_rekap: jenisRekap,
      })
      .select().single()

    if (error || !data) {
      alert('Gagal membuat pengajuan: ' + error?.message)
      setLoadingOtorisasi(false)
      return
    }

    // Tambah ceklist rows ke tabel
    if (rows.length > 0) {
      await supabase.from('pengajuan_ceklist').insert(
        rows.map(r => ({
          pengajuan_id: data.id,
          ref_type: 'sopir',
          ref_id: r.sopir_id,
          sudah_diceklis: true,
          diceklis_at: new Date().toISOString(),
        }))
      )
    }

    // Kirim notifikasi ke semua ID Master
    const { data: masters } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'ID_MASTER')
    if (masters) {
      await supabase.from('notifikasi').insert(
        masters.map((m: { id: string }) => ({
          untuk_user: m.id,
          judul: 'Pengajuan Otorisasi Baru',
          pesan: `${profile!.nama} mengajukan otorisasi rekap "${jenisRekap}". Silakan review dan otorisasi.`,
          link: `/master/otorisasi?id=${data.id}`,
          tipe: 'PENGAJUAN',
        }))
      )
    }

    setPengajuanId(data.id)
    router.push(`/rekap?pengajuan=${data.id}`)
    setLoadingOtorisasi(false)
    refetchPengajuan()
    alert('Pengajuan otorisasi berhasil dikirim ke ID Master!')
  }

  // ── FUNGSI: Otorisasi oleh ID Master ──
  const handleOtorisasi = async (disetujui: boolean) => {
    if (!pengajuanId) return
    setLoadingOtorisasi(true)
    const { error } = await supabase.rpc('proses_otorisasi', {
      p_pengajuan_id: pengajuanId,
      p_disetujui:    disetujui,
      p_catatan:      catatanOtorisasi || null,
    })
    if (error) alert('Error: ' + error.message)
    else {
      setShowModalOtorisasi(false)
      setCatatanOtorisasi('')
      refetchPengajuan()
    }
    setLoadingOtorisasi(false)
  }

  // ── FUNGSI: Print ──
  const handlePrint = () => {
    if (!canPrint) return
    window.print()
  }

  if (profileLoading) return <div style={{ padding: '24px' }}>Memuat...</div>
  if (!profile) return <div style={{ padding: '24px' }}>Silakan login terlebih dahulu.</div>

  const isAdminCabang = profile.role === 'ADMIN_CABANG'
  const isAdminPusat  = profile.role === 'ADMIN_PUSAT'
  const isIdMaster    = profile.role === 'ID_MASTER'

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Rekap</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Rekap nama, upah, solar, dan biaya total
        </p>
      </div>

      {/* Banner status otorisasi (Admin Pusat & ID Master) */}
      {pengajuan && (isAdminPusat || isIdMaster) && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: pengajuan.status === 'DISETUJUI' ? '#d1fae5'
                    : pengajuan.status === 'DITOLAK'   ? '#fee2e2'
                    : '#fef3c7',
          border: '1px solid',
          borderColor: pengajuan.status === 'DISETUJUI' ? '#a7f3d0'
                      : pengajuan.status === 'DITOLAK'   ? '#fecaca'
                      : '#fde68a',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>
              {pengajuan.status === 'DISETUJUI' ? '✅'
               : pengajuan.status === 'DITOLAK' ? '❌' : '⏳'}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                Status Pengajuan Otorisasi: <StatusBadge status={pengajuan.status} />
              </div>
              {pengajuan.catatan && (
                <div style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>
                  Catatan: {pengajuan.catatan}
                </div>
              )}
              {canPrint && pengajuan.print_token_exp && (
                <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px' }}>
                  Token print berlaku hingga: {new Date(pengajuan.print_token_exp).toLocaleString('id-ID')}
                </div>
              )}
            </div>
          </div>

          {/* Tombol otorisasi (ID Master) */}
          {isIdMaster && pengajuan.status === 'PENDING' && (
            <button
              onClick={() => setShowModalOtorisasi(true)}
              style={{
                padding: '8px 18px', borderRadius: '8px',
                background: '#1d4ed8', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px',
              }}
            >
              Proses Otorisasi
            </button>
          )}
        </div>
      )}

      {/* Filter Tanggal */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '12px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Tanggal mulai
            </label>
            <input
              type="date"
              value={tanggalMulai}
              onChange={e => setTanggalMulai(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Tanggal akhir
            </label>
            <input
              type="date"
              value={tanggalAkhir}
              onChange={e => setTanggalAkhir(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
            />
          </div>
          <button
            onClick={() => { setTanggalMulai(''); setTanggalAkhir('') }}
            style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}
          >
            Reset Tanggal
          </button>

          {/* Tombol Print: hanya muncul jika Admin Pusat & sudah diotorisasi */}
          {isAdminPusat && canPrint && (
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 18px', borderRadius: '8px',
                background: '#059669', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              🖨️ Print
            </button>
          )}

          {/* Info: Admin Cabang tidak bisa print */}
          {isAdminCabang && (
            <span style={{ fontSize: '13px', color: '#9ca3af', alignSelf: 'center' }}>
              🔒 Print hanya untuk Admin Pusat yang sudah diotorisasi
            </span>
          )}
        </div>
        {(!tanggalMulai && !tanggalAkhir) && (
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
            <strong>Ringkasan periode:</strong> Semua tanggal (filter tanggal tidak dipakai)
          </p>
        )}
      </div>

      {/* Jenis Rekap */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '12px', padding: '20px', marginBottom: '20px',
      }}>
        <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Jenis Rekap
        </label>
        <select
          value={jenisRekap}
          onChange={e => setJenisRekap(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', minWidth: '200px' }}
        >
          <option value="Rekap Sopir">Rekap Sopir</option>
          <option value="Rekap Kendaraan">Rekap Kendaraan</option>
          <option value="Rekap Personil">Rekap Personil</option>
        </select>
      </div>

      {/* Tabel Rekap */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '12px', overflow: 'hidden', marginBottom: '20px',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {/* Kolom ceklist hanya untuk Admin Pusat saat belum diajukan */}
              {isAdminPusat && !pengajuan && (
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, width: '48px' }}>✓</th>
              )}
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Nama Sopir</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Status Sopir</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Ritase</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total KM</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Upah Ritase</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Upah Pokok</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Upah Sopir</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Solar</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total Biaya</th>
            </tr>
          </thead>
          <tbody>
            {loadingData ? (
              <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Memuat data...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
            ) : (
              rows.map(row => {
                const isCeklis = ceklist.find(c => c.ref_id === row.sopir_id)?.sudah_diceklis ?? false
                return (
                  <tr key={row.sopir_id} style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: (isAdminPusat && !pengajuan && isCeklis) ? '#f0fdf4' : 'transparent',
                  }}>
                    {/* Checkbox ceklist Admin Pusat */}
                    {isAdminPusat && !pengajuan && (
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isCeklis}
                          onChange={() => toggleCeklist('sopir', row.sopir_id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#059669' }}
                        />
                      </td>
                    )}
                    <td style={{ padding: '12px 16px' }}>{row.nama_sopir}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
                        background: row.status_sopir === 'SOPIR PREMI' ? '#dbeafe' : '#f3f4f6',
                        color: row.status_sopir === 'SOPIR PREMI' ? '#1e40af' : '#374151',
                      }}>
                        {row.status_sopir}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{row.total_ritase}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{row.total_km}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {row.total_upah_ritase.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {row.total_upah_pokok.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {row.total_upah_sopir.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {row.total_solar.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Rp {row.total_biaya.toLocaleString('id-ID')}</td>
                  </tr>
                )
              })
            )}
            {/* Baris Jumlah */}
            {rows.length > 0 && (
              <tr style={{ background: '#f9fafb', fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                {isAdminPusat && !pengajuan && <td />}
                <td style={{ padding: '12px 16px' }}>Jumlah</td>
                <td />
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{rows.reduce((s, r) => s + r.total_ritase, 0)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{rows.reduce((s, r) => s + r.total_km, 0)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {rows.reduce((s, r) => s + r.total_upah_ritase, 0).toLocaleString('id-ID')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {rows.reduce((s, r) => s + r.total_upah_pokok, 0).toLocaleString('id-ID')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {rows.reduce((s, r) => s + r.total_upah_sopir, 0).toLocaleString('id-ID')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {rows.reduce((s, r) => s + r.total_solar, 0).toLocaleString('id-ID')}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>Rp {rows.reduce((s, r) => s + r.total_biaya, 0).toLocaleString('id-ID')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── TOMBOL PENGAJUAN OTORISASI (Admin Pusat saja) ── */}
      {isAdminPusat && !pengajuan && rows.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '12px', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#92400e' }}>
              Langkah verifikasi sebelum pengajuan
            </div>
            <div style={{ fontSize: '13px', color: '#b45309', marginTop: '2px' }}>
              Ceklis semua baris data ({ceklist.filter(c => c.sudah_diceklis).length}/{rows.length} diceklis)
              {semuaDiceklis && ' ✅ Semua data sudah diverifikasi'}
            </div>
          </div>
          <button
            onClick={handleAjukanOtorisasi}
            disabled={!semuaDiceklis || loadingOtorisasi}
            style={{
              padding: '10px 20px', borderRadius: '8px',
              background: semuaDiceklis ? '#1d4ed8' : '#9ca3af',
              color: '#fff', border: 'none',
              cursor: semuaDiceklis ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: '14px',
              opacity: loadingOtorisasi ? 0.7 : 1,
            }}
          >
            {loadingOtorisasi ? 'Mengirim...' : '📤 Pengajuan Otorisasi'}
          </button>
        </div>
      )}

      {/* ── MODAL OTORISASI (ID Master) ── */}
      {showModalOtorisasi && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '420px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Proses Otorisasi
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              Tinjau pengajuan rekap dari Admin Pusat. Anda dapat menyetujui atau menolak pengajuan ini.
            </p>
            <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Catatan (opsional)
            </label>
            <textarea
              value={catatanOtorisasi}
              onChange={e => setCatatanOtorisasi(e.target.value)}
              placeholder="Tambahkan catatan jika diperlukan..."
              rows={3}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid #e5e7eb', borderRadius: '8px',
                fontSize: '14px', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModalOtorisasi(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleOtorisasi(false)}
                disabled={loadingOtorisasi}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                ❌ Tolak
              </button>
              <button
                onClick={() => handleOtorisasi(true)}
                disabled={loadingOtorisasi}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                ✅ Setujui
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RekapPage() {
  return (
    <Suspense fallback={<div style={{padding:'24px'}}>Memuat...</div>}>
      <RekapPageInner />
    </Suspense>
  )
}

