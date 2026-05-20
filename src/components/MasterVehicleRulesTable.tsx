"use client";

import { DEFAULT_VEHICLE_RULES } from "@/lib/defaults";
import type { VehicleRule } from "@/lib/types";

interface Props {
  rules: VehicleRule[];
  onChange: (list: VehicleRule[]) => void;
}

export function MasterVehicleRulesTable({ rules, onChange }: Props) {
  const updateRow = (id: string, patch: Partial<VehicleRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const id = crypto.randomUUID?.() ?? `vr-${Date.now()}`;
    onChange([
      ...rules,
      {
        id,
        nama: "DT KECIL",
        upahPokokDefault: 40_000,
        upahPerKm: 2000,
        kmPerLiter: 3,
        solarPricePerLiter: 6800,
        solarPerKm: 2267,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rules.length <= 1) return;
    if (!confirm("Hapus jenis kendaraan ini? Ritase yang memakai nama ini tetap ada."))
      return;
    onChange(rules.filter((r) => r.id !== id));
  };

  const resetDefaults = () => {
    if (
      !confirm(
        "Reset ke data default aplikasi? Perubahan di master akan diganti oleh nilai awal.",
      )
    )
      return;
    onChange([...DEFAULT_VEHICLE_RULES]);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Master rules kendaraan &amp; solar / km
          </h2>
          <p className="text-xs text-slate-500">
            Upah pokok default (referensi), upah per km, dan solar per km per jenis
            truk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Reset default
          </button>
          <button
            type="button"
            onClick={addRow}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark"
          >
            + Jenis baru
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama jenis truk</th>
              <th className="px-3 py-2 text-right">Upah pokok (ref)</th>
              <th className="px-3 py-2 text-right">Upah / km</th>
              <th className="px-3 py-2 text-right">Solar / km</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => (
              <tr key={r.id} className="even:bg-slate-50/40">
                <td className="px-3 py-2">
                  <select
                    value={r.nama}
                    onChange={(e) =>
                      updateRow(r.id, {
                        nama: e.target.value as VehicleRule["nama"],
                      })
                    }
                    className="w-full min-w-[140px] rounded border border-slate-300 px-1 py-1"
                  >
                    {DEFAULT_VEHICLE_RULES.map((d) => (
                      <option key={d.id} value={d.nama}>
                        {d.nama}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={r.upahPokokDefault}
                    onChange={(e) =>
                      updateRow(r.id, {
                        upahPokokDefault: Math.max(
                          0,
                          parseInt(e.target.value, 10) || 0,
                        ),
                      })
                    }
                    className="w-full max-w-[120px] rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={r.upahPerKm}
                    onChange={(e) =>
                      updateRow(r.id, {
                        upahPerKm: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full max-w-[100px] rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={r.solarPerKm}
                    onChange={(e) =>
                      updateRow(r.id, {
                        solarPerKm: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full max-w-[100px] rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-rose-600 hover:underline disabled:opacity-40"
                    disabled={rules.length <= 1}
                    onClick={() => removeRow(r.id)}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        Catatan: upah pokok pada ritase mengikuti centang di form ritase (
        Rp 40.000 jika dicentang), bukan nilai kolom ini. Kolom upah pokok di
        sini adalah referensi master seperti yang Anda minta.
      </p>
    </section>
  );
}
