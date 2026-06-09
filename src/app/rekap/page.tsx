'use client'
import { Suspense } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useMyProfile } from '@/lib/otorisasi/hooks'

const supabase = getSupabaseBrowserClient()

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

function RekapPageInner() {
  const { profile, loading: profileLoading } = useMyProfile()

  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [jenisRekap, setJenisRekap] = useState('Rekap Sopir')
  const [rows, setRows] = useState<RekapRow[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const fetchRekap = useCallback(async () => {
    setLoadingData(true)
    const { data } = await supabase.rpc('get_rekap_sopir', {
      p_tanggal_mulai: tanggalMulai || null,
      p_tanggal_akhir: tanggalAkhir || null,
    })
    setRows(data ?? [])
    setLoadingData(false)
  }, [tanggalMulai, tanggalAkhir])

  useEffect(() => { fetchRekap() }, [fetchRekap])

  if (profileLoading) return <div style={{ padding: '24px' }}>Memuat...</div>
  if (!profile) return <div style={{ padding: '24px' }}>Silakan login terlebih dahulu.</div>

  const isAdminCabang = profile.role === 'ADMIN_CABANG'
  const canPrint = profile.role === 'ADMIN_PUSAT' || profile.role === 'ID_MASTER'

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Rekap</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Rekap nama, upah, solar, dan biaya total
        </p>
      </div>

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

          {canPrint && (
            <button
              onClick={() => window.print()}
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

          {isAdminCabang && (
            <span style={{ fontSize: '13px', color: '#9ca3af', alignSelf: 'center' }}>
              Tidak ada akses print
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
              <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Memuat data...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
            ) : (
              rows.map(row => (
                <tr key={row.sopir_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
              ))
            )}
            {rows.length > 0 && (
              <tr style={{ background: '#f9fafb', fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
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
