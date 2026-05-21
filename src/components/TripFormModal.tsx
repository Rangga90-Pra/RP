"use client";

import { useEffect, useMemo, useState } from "react";
import type { Driver, Trip, VehicleRule } from "@/lib/types";
import { findVehicleRuleByName, hitungRitase } from "@/lib/calculations";
import { formatRupiah } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  initial: Trip | null;
  drivers: Driver[];
  vehicleRules: VehicleRule[];
  onSave: (trip: Trip) => void;
}

const emptyForm: Omit<Trip, "id"> = {
  tanggal: "",
  namaSopir: "",
  platNomor: "",
  namaPaket: "",
  lokasiAmbil: "",
  lokasiBongkar: "",
  jarakKm: 0,
  jamBerangkat: "07:00",
  jamPulang: "17:00",
  kategoriMuatan: "UTAMA",
  jenisMuatan: "NON ASPAL",
  jenisTruk: "DT KECIL",
  jenisMedan: "MUDAH",
  upahPokokDiberikan: true,
};

export function TripFormModal({
  open,
  onClose,
  initial,
  drivers,
  vehicleRules,
  onSave,
}: Props) {
  const [form, setForm] = useState<Omit<Trip, "id">>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const { id: _id, ...rest } = initial;
      setForm(rest);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        ...emptyForm,
        tanggal: today,
        jenisTruk: vehicleRules[0]?.nama ?? "DT KECIL",
      });
    }
  }, [open, initial, vehicleRules]);

  const rule = useMemo(() => {
    return (
      findVehicleRuleByName(vehicleRules, form.jenisTruk) ??
      findVehicleRuleByName(vehicleRules, "DT KECIL") ??
      vehicleRules[0]
    );
  }, [form.jenisTruk, vehicleRules]);

  const preview = useMemo(() => {
    if (!rule) return null;
    return hitungRitase({
      jarakKm: Number(form.jarakKm) || 0,
      kategoriMuatan: form.kategoriMuatan,
      jenisMuatan: form.jenisMuatan,
      jenisMedan: form.jenisMedan,
      jamPulang: form.jamPulang,
      upahPokokDiberikan: form.upahPokokDiberikan,
      rule,
    });
  }, [form, rule]);

  if (!open) return null;

  const set = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  const applyDriver = (id: string) => {
    const d = drivers.find((x) => x.id === id);
    if (!d) return;
    setForm((f) => ({
      ...f,
      namaSopir: d.nama,
      platNomor: d.platNomor,
      jenisTruk: d.jenisKendaraan || f.jenisTruk,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tanggal || !form.namaSopir.trim()) {
      alert("Tanggal dan nama sopir wajib diisi.");
      return;
    }
    const trip: Trip = {
      id: initial?.id ?? "",
      ...form,
      jarakKm: Math.max(0, Number(form.jarakKm) || 0),
    };
    if (!trip.id) {
      trip.id = crypto.randomUUID?.() ?? String(Date.now());
    }
    onSave(trip);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-brand-dark px-4 py-3">
          <h3 className="text-base font-semibold text-white">
            {initial ? "Edit ritase" : "Input ritase"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/10 px-2 py-1 text-sm text-white hover:bg-white/20"
          >
            Tutup
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-600">
              Isi cepat dari master sopir
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyDriver(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">— Pilih sopir —</option>
              {drivers
                .filter((d) => d.aktif)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama} · {d.platNomor}
                  </option>
                ))}
            </select>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Tanggal *
            <input
              type="date"
              required
              value={form.tanggal.slice(0, 10)}
              onChange={(e) => set("tanggal", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Nama sopir *
            <input
              value={form.namaSopir}
              onChange={(e) => set("namaSopir", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Plat nomor
            <input
              value={form.platNomor}
              onChange={(e) => set("platNomor", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jenis material
            <input
              value={form.namaPaket}
              onChange={(e) => set("namaPaket", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Lokasi ambil
            <input
              value={form.lokasiAmbil}
              onChange={(e) => set("lokasiAmbil", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Lokasi bongkar
            <input
              value={form.lokasiBongkar}
              onChange={(e) => set("lokasiBongkar", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jarak (km)
            <input
              type="number"
              min={0}
              step={0.1}
              value={Number.isFinite(form.jarakKm) ? form.jarakKm : 0}
              onChange={(e) =>
                set(
                  "jarakKm",
                  Math.max(0, parseFloat(e.target.value) || 0),
                )
              }
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jam berangkat
            <input
              type="time"
              value={form.jamBerangkat}
              onChange={(e) => set("jamBerangkat", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jam pulang
            <input
              type="time"
              value={form.jamPulang}
              onChange={(e) => set("jamPulang", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Kategori muatan
            <select
              value={form.kategoriMuatan}
              onChange={(e) =>
                set(
                  "kategoriMuatan",
                  e.target.value as typeof form.kategoriMuatan,
                )
              }
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="UTAMA">UTAMA</option>
              <option value="BALIK">BALIK</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jenis muatan
            <select
              value={form.jenisMuatan}
              onChange={(e) =>
                set("jenisMuatan", e.target.value as typeof form.jenisMuatan)
              }
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="ASPAL">ASPAL</option>
              <option value="NON ASPAL">NON ASPAL</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jenis truk
            <select
              value={form.jenisTruk}
              onChange={(e) => set("jenisTruk", e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              {vehicleRules.map((r) => (
                <option key={r.id} value={r.nama}>
                  {r.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Jenis medan
            <select
              value={form.jenisMedan}
              onChange={(e) =>
                set("jenisMedan", e.target.value as typeof form.jenisMedan)
              }
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="MUDAH">MUDAH</option>
              <option value="BERAT">BERAT</option>
            </select>
          </label>

          <label className="flex items-center gap-2 lg:col-span-2">
            <input
              type="checkbox"
              checked={form.upahPokokDiberikan}
              onChange={(e) => set("upahPokokDiberikan", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span className="text-sm text-slate-800">Upah pokok diberikan</span>
          </label>

          {preview && (
            <div className="lg:col-span-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-sm">
              <p className="mb-2 font-semibold text-teal-900">
                Pratinjau hitungan
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                <span>Upah: {formatRupiah(preview.upah)}</span>
                <span>Pokok: {formatRupiah(preview.pokok)}</span>
                <span>Uang makan: {formatRupiah(preview.uangMakan)}</span>
                <span>Solar: {formatRupiah(preview.solar)}</span>
                <span className="font-medium text-teal-900">
                  Total premi: {formatRupiah(preview.totalPremi)}
                </span>
                <span className="font-semibold text-slate-900">
                  Total biaya: {formatRupiah(preview.totalBiaya)}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
