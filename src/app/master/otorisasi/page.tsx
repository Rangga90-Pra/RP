// app/master/otorisasi/page.tsx
// Halaman khusus ID Master untuk melihat semua pengajuan
// Buat folder: app/master/otorisasi/

'use client'
import { Suspense } from 'react'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDaftarPengajuan, useMyProfile } from '@/lib/otorisasi/hooks'
import type { PengajuanOtorisasi, StatusPengajuan } from '@/lib/otorisasi/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = getSupabaseBrowserClient()

function StatusChip({ status }: { status: StatusPengajuan }) {
  const cfg = {
    PENDING:   { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
    DISETUJUI: { bg: '#d1fae5', color: '#065f46', icon: '✅' },
    DITOLAK:   { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
  }[status]
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontSize: '12px', fontWeight: 600 }}>
      {cfg.icon} {status}
    </span>
  )
}

function MasterOtorisasiPageInner() {
  const { profile, loading } = useMyProfile()
  const { list, loading: listLoading, refetch } = useDaftarPengajuan('SEMUA')
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')

  const [catatan, setCatatan] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | StatusPengajuan>('SEMUA')

  if (loading) return <div style={{ padding: '24px' }}>Memuat...</div>
  if (!profile || profile.role !== 'ID_MASTER') {
    return <div style={{ padding: '24px', color: '#ef4444' }}>⛔ Akses ditolak. Halaman ini hanya untuk ID Master.</div>
  }

  const filtered = filterStatus === 'SEMUA' ? list : list.filter(p => p.status === filterStatus)
  const selected = list.find(p => p.id === selectedId)

  const handleProses = async (disetujui: boolean) => {
    if (!selectedId) return
    setLoadingAction(true)
    const { error } = await supabase.rpc('proses_otorisasi', {
      p_pengajuan_id: selectedId,
      p_disetujui:    disetujui,
      p_catatan:      catatan || null,
    })
    if (error) alert('Error: ' + error.message)
    else { setCatatan(''); refetch() }
    setLoadingAction(false)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Panel Otorisasi</h1>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
        Kelola semua pengajuan otorisasi dari Admin Pusat
      </p>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['SEMUA', 'PENDING', 'DISETUJUI', 'DITOLAK'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: '1px solid',
              borderColor: filterStatus === s ? '#1d4ed8' : '#e5e7eb',
              background: filterStatus === s ? '#dbeafe' : '#fff',
              color: filterStatus === s ? '#1e40af' : '#374151',
              cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            }}
          >
            {s} {s !== 'SEMUA' && `(${list.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
        {/* Daftar Pengajuan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {listLoading ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '24px' }}>Memuat...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '24px' }}>Tidak ada pengajuan</div>
          ) : (
            filtered.map((p: PengajuanOtorisasi) => (
              <a
                key={p.id}
                href={`/master/otorisasi?id=${p.id}`}
                style={{
                  display: 'block',
                  padding: '16px',
                  background: selectedId === p.id ? '#eff6ff' : '#fff',
                  border: '1px solid',
                  borderColor: selectedId === p.id ? '#93c5fd' : '#e5e7eb',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      {p.profiles?.nama ?? 'Admin Pusat'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {p.jenis_rekap}
                      {p.tanggal_mulai && ` • ${p.tanggal_mulai} s/d ${p.tanggal_akhir}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                      {new Date(p.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <StatusChip status={p.status} />
                </div>
              </a>
            ))
          )}
        </div>

        {/* Detail & Aksi */}
        {selected ? (
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: '12px', padding: '20px',
            alignSelf: 'flex-start', position: 'sticky', top: '24px',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Detail Pengajuan</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                {[
                  ['Pengaju', selected.profiles?.nama ?? '-'],
                  ['Email', selected.profiles?.email ?? '-'],
                  ['Jenis Rekap', selected.jenis_rekap],
                  ['Periode', selected.tanggal_mulai
                    ? `${selected.tanggal_mulai} s/d ${selected.tanggal_akhir}`
                    : 'Semua tanggal'],
                  ['Diajukan', new Date(selected.created_at).toLocaleString('id-ID')],
                  ['Status', <StatusChip key="s" status={selected.status} />],
                ].map(([k, v]) => (
                  <tr key={String(k)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 0', color: '#6b7280', width: '100px' }}>{k}</td>
                    <td style={{ padding: '8px 0', fontWeight: 500 }}>{v}</td>
                  </tr>
                ))}
                {selected.catatan && (
                  <tr>
                    <td style={{ padding: '8px 0', color: '#6b7280' }}>Catatan</td>
                    <td style={{ padding: '8px 0' }}>{selected.catatan}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Aksi hanya jika PENDING */}
            {selected.status === 'PENDING' && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
                  Catatan (opsional)
                </label>
                <textarea
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  rows={3}
                  placeholder="Tambahkan catatan jika diperlukan..."
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: '1px solid #e5e7eb', borderRadius: '8px',
                    fontSize: '13px', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={() => handleProses(false)}
                    disabled={loadingAction}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      background: '#ef4444', color: '#fff', border: 'none',
                      cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    }}
                  >
                    ❌ Tolak
                  </button>
                  <button
                    onClick={() => handleProses(true)}
                    disabled={loadingAction}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px',
                      background: '#059669', color: '#fff', border: 'none',
                      cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    }}
                  >
                    ✅ Setujui
                  </button>
                </div>
              </div>
            )}

            {selected.status !== 'PENDING' && (
              <div style={{
                marginTop: '16px', padding: '12px', borderRadius: '8px',
                background: selected.status === 'DISETUJUI' ? '#d1fae5' : '#fee2e2',
                fontSize: '13px', color: selected.status === 'DISETUJUI' ? '#065f46' : '#991b1b',
              }}>
                Pengajuan ini sudah diproses pada{' '}
                {selected.diproses_at ? new Date(selected.diproses_at).toLocaleString('id-ID') : '-'}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#f9fafb', border: '1px dashed #e5e7eb',
            borderRadius: '12px', padding: '32px', textAlign: 'center',
            color: '#9ca3af', fontSize: '14px',
          }}>
            Pilih pengajuan di sebelah kiri untuk melihat detail
          </div>
        )}
      </div>
    </div>
  )
}

export default function MasterOtorisasiPage() {
  return (
    <Suspense fallback={<div style={{padding:'24px'}}>Memuat...</div>}>
      <MasterOtorisasiPageInner />
    </Suspense>
  )
}

