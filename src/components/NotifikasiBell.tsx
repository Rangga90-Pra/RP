// components/NotifikasiBell.tsx
// Komponen bell notifikasi - simpan di folder components/

'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifikasi } from '@/lib/otorisasi/hooks'
import type { TipeNotifikasi } from '@/lib/otorisasi/types'

const TIPE_ICON: Record<TipeNotifikasi, string> = {
  INFO:       '💬',
  PENGAJUAN:  '📋',
  DISETUJUI:  '✅',
  DITOLAK:    '❌',
}

const TIPE_COLOR: Record<TipeNotifikasi, string> = {
  INFO:       '#6366f1',
  PENGAJUAN:  '#f59e0b',
  DISETUJUI:  '#10b981',
  DITOLAK:    '#ef4444',
}

export default function NotifikasiBell() {
  const { notifikasi, unread, tandaiDibaca, tandaiSemuaDibaca } = useNotifikasi()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKlik = async (notif: typeof notifikasi[0]) => {
    await tandaiDibaca(notif.id)
    setOpen(false)
    if (notif.link) router.push(notif.link)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Tombol Bell */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: 'none',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label={`Notifikasi (${unread} belum dibaca)`}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '340px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
              Notifikasi {unread > 0 && <span style={{ color: '#ef4444' }}>({unread})</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={tandaiSemuaDibaca}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#6366f1', fontWeight: 500,
                }}
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifikasi.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                Tidak ada notifikasi
              </div>
            ) : (
              notifikasi.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleKlik(n)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: n.sudah_dibaca ? 'transparent' : '#f0f9ff',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.sudah_dibaca ? 'transparent' : '#f0f9ff')}
                >
                  {/* Icon */}
                  <span style={{
                    fontSize: '20px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: TIPE_COLOR[n.tipe] + '18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {TIPE_ICON[n.tipe]}
                  </span>
                  {/* Teks */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: n.sudah_dibaca ? 400 : 600,
                      fontSize: '13px',
                      color: '#111827',
                      marginBottom: '2px',
                    }}>
                      {n.judul}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>
                      {n.pesan}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {/* Titik belum dibaca */}
                  {!n.sudah_dibaca && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#6366f1', flexShrink: 0, marginTop: '6px',
                    }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
