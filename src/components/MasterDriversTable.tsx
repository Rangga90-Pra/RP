"use client";

import { useMemo, useState } from "react";
import type { Driver } from "@/lib/types";

interface Props {
  drivers: Driver[];
  vehicleTypeOptions: string[];
  onChange: (list: Driver[]) => void;
}

function newDriver(vehicleTypes: string[]): Driver {
  return {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    nama: "",
    platNomor: "",
    jenisKendaraan: vehicleTypes[0] ?? "DT KECIL",
    aktif: true,
  };
}

export function MasterDriversTable({
  drivers,
  vehicleTypeOptions,
  onChange,
}: Props) {
  const [draft, setDraft] = useState<Driver | null>(null);

  const sorted = useMemo(
    () => [...drivers].sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    [drivers],
  );

  const updateRow = (id: string, patch: Partial<Driver>) => {
    onChange(drivers.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeRow = (id: string) => {
    if (!confirm("Hapus sopir ini dari master data?")) return;
    onChange(drivers.filter((d) => d.id !== id));
  };

  const saveDraft = () => {
    if (!draft?.nama.trim()) {
      alert("Nama sopir wajib diisi.");
      return;
    }
    onChange([...drivers, draft]);
    setDraft(null);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Master data sopir
          </h2>
          <p className="text-xs text-slate-500">
            Nama, plat, jenis kendaraan default, dan status aktif.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(newDriver(vehicleTypeOptions))}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark"
        >
          + Tambah sopir
        </button>
      </div>

      {draft && (
        <div className="border-b border-teal-200 bg-teal-50/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-teal-900">
            Sopir baru
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-slate-700">
              Nama
              <input
                value={draft.nama}
                onChange={(e) =>
                  setDraft({ ...draft, nama: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Plat nomor
              <input
                value={draft.platNomor}
                onChange={(e) =>
                  setDraft({ ...draft, platNomor: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Jenis kendaraan
              <select
                value={draft.jenisKendaraan}
                onChange={(e) =>
                  setDraft({ ...draft, jenisKendaraan: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                {vehicleTypeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={draft.aktif}
                onChange={(e) =>
                  setDraft({ ...draft, aktif: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand"
              />
              Aktif
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Simpan
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-[840px] w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Plat</th>
              <th className="px-3 py-2">Jenis kendaraan</th>
              <th className="px-3 py-2">Aktif</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((d) => (
              <tr key={d.id} className="even:bg-slate-50/40">
                <td className="px-3 py-2">
                  <input
                    value={d.nama}
                    onChange={(e) =>
                      updateRow(d.id, { nama: e.target.value })
                    }
                    className="w-full min-w-[120px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-brand"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={d.platNomor}
                    onChange={(e) =>
                      updateRow(d.id, { platNomor: e.target.value })
                    }
                    className="w-full max-w-[120px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-200 focus:border-brand"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={d.jenisKendaraan}
                    onChange={(e) =>
                      updateRow(d.id, { jenisKendaraan: e.target.value })
                    }
                    className="w-full min-w-[140px] rounded-md border border-slate-300 px-1 py-1 text-sm"
                  >
                    {vehicleTypeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={d.aktif}
                    onChange={(e) =>
                      updateRow(d.id, { aktif: e.target.checked })
                    }
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-rose-600 hover:underline"
                    onClick={() => removeRow(d.id)}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  className="px-3 py-6 text-center text-slate-500"
                  colSpan={5}
                >
                  Belum ada sopir. Klik tambah sopir untuk menambahkan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
