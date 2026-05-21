"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Car,
  ChevronDown,
  FileInput,
  LayoutDashboard,
  LogOut,
  Printer,
  Settings,
  Truck,
  UserSquare2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateRitase,
  findPlatJadwalConflict,
  findSopirBedaPlatJadwalConflict,
  isJamTibaBeforeJamBerangkat,
} from "@/lib/calculations";
import { DEFAULT_VEHICLE_RULES } from "@/lib/defaults";
import { formatRupiah } from "@/lib/format";
import { filterTransactionsByPeriod, getPreviousPeriodSelection, normalizeTransactionDateIso } from "@/lib/periodFilter";
import {
  getDefaultSettings,
  getAppSettings,
  loadKendaraan,
  loadPersonil,
  loadRitaseTransactions,
  saveAppSettings,
  saveKendaraan,
  savePersonil,
  saveRitaseTransactions,
} from "@/lib/storage";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import * as cloudApi from "@/lib/supabase/api";
import { migrateLocalStorageToSupabase } from "@/lib/migrateLocalStorageToSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { TripleSBrandMark } from "@/components/TripleSBrandMark";
import type {
  AppSettings,
  Branch,
  DashboardPeriodState,
  JenisMuatan,
  KategoriMuatan,
  Kendaraan,
  MuatanKembaliJenis,
  Personil,
  SimpleTrip,
  SimpleTripInput,
  StatusAktif,
  StatusSopir,
} from "@/lib/types";

type MenuKey = "dashboard" | "cabang" | "inputRitase" | "rekap" | "personil" | "kendaraan" | "settings";
type RekapTab = "sopir" | "paket" | "kendaraan" | "rute";

const REKAP_TAB_LABEL: Record<RekapTab, string> = {
  sopir: "Rekap Sopir",
  paket: "Rekap Paket",
  kendaraan: "Rekap Kendaraan",
  rute: "Rekap Rute",
};

const MAIN_MENU: Array<{ id: MenuKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inputRitase", label: "Input Ritase", icon: FileInput },
  { id: "rekap", label: "Rekap", icon: Truck },
];

const ASET_MENU: Array<{ id: MenuKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "personil", label: "Personil", icon: UserSquare2 },
  { id: "kendaraan", label: "Kendaraan", icon: Car },
];

const BOTTOM_MENU: Array<{ id: MenuKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "settings", label: "Settings", icon: Settings },
];

const CABANG_MENU: Array<{ id: MenuKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "cabang", label: "Cabang", icon: Building2 },
];

/** Password Settings hanya dipakai mode lokal (tanpa Supabase). */
const SETTINGS_PASSWORD = "admin123";

function getDefaultDashboardPeriod(): DashboardPeriodState {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return {
    periodType: "bulanan",
    selectedDate: `${y}-${m}-${d}`,
    selectedMonth: `${y}-${m}`,
    selectedYear: y,
  };
}

const defaultPersonilForm: Omit<Personil, "id"> = {
  namaSopir: "",
  statusSopir: "SOPIR PREMI",
  statusAktif: "AKTIF",
};

const defaultKendaraanForm: Omit<Kendaraan, "id"> = {
  jenisKendaraan: "DT KECIL",
  platNomor: "",
  statusAktif: "AKTIF",
};

const defaultRitaseForm: SimpleTripInput = {
  tanggal: new Date().toISOString().slice(0, 10),
  namaSopir: "",
  statusSopir: "SOPIR PREMI",
  platNomor: "",
  namaPaketPekerjaan: "",
  lokasiAmbil: "",
  lokasiKirim: "",
  jamAmbil: "07:00",
  jamKirim: "17:00",
  jarakKm: 0,
  jenisKendaraan: "DT KECIL",
  jenisMedan: "MUDAH",
  jenisMuatan: "NON ASPAL",
  kategoriMuatan: "UTAMA",
  muatanKembaliJenis: "KOSONG",
  muatanKembaliUraian: "",
  keterangan: "",
};

function labelJenisMuatan(m: JenisMuatan): string {
  return m === "ASPAL" ? "Aspal" : "Non Aspal";
}

function labelKategoriMuatan(k: KategoriMuatan): string {
  return k === "UTAMA" ? "Muatan Utama" : "Muatan Kembali";
}

function labelMuatanKembali(j: MuatanKembaliJenis): string {
  return j === "BERMUATAN" ? "Bermuatan" : "Kosong";
}

function formatKeteranganFallback(k?: string): string {
  const t = k?.trim();
  return t ? t : "-";
}

function formatKeteranganTableCell(k?: string): string {
  const full = formatKeteranganFallback(k);
  if (full === "-") return "-";
  if (full.length <= 50) return full;
  return `${full.slice(0, 50)}...`;
}

function buildId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatIdLongDate(iso: string): string {
  const dt = parseIsoDateLocal(iso);
  if (!dt || Number.isNaN(dt.getTime())) return iso.trim() || "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

/** Teks periode filter rekap untuk layar & cetak. */
function formatRekapPeriode(tanggalMulai: string, tanggalAkhir: string): string {
  const mulai = tanggalMulai.trim();
  const akhir = tanggalAkhir.trim();
  if (!mulai && !akhir) {
    return "Semua tanggal (filter tanggal tidak dipakai)";
  }
  if (mulai && akhir) {
    if (mulai === akhir) {
      return formatIdLongDate(mulai);
    }
    return `${formatIdLongDate(mulai)} s.d. ${formatIdLongDate(akhir)}`;
  }
  if (mulai) {
    return `Mulai ${formatIdLongDate(mulai)} (tanpa batas akhir pada filter)`;
  }
  return `Sampai ${formatIdLongDate(akhir)} (tanpa batas mulai pada filter)`;
}

/** Perbandingan nama sopir ganda: trim, rapatkan spasi, huruf kecil. */
function normalizeNamaSopirKey(nama: string): string {
  return nama.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Perbandingan plat ganda: trim, hilangkan spasi, huruf besar. */
function normalizePlatNomorKey(plat: string): string {
  return plat.trim().replace(/\s+/g, "").toUpperCase();
}

function newRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : buildId();
}

function aggregatePeriodTotals(transactions: SimpleTrip[]) {
  return {
    ritase: transactions.length,
    solar: transactions.reduce((a, b) => a + b.totalSolar, 0),
    upahRitase: transactions.reduce((a, b) => a + b.upahRitase, 0),
    biaya: transactions.reduce((a, b) => a + b.totalBiaya, 0),
  };
}

export function DashboardShell() {
  const router = useRouter();
  const auth = useAuth();
  const cloud = isSupabaseConfigured();
  const profile = cloud ? auth.profile : null;

  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");
  const [rekapTab, setRekapTab] = useState<RekapTab>("sopir");

  const [personil, setPersonil] = useState<Personil[]>([]);
  const [kendaraan, setKendaraan] = useState<Kendaraan[]>([]);
  const [transactions, setTransactions] = useState<SimpleTrip[]>([]);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriodState>(() => getDefaultDashboardPeriod());
  const [rekapDateFilter, setRekapDateFilter] = useState({
    tanggalMulai: "",
    tanggalAkhir: "",
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(getDefaultSettings());
  const [settingsDraft, setSettingsDraft] = useState("6800");
  const [premiBasePayDraft, setPremiBasePayDraft] = useState("40000");
  const [vehicleRatesDraft, setVehicleRatesDraft] = useState<AppSettings["vehicleRates"]>(
    getDefaultSettings().vehicleRates,
  );
  const [muatanAspalDraft, setMuatanAspalDraft] = useState("20000");
  const [muatanNonAspalDraft, setMuatanNonAspalDraft] = useState("0");
  const [persentaseKembaliDraft, setPersentaseKembaliDraft] = useState("30");
  const [settingsError, setSettingsError] = useState("");

  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  /** Filter lihat data (Admin Pusat): "" = semua cabang. */
  const [filterBranchId, setFilterBranchId] = useState("");
  /** Cabang tujuan migrasi localStorage → Supabase (hanya di Settings). */
  const [pusatWriteBranchId, setPusatWriteBranchId] = useState("");
  const [branchAdminForm, setBranchAdminForm] = useState({ name: "", code: "" });
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);
  const [migrateErr, setMigrateErr] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  const [personilForm, setPersonilForm] = useState(defaultPersonilForm);
  const [editPersonilId, setEditPersonilId] = useState<string | null>(null);
  const [personilSubmitError, setPersonilSubmitError] = useState("");
  const [kendaraanForm, setKendaraanForm] = useState(defaultKendaraanForm);
  const [editKendaraanId, setEditKendaraanId] = useState<string | null>(null);
  const [kendaraanSubmitError, setKendaraanSubmitError] = useState("");

  const [ritaseForm, setRitaseForm] = useState(defaultRitaseForm);
  const [hasilPerhitunganOpen, setHasilPerhitunganOpen] = useState(false);
  const [selectedPersonilId, setSelectedPersonilId] = useState("");
  const [selectedKendaraanId, setSelectedKendaraanId] = useState("");
  const [detail, setDetail] = useState<SimpleTrip | null>(null);
  const [detailList, setDetailList] = useState<SimpleTrip[]>([]);
  const [detailTitle, setDetailTitle] = useState("Detail");
  const [ready, setReady] = useState(false);
  const [pengajuanId, setPengajuanId] = useState<string | null>(null)
  const [pengajuanStatus, setPengajuanStatus] = useState<"PENDING" | "DISETUJUI" | "DITOLAK" | null>(null)
  const [printTokenExp, setPrintTokenExp] = useState<string | null>(null)
  const [ceklisSopir, setCeklisSopir] = useState<Record<string, boolean>>({})
  const [loadingPengajuan, setLoadingPengajuan] = useState(false)
  const [showOtorisasiModal, setShowOtorisasiModal] = useState(false)
  const [catatanOtorisasi, setCatatanOtorisasi] = useState("")

  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPasswordModalOpen, setSettingsPasswordModalOpen] = useState(false);
  const [settingsGatePassword, setSettingsGatePassword] = useState("");
  const [settingsGateError, setSettingsGateError] = useState("");

  const closeSettingsPasswordModal = () => {
    setSettingsPasswordModalOpen(false);
    setSettingsGatePassword("");
    setSettingsGateError("");
  };

  const handleMenuChange = (id: MenuKey) => {
    if (id === "rekap") {
      void fetchPengajuanTerbaru();
    }
    if (id === "settings") {
      if (cloud && profile?.role !== "ADMIN_PUSAT" && profile?.role !== "ID_MASTER") return;
      if (cloud && (profile?.role === "ADMIN_PUSAT" || profile?.role === "ID_MASTER")) {
        setActiveMenu("settings");
        return;
      }
      if (settingsUnlocked) {
        setActiveMenu("settings");
      } else {
        setSettingsGatePassword("");
        setSettingsGateError("");
        setSettingsPasswordModalOpen(true);
      }
      return;
    }
    setActiveMenu(id);
  };

  const submitSettingsGate = (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsGatePassword === SETTINGS_PASSWORD) {
      setSettingsUnlocked(true);
      setActiveMenu("settings");
      closeSettingsPasswordModal();
    } else {
      setSettingsGateError("Password salah");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDataLoadError(null);
      if (!cloud) {
        setPersonil(loadPersonil());
        setKendaraan(loadKendaraan());
        setTransactions(loadRitaseTransactions());
        const initialSettings = getAppSettings();
        setAppSettings(initialSettings);
        setSettingsDraft(String(initialSettings.solarPricePerLiter));
        setPremiBasePayDraft(String(initialSettings.premiBasePay));
        setVehicleRatesDraft(initialSettings.vehicleRates);
        setMuatanAspalDraft(String(initialSettings.tambahanUpahRitaseAspal));
        setMuatanNonAspalDraft(String(initialSettings.tambahanUpahRitaseNonAspal));
        setPersentaseKembaliDraft(String(initialSettings.persentaseUpahMuatanKembaliBermuatan));
        setReady(true);
        return;
      }
      if (!profile) {
        setReady(false);
        return;
      }
      setReady(false);
      try {
        const client = getSupabaseBrowserClient();
        if (profile.role === "ADMIN_PUSAT") {
          const br = await cloudApi.fetchBranches(client);
          if (!cancelled) setAllBranches(br);
        } else {
          setAllBranches([]);
        }
        const bf = profile.role === "ADMIN_PUSAT" ? (filterBranchId || null) : null;
        const [p, k, t, s] = await Promise.all([
          cloudApi.fetchPersonil(client, profile, bf),
          cloudApi.fetchKendaraan(client, profile, bf),
          cloudApi.fetchTransactions(client, profile, bf),
          cloudApi.fetchAppSettings(client),
        ]);
        if (cancelled) return;
        setPersonil(p);
        setKendaraan(k);
        setTransactions(t);
        setAppSettings(s);
        setSettingsDraft(String(s.solarPricePerLiter));
        setPremiBasePayDraft(String(s.premiBasePay));
        setVehicleRatesDraft(s.vehicleRates);
        setMuatanAspalDraft(String(s.tambahanUpahRitaseAspal));
        setMuatanNonAspalDraft(String(s.tambahanUpahRitaseNonAspal));
        setPersentaseKembaliDraft(String(s.persentaseUpahMuatanKembaliBermuatan));
      } catch (e) {
        if (!cancelled) setDataLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setReady(true);
          // ADMIN_CABANG tidak punya fitur Dashboard — langsung ke Input Ritase
          if (profile?.role === "ADMIN_CABANG") setActiveMenu("inputRitase");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cloud, profile, filterBranchId]);

  // Realtime: auto-refresh data saat ada perubahan dari cabang lain
  useEffect(() => {
    if (!cloud || !profile) return;
    const client = getSupabaseBrowserClient();
    const bf = profile.role === "ADMIN_PUSAT" ? (filterBranchId || null) : profile.branchId ?? null;

    const channel = client
      .channel("realtime-premi")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, async () => {
        try {
          const t = await cloudApi.fetchTransactions(client, profile, bf);
          setTransactions(t);
        } catch {}
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "personil" }, async () => {
        try {
          const p = await cloudApi.fetchPersonil(client, profile, bf);
          setPersonil(p);
        } catch {}
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kendaraan" }, async () => {
        try {
          const k = await cloudApi.fetchKendaraan(client, profile, bf);
          setKendaraan(k);
        } catch {}
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [cloud, profile, filterBranchId]);

  const activePersonil = useMemo(
    () => personil.filter((p) => p.statusAktif === "AKTIF"),
    [personil],
  );
  const activeKendaraan = useMemo(
    () => kendaraan.filter((k) => k.statusAktif === "AKTIF"),
    [kendaraan],
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactionsByPeriod(
        transactions,
        dashboardPeriod.periodType,
        dashboardPeriod.selectedDate,
        dashboardPeriod.selectedMonth,
        dashboardPeriod.selectedYear,
      ),
    [transactions, dashboardPeriod],
  );

  const ritaseHistoryTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const da = normalizeTransactionDateIso(a.tanggal) ?? a.tanggal.slice(0, 10);
      const db = normalizeTransactionDateIso(b.tanggal) ?? b.tanggal.slice(0, 10);
      if (db !== da) return db.localeCompare(da);
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }, [transactions]);
  const rekapFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = t.tanggal.slice(0, 10);
      if (rekapDateFilter.tanggalMulai && date < rekapDateFilter.tanggalMulai)
        return false;
      if (rekapDateFilter.tanggalAkhir && date > rekapDateFilter.tanggalAkhir)
        return false;
      return true;
    });
  }, [transactions, rekapDateFilter]);

  const periodComparison = useMemo(() => {
    const currentTransactions = filterTransactionsByPeriod(
      transactions,
      dashboardPeriod.periodType,
      dashboardPeriod.selectedDate,
      dashboardPeriod.selectedMonth,
      dashboardPeriod.selectedYear,
    );
    const current = aggregatePeriodTotals(currentTransactions);
    const prevSel = getPreviousPeriodSelection(
      dashboardPeriod.periodType,
      dashboardPeriod.selectedDate,
      dashboardPeriod.selectedMonth,
      dashboardPeriod.selectedYear,
    );
    const previousTransactions = filterTransactionsByPeriod(
      transactions,
      dashboardPeriod.periodType,
      prevSel.selectedDate,
      prevSel.selectedMonth,
      prevSel.selectedYear,
    );
    const previous = aggregatePeriodTotals(previousTransactions);
    return { current, previous };
  }, [transactions, dashboardPeriod]);

  const previewCalc = useMemo(
    () =>
      calculateRitase({
        formData: {
          ...ritaseForm,
          statusSopir: ritaseForm.statusSopir,
        },
        existingTransactions: transactions,
        settings: appSettings,
      }),
    [ritaseForm, transactions, appSettings],
  );

  const platJadwalConflict = useMemo(() => {
    if (!selectedKendaraanId || !ritaseForm.tanggal) return null;
    const k = kendaraan.find((x) => x.id === selectedKendaraanId);
    if (!k?.platNomor?.trim()) return null;
    return findPlatJadwalConflict({
      tanggal: ritaseForm.tanggal,
      platNomor: k.platNomor,
      jamAmbil: ritaseForm.jamAmbil,
      jamKirim: ritaseForm.jamKirim,
      existingTransactions: transactions,
    });
  }, [
    selectedKendaraanId,
    kendaraan,
    ritaseForm.tanggal,
    ritaseForm.jamAmbil,
    ritaseForm.jamKirim,
    transactions,
  ]);

  const sopirBedaPlatJadwalConflict = useMemo(() => {
    if (!selectedPersonilId || !selectedKendaraanId || !ritaseForm.tanggal) return null;
    const p = personil.find((x) => x.id === selectedPersonilId);
    const k = kendaraan.find((x) => x.id === selectedKendaraanId);
    if (!p?.namaSopir?.trim() || !k?.platNomor?.trim()) return null;
    return findSopirBedaPlatJadwalConflict({
      tanggal: ritaseForm.tanggal,
      namaSopir: p.namaSopir,
      platNomor: k.platNomor,
      jamAmbil: ritaseForm.jamAmbil,
      jamKirim: ritaseForm.jamKirim,
      existingTransactions: transactions,
    });
  }, [
    selectedPersonilId,
    selectedKendaraanId,
    personil,
    kendaraan,
    ritaseForm.tanggal,
    ritaseForm.jamAmbil,
    ritaseForm.jamKirim,
    transactions,
  ]);

  const jamTibaSebelumBerangkat = useMemo(
    () => isJamTibaBeforeJamBerangkat(ritaseForm.jamAmbil, ritaseForm.jamKirim),
    [ritaseForm.jamAmbil, ritaseForm.jamKirim],
  );

  const ritaseJadwalBlocked =
    platJadwalConflict != null || sopirBedaPlatJadwalConflict != null || jamTibaSebelumBerangkat;

  const muatanKembaliTanpaUraian =
    ritaseForm.kategoriMuatan === "BALIK" &&
    ritaseForm.muatanKembaliJenis === "BERMUATAN" &&
    !ritaseForm.muatanKembaliUraian?.trim();

  const ritaseSubmitBlocked = ritaseJadwalBlocked || muatanKembaliTanpaUraian;

  const chartSolarKendaraan = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach((t) => {
      const key = `${t.jenisKendaraan} - ${t.platNomor}`;
      map.set(key, (map.get(key) ?? 0) + t.totalSolar);
    });
    return Array.from(map.entries()).map(([name, totalSolar]) => ({ name, totalSolar }));
  }, [filteredTransactions]);

  const chartSopir = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach((t) => {
      map.set(t.namaSopir, (map.get(t.namaSopir) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, ritase]) => ({ name, ritase }));
  }, [filteredTransactions]);

  const chartHarian = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach((t) => {
      const iso = normalizeTransactionDateIso(t.tanggal) ?? t.tanggal;
      map.set(iso, (map.get(iso) ?? 0) + t.totalBiaya);
    });
    return Array.from(map.entries())
      .map(([tanggal, biaya]) => ({ tanggal, biaya }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [filteredTransactions]);

  const chartKomposisi = useMemo(
    () => [
      { name: "Upah Sopir", value: filteredTransactions.reduce((a, b) => a + b.totalUpahSopir, 0) },
      { name: "Solar", value: filteredTransactions.reduce((a, b) => a + b.totalSolar, 0) },
    ],
    [filteredTransactions],
  );

  const rekapSopir = useMemo(() => {
    const map = new Map<string, { namaSopir: string; statusSopir: StatusSopir; totalRitase: number; totalKm: number; totalUpahRitase: number; totalUpahPokok: number; totalUpahSopir: number; totalSolar: number; totalBiaya: number }>();
    rekapFilteredTransactions.forEach((t) => {
      const key = `${t.namaSopir}__${t.statusSopir}`;
      if (!map.has(key)) {
        map.set(key, {
          namaSopir: t.namaSopir,
          statusSopir: t.statusSopir,
          totalRitase: 0,
          totalKm: 0,
          totalUpahRitase: 0,
          totalUpahPokok: 0,
          totalUpahSopir: 0,
          totalSolar: 0,
          totalBiaya: 0,
        });
      }
      const row = map.get(key)!;
      row.totalRitase += 1;
      row.totalKm += t.jarakKm;
      row.totalUpahRitase += t.upahRitase;
      row.totalUpahPokok += t.upahPokok;
      row.totalUpahSopir += t.totalUpahSopir;
      row.totalSolar += t.totalSolar;
      row.totalBiaya += t.totalBiaya;
    });
    return Array.from(map.values());
  }, [rekapFilteredTransactions]);

  const rekapPaket = useMemo(() => groupBySimple(rekapFilteredTransactions, (t) => t.namaPaketPekerjaan || "(kosong)"), [rekapFilteredTransactions]);
  const rekapKendaraan = useMemo(() => groupBySimple(rekapFilteredTransactions, (t) => `${t.jenisKendaraan}__${t.platNomor}`), [rekapFilteredTransactions]);
  const rekapRute = useMemo(() => groupBySimple(rekapFilteredTransactions, (t) => `${t.lokasiAmbil}__${t.lokasiKirim}`), [rekapFilteredTransactions]);

  const rekapGrandTotals = useMemo(() => {
    const txs = rekapFilteredTransactions;
    return {
      totalRitase: txs.length,
      totalKm: txs.reduce((a, t) => a + t.jarakKm, 0),
      totalUpahRitase: txs.reduce((a, t) => a + t.upahRitase, 0),
      totalUpahPokok: txs.reduce((a, t) => a + t.upahPokok, 0),
      totalUpahSopir: txs.reduce((a, t) => a + t.totalUpahSopir, 0),
      totalSolar: txs.reduce((a, t) => a + t.totalSolar, 0),
      totalBiaya: txs.reduce((a, t) => a + t.totalBiaya, 0),
    };
  }, [rekapFilteredTransactions]);

  const effectiveWriteBranchId = useMemo(() => {
    if (!cloud || !profile) return null;
    return profile.branchId ?? null;
  }, [cloud, profile]);

  const transactionsForConflict = useMemo(() => {
    if (!cloud || !effectiveWriteBranchId) return transactions;
    return transactions.filter((t) => !t.branchId || t.branchId === effectiveWriteBranchId);
  }, [transactions, cloud, effectiveWriteBranchId]);

  const personilScoped = useMemo(() => {
    if (!cloud || !effectiveWriteBranchId) return personil;
    return personil.filter((p) => !p.branchId || p.branchId === effectiveWriteBranchId);
  }, [personil, cloud, effectiveWriteBranchId]);

  const kendaraanScoped = useMemo(() => {
    if (!cloud || !effectiveWriteBranchId) return kendaraan;
    return kendaraan.filter((k) => !k.branchId || k.branchId === effectiveWriteBranchId);
  }, [kendaraan, cloud, effectiveWriteBranchId]);

  const savePersonilState = (next: Personil[]) => {
    const prev = personil;
    setPersonil(next);
    if (!cloud) {
      savePersonil(next);
      return;
    }
    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        const removed = prev.filter((p) => !next.some((n) => n.id === p.id));
        for (const p of removed) await cloudApi.deletePersonil(client, p.id);
        for (const row of next) {
          if (row.branchId) await cloudApi.upsertPersonil(client, row);
        }
      } catch (e) {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  };
  const saveKendaraanState = (next: Kendaraan[]) => {
    const prev = kendaraan;
    setKendaraan(next);
    if (!cloud) {
      saveKendaraan(next);
      return;
    }
    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        const removed = prev.filter((p) => !next.some((n) => n.id === p.id));
        for (const p of removed) await cloudApi.deleteKendaraan(client, p.id);
        for (const row of next) {
          if (row.branchId) await cloudApi.upsertKendaraan(client, row);
        }
      } catch (e) {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  };
  const saveTransactionsState = (next: SimpleTrip[]) => {
    const prev = transactions;
    setTransactions(next);
    if (!cloud) {
      saveRitaseTransactions(next);
      return;
    }
    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        const removed = prev.filter((p) => !next.some((n) => n.id === p.id));
        for (const p of removed) await cloudApi.deleteTransaction(client, p.id);
        const added = next.filter((n) => !prev.some((p) => p.id === n.id));
        for (const row of added) {
          if (row.branchId) await cloudApi.insertTransaction(client, row, row.branchId);
        }
      } catch (e) {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  };

  const submitPersonil = (e: React.FormEvent) => {
    e.preventDefault();
    const nama = personilForm.namaSopir.trim();
    if (!nama) return;
    const bid = effectiveWriteBranchId;
    if (cloud && !bid) {
      setPersonilSubmitError("Akun belum ditautkan ke cabang. Hubungi Admin untuk mengatur akun ini.");
      return;
    }
    const key = normalizeNamaSopirKey(nama);
    const namaDup = personilScoped.some(
      (p) => p.id !== editPersonilId && normalizeNamaSopirKey(p.namaSopir) === key,
    );
    if (namaDup) {
      setPersonilSubmitError(
        "Penolakan — nama sopir sudah terdaftar. Satu nama tidak boleh diduplikasi.",
      );
      return;
    }
    setPersonilSubmitError("");
    if (editPersonilId) {
      savePersonilState(
        personil.map((p) =>
          p.id === editPersonilId
            ? { id: p.id, branchId: p.branchId ?? bid ?? undefined, ...personilForm, namaSopir: nama }
            : p,
        ),
      );
    } else {
      savePersonilState([
        ...personil,
        { id: newRowId(), branchId: bid ?? undefined, ...personilForm, namaSopir: nama },
      ]);
    }
    setPersonilForm(defaultPersonilForm);
    setEditPersonilId(null);
  };

  const submitKendaraan = (e: React.FormEvent) => {
    e.preventDefault();
    const plat = kendaraanForm.platNomor.trim();
    if (!plat) return;
    const bid = effectiveWriteBranchId;
    if (cloud && !bid) {
      setKendaraanSubmitError("Akun belum ditautkan ke cabang. Hubungi Admin untuk mengatur akun ini.");
      return;
    }
    const key = normalizePlatNomorKey(plat);
    const platDup = kendaraanScoped.some(
      (k) => k.id !== editKendaraanId && normalizePlatNomorKey(k.platNomor) === key,
    );
    if (platDup) {
      setKendaraanSubmitError(
        "Penolakan — plat nomor sudah terdaftar. Satu plat tidak boleh diduplikasi.",
      );
      return;
    }
    setKendaraanSubmitError("");
    const nextForm = { ...kendaraanForm, platNomor: plat };
    if (editKendaraanId) {
      saveKendaraanState(
        kendaraan.map((k) =>
          k.id === editKendaraanId ? { id: k.id, branchId: k.branchId ?? bid ?? undefined, ...nextForm } : k,
        ),
      );
    } else {
      saveKendaraanState([...kendaraan, { id: newRowId(), branchId: bid ?? undefined, ...nextForm }]);
    }
    setKendaraanForm(defaultKendaraanForm);
    setEditKendaraanId(null);
  };

  const submitRitase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonilId || !selectedKendaraanId) return;
    const selectedP = personil.find((p) => p.id === selectedPersonilId);
    const selectedK = kendaraan.find((k) => k.id === selectedKendaraanId);
    if (!selectedP || !selectedK) return;
    const bid = effectiveWriteBranchId;
    if (cloud && !bid) return;
    if (isJamTibaBeforeJamBerangkat(ritaseForm.jamAmbil, ritaseForm.jamKirim)) return;
    if (muatanKembaliTanpaUraian) return;
    if (
      findPlatJadwalConflict({
        tanggal: ritaseForm.tanggal,
        platNomor: selectedK.platNomor,
        jamAmbil: ritaseForm.jamAmbil,
        jamKirim: ritaseForm.jamKirim,
        existingTransactions: transactionsForConflict,
      })
    ) {
      return;
    }
    if (
      findSopirBedaPlatJadwalConflict({
        tanggal: ritaseForm.tanggal,
        namaSopir: selectedP.namaSopir,
        platNomor: selectedK.platNomor,
        jamAmbil: ritaseForm.jamAmbil,
        jamKirim: ritaseForm.jamKirim,
        existingTransactions: transactionsForConflict,
      })
    ) {
      return;
    }
    const calc = calculateRitase({
      formData: {
        ...ritaseForm,
        namaSopir: selectedP.namaSopir,
        statusSopir: selectedP.statusSopir,
        platNomor: selectedK.platNomor,
        jenisKendaraan: selectedK.jenisKendaraan,
      },
      existingTransactions: transactionsForConflict,
      settings: appSettings,
    });
    const payload: SimpleTrip = {
      id: newRowId(),
      branchId: bid ?? undefined,
      tanggal: ritaseForm.tanggal,
      namaSopir: selectedP.namaSopir,
      statusSopir: selectedP.statusSopir,
      platNomor: selectedK.platNomor,
      jenisKendaraan: selectedK.jenisKendaraan,
      namaPaketPekerjaan: ritaseForm.namaPaketPekerjaan,
      lokasiAmbil: ritaseForm.lokasiAmbil,
      lokasiKirim: ritaseForm.lokasiKirim,
      jamAmbil: ritaseForm.jamAmbil,
      jamKirim: ritaseForm.jamKirim,
      jarakKm: Math.max(0, Number(ritaseForm.jarakKm) || 0),
      jenisMedan: ritaseForm.jenisMedan,
      jenisMuatan: ritaseForm.jenisMuatan,
      kategoriMuatan: ritaseForm.kategoriMuatan,
      muatanKembaliJenis: ritaseForm.muatanKembaliJenis,
      muatanKembaliUraian:
        ritaseForm.kategoriMuatan === "BALIK" && ritaseForm.muatanKembaliJenis === "BERMUATAN"
          ? ritaseForm.muatanKembaliUraian?.trim() || ""
          : "",
      keterangan: ritaseForm.keterangan?.trim() || "",
      isPremiDriver: calc.isPremiDriver,
      premiBasePaySetting: calc.premiBasePaySetting,
      premiUpahPerKm: calc.premiUpahPerKm,
      upahPerKm: calc.upahPerKm,
      upahPokokSetting: calc.upahPokokSetting,
      solarPerKm: calc.solarPerKm,
      kmPerLiter: calc.kmPerLiter,
      solarPricePerLiter: calc.solarPricePerLiter,
      jarakDihitung: calc.jarakHitungUpah,
      tambahanUpahMuatan: calc.tambahanUpahMuatan,
      upahRitase: calc.upahRitase,
      upahPokok: calc.upahPokok,
      totalUpahSopir: calc.totalUpahSopir,
      totalLiterSolar: calc.totalLiterSolar,
      totalSolar: calc.totalSolar,
      totalBiaya: calc.totalBiaya,
      createdAt: new Date().toISOString(),
    };
    saveTransactionsState([...transactions, payload]);
    setRitaseForm({ ...defaultRitaseForm, tanggal: new Date().toISOString().slice(0, 10) });
    setSelectedPersonilId("");
    setSelectedKendaraanId("");
  };

  const handleSaveSettings = () => {
    const value = Number(settingsDraft);
    const premiBasePay = Number(premiBasePayDraft);
    if (!Number.isFinite(value) || value < 1000 || value > 50000) {
      setSettingsError("Harga solar harus di antara 1.000 sampai 50.000.");
      return;
    }
    if (!Number.isFinite(premiBasePay) || premiBasePay < 0) {
      setSettingsError("Upah pokok sopir premi tidak valid.");
      return;
    }
    const tambahanAspal = Number(muatanAspalDraft);
    const tambahanNonAspal = Number(muatanNonAspalDraft);
    if (!Number.isFinite(tambahanAspal) || tambahanAspal < 0) {
      setSettingsError("Tambahan upah muatan Aspal tidak valid.");
      return;
    }
    if (!Number.isFinite(tambahanNonAspal) || tambahanNonAspal < 0) {
      setSettingsError("Tambahan upah muatan Non Aspal tidak valid.");
      return;
    }
    const pctKembali = Number(persentaseKembaliDraft);
    if (!Number.isFinite(pctKembali) || pctKembali < 0 || pctKembali > 100) {
      setSettingsError("Persentase upah muatan kembali bermuatan harus antara 0 dan 100.");
      return;
    }
    for (const [kendaraanName, rate] of Object.entries(vehicleRatesDraft)) {
      if (rate.premiUpahPerKm < 0) {
        setSettingsError(`Upah per KM tidak valid untuk ${kendaraanName}.`);
        return;
      }
      if (rate.kmPerLiter <= 0) {
        setSettingsError(`Rasio KM/Liter harus > 0 untuk ${kendaraanName}.`);
        return;
      }
    }
    const next: AppSettings = {
      solarPricePerLiter: Math.round(value),
      premiBasePay: Math.round(premiBasePay),
      tambahanUpahRitaseAspal: Math.round(tambahanAspal),
      tambahanUpahRitaseNonAspal: Math.round(tambahanNonAspal),
      persentaseUpahMuatanKembaliBermuatan: Math.round(pctKembali),
      vehicleRates: vehicleRatesDraft,
    };
    if (!cloud) {
      saveAppSettings(next);
    } else if (profile?.role === "ADMIN_PUSAT") {
      void cloudApi.saveAppSettings(getSupabaseBrowserClient(), next).catch((e) => {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      });
    }
    setAppSettings(next);
    setSettingsDraft(String(next.solarPricePerLiter));
    setPremiBasePayDraft(String(next.premiBasePay));
    setMuatanAspalDraft(String(next.tambahanUpahRitaseAspal));
    setMuatanNonAspalDraft(String(next.tambahanUpahRitaseNonAspal));
    setPersentaseKembaliDraft(String(next.persentaseUpahMuatanKembaliBermuatan));
    setVehicleRatesDraft(next.vehicleRates);
    setSettingsError("");
  };

  const handleResetSettings = () => {
    const defaults = getDefaultSettings();
    const next: AppSettings = {
      solarPricePerLiter: defaults.solarPricePerLiter,
      premiBasePay: defaults.premiBasePay,
      tambahanUpahRitaseAspal: defaults.tambahanUpahRitaseAspal,
      tambahanUpahRitaseNonAspal: defaults.tambahanUpahRitaseNonAspal,
      persentaseUpahMuatanKembaliBermuatan: defaults.persentaseUpahMuatanKembaliBermuatan,
      vehicleRates: defaults.vehicleRates,
    };
    if (!cloud) {
      saveAppSettings(next);
    } else if (profile?.role === "ADMIN_PUSAT") {
      void cloudApi.saveAppSettings(getSupabaseBrowserClient(), next).catch((e) => {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      });
    }
    setAppSettings(next);
    setSettingsDraft(String(next.solarPricePerLiter));
    setPremiBasePayDraft(String(next.premiBasePay));
    setMuatanAspalDraft(String(next.tambahanUpahRitaseAspal));
    setMuatanNonAspalDraft(String(next.tambahanUpahRitaseNonAspal));
    setPersentaseKembaliDraft(String(next.persentaseUpahMuatanKembaliBermuatan));
    setVehicleRatesDraft(next.vehicleRates);
    setSettingsError("");
  };

  const saveSingleVehicleRate = (jenis: keyof AppSettings["vehicleRates"]) => {
    const rate = vehicleRatesDraft[jenis];
    if (rate.premiUpahPerKm < 0 || rate.kmPerLiter <= 0) {
      setSettingsError(`Nilai tarif ${jenis} tidak valid.`);
      return;
    }
    const next: AppSettings = {
      solarPricePerLiter: appSettings.solarPricePerLiter,
      premiBasePay: appSettings.premiBasePay,
      tambahanUpahRitaseAspal: appSettings.tambahanUpahRitaseAspal,
      tambahanUpahRitaseNonAspal: appSettings.tambahanUpahRitaseNonAspal,
      persentaseUpahMuatanKembaliBermuatan: appSettings.persentaseUpahMuatanKembaliBermuatan,
      vehicleRates: {
        ...appSettings.vehicleRates,
        [jenis]: rate,
      },
    };
    if (!cloud) {
      saveAppSettings(next);
    } else if (profile?.role === "ADMIN_PUSAT") {
      void cloudApi.saveAppSettings(getSupabaseBrowserClient(), next).catch((e) => {
        setDataLoadError(e instanceof Error ? e.message : String(e));
      });
    }
    setAppSettings(next);
    setSettingsError("");
  };

  const submitBranchAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = branchAdminForm.name.trim();
    if (!name || !cloud) return;
    try {
      const client = getSupabaseBrowserClient();
      const b = await cloudApi.insertBranch(client, name, branchAdminForm.code.trim());
      setAllBranches((prev) => [...prev, b].sort((a, c) => a.name.localeCompare(c.name, "id")));
      setBranchAdminForm({ name: "", code: "" });
      setMigrateErr(null);
    } catch (err) {
      setDataLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!cloud || !confirm("Hapus cabang ini? Data personil/kendaraan/transaksi terkait akan ikut terhapus (cascade).")) return;
    try {
      const client = getSupabaseBrowserClient();
      await cloudApi.deleteBranch(client, id);
      setAllBranches((prev) => prev.filter((b) => b.id !== id));
      if (filterBranchId === id) setFilterBranchId("");
      if (pusatWriteBranchId === id) setPusatWriteBranchId(""); // reset migrasi jika cabang dihapus
    } catch (err) {
      setDataLoadError(err instanceof Error ? err.message : String(err));
    }
  };


  // ── FUNGSI OTORISASI ──
  const canPrint =
    pengajuanStatus === "DISETUJUI" && printTokenExp
      ? new Date(printTokenExp) > new Date()
      : false;

  const semuaSopirDiceklis =
    rekapSopir.length > 0 && rekapSopir.every((r) => ceklisSopir[r.namaSopir]);

  const handleAjukanOtorisasi = async () => {
    if (!semuaSopirDiceklis || !profile) return;
    setLoadingPengajuan(true);
    const client = getSupabaseBrowserClient();
    const { data, error } = await client
      .from("pengajuan_otorisasi")
      .insert({
        diajukan_oleh: profile.id,
        status: "PENDING",
        tanggal_mulai: rekapDateFilter.tanggalMulai || null,
        tanggal_akhir: rekapDateFilter.tanggalAkhir || null,
        jenis_rekap: REKAP_TAB_LABEL[rekapTab],
      })
      .select()
      .single();
    if (!error && data) {
      setPengajuanId(data.id);
      setPengajuanStatus("PENDING");
      const { data: masters } = await client.from("profiles").select("id").eq("role", "ID_MASTER");
      if (masters) {
        await client.from("notifikasi").insert(
          masters.map((m: { id: string }) => ({
            untuk_user: m.id,
            judul: "Pengajuan Otorisasi Baru",
            pesan: `${profile.email} mengajukan otorisasi rekap "${REKAP_TAB_LABEL[rekapTab]}".`,
            link: "/master/otorisasi?id=" + data.id,
            tipe: "PENGAJUAN",
          })),
        );
      }
      alert("Pengajuan berhasil dikirim ke ID Master!");
    }
    setLoadingPengajuan(false);
  };

  const handleOtorisasi = async (disetujui: boolean) => {
    if (!pengajuanId || !profile) return;
    setLoadingPengajuan(true);
    const client = getSupabaseBrowserClient();
    await client.rpc("proses_otorisasi", {
      p_pengajuan_id: pengajuanId,
      p_disetujui: disetujui,
      p_catatan: catatanOtorisasi || null,
    });
    setShowOtorisasiModal(false);
    setCatatanOtorisasi("");
    setLoadingPengajuan(false);
    alert(disetujui ? "Pengajuan disetujui!" : "Pengajuan ditolak.");
  };

  const fetchPengajuanTerbaru = async () => {
    if (!profile || profile.role === "ADMIN_CABANG") return;
    const client = getSupabaseBrowserClient();
    if (profile.role === "ADMIN_PUSAT") {
      const { data } = await client
        .from("pengajuan_otorisasi")
        .select("*")
        .eq("diajukan_oleh", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setPengajuanId(data.id);
        setPengajuanStatus(data.status);
        setPrintTokenExp(data.print_token_exp);
      }
    }
  };
  const mainNavItems = useMemo(() => {
    if (profile?.role === "ADMIN_CABANG") return MAIN_MENU.filter((m) => m.id !== "dashboard");
    return MAIN_MENU;
  }, [profile?.role]);

  const bottomNavItems = useMemo(() => {
    if (!cloud) return BOTTOM_MENU;
    if (profile?.role === "ADMIN_PUSAT" || profile?.role === "ID_MASTER") return BOTTOM_MENU;
    return [];
  }, [cloud, profile?.role]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center">Memuat...</div>;

  return (
    <div className="min-h-screen bg-[#f5f7fb] print:bg-white">
      <aside className="fixed inset-y-0 left-0 z-40 w-[260px] border-r border-slate-200 bg-white p-4 print:hidden">
        <div className="mb-5 flex min-w-0 items-center gap-3 border-b border-slate-200 pb-4">
          <TripleSBrandMark className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase leading-tight text-slate-900 sm:text-sm">
              TRIPLE S INDOSEDULUR
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
              CONSTRUCTION COMPANY
            </p>
          </div>
        </div>
        <MenuGroup items={mainNavItems} activeMenu={activeMenu} onChange={setActiveMenu} />
        <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Aset</p>
        <MenuGroup items={ASET_MENU} activeMenu={activeMenu} onChange={setActiveMenu} />
        <div className="mt-5">
          <MenuGroup items={bottomNavItems} activeMenu={activeMenu} onChange={handleMenuChange} />
        </div>
      </aside>
      {showOtorisasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Proses Otorisasi</h2>
            <p className="text-sm text-slate-600 mb-4">Setujui atau tolak pengajuan rekap dari Admin Pusat.</p>
            <label className="text-xs font-medium text-slate-600 block mb-1">Catatan (opsional)</label>
            <textarea value={catatanOtorisasi} onChange={e => setCatatanOtorisasi(e.target.value)} rows={3} className="input w-full mb-4" placeholder="Tambahkan catatan jika perlu..." />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowOtorisasiModal(false)} className="btn-secondary h-10 px-4">Batal</button>
              <button onClick={() => handleOtorisasi(false)} className="h-10 px-4 rounded-lg bg-red-500 text-white font-semibold">Tolak</button>
              <button onClick={() => handleOtorisasi(true)} className="h-10 px-4 rounded-lg bg-green-600 text-white font-semibold">Setujui</button>
            </div>
          </div>
        </div>
      )}

      {settingsPasswordModalOpen && !cloud && (
        <SettingsAccessModal
          password={settingsGatePassword}
          onPasswordChange={setSettingsGatePassword}
          error={settingsGateError}
          onSubmit={submitSettingsGate}
          onCancel={closeSettingsPasswordModal}
        />
      )}

      <div className="ml-[260px] print:ml-0 print:w-full">
        <header className="flex min-h-16 flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 print:hidden md:px-6">
          {cloud && profile?.role === "ADMIN_PUSAT" && (
            <div className="mr-auto flex flex-wrap items-end gap-3">
              <label className="text-[11px] font-medium text-slate-600">
                <span className="mb-0.5 block">Filter cabang (tampilan)</span>
                <select
                  className="input h-9 max-w-[220px] text-sm"
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value)}
                >
                  <option value="">Semua cabang</option>
                  {allBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {cloud && auth.user && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="max-w-[200px] truncate" title={auth.user.email ?? ""}>
                {auth.user.email}
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-medium">{profile?.role}</span>
              <button
                type="button"
                className="btn-secondary inline-flex h-9 items-center gap-1 px-3 text-xs"
                onClick={() => {
                  void auth.signOut();
                  router.push("/login");
                }}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Logout
              </button>
            </div>
          )}
          <button type="button" className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
            <Bell className="h-4 w-4" />
          </button>
        </header>

        <main className="space-y-5 p-6 print:p-4 print:space-y-4">
          {dataLoadError && (
            <div
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
              role="alert"
            >
              <p className="font-semibold">Gagal sinkronisasi data</p>
              <p className="mt-1 text-xs">{dataLoadError}</p>
            </div>
          )}
          {cloud && profile?.role === "ADMIN_CABANG" && !profile.branchId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Akun Anda belum ditautkan ke cabang. Hubungi Admin Pusat untuk mengatur{" "}
              <code className="rounded bg-white/80 px-1">branch_id</code> pada profil Anda di Supabase.
            </div>
          )}
          {activeMenu === "dashboard" && (
            <>
              <PageTitle title="Dashboard" subtitle="Ringkasan premi, solar, sopir, dan paket pekerjaan" />
              <DashboardPeriodFilter period={dashboardPeriod} setPeriod={setDashboardPeriod} />
              <PeriodSummaryCards summary={periodComparison} />
              {filteredTransactions.length === 0 ? (
                <Warning text="Belum ada data transaksi pada filter aktif." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Total Solar per Kendaraan">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartSolarKendaraan}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                        <Bar dataKey="totalSolar" fill="#0f766e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Ritase per Sopir">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartSopir}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="ritase" fill="#0ea5a4" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Biaya Harian">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartHarian}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="tanggal" />
                        <YAxis />
                        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                        <Line type="monotone" dataKey="biaya" stroke="#0f766e" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Komposisi Biaya Upah vs Solar">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={chartKomposisi} dataKey="value" nameKey="name" outerRadius={90}>
                          {chartKomposisi.map((item, idx) => (
                            <Cell key={item.name} fill={idx === 0 ? "#0f766e" : "#0ea5a4"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </>
          )}

          {activeMenu === "cabang" && cloud && (profile?.role === "ADMIN_PUSAT" || profile?.role === "ID_MASTER") && (
            <>
              <PageTitle title="Master Cabang" subtitle="Tambah, lihat, dan hapus cabang (Admin Pusat)" />
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <form onSubmit={submitBranchAdmin} className="mb-6 grid gap-3 md:grid-cols-3">
                  <Field label="Nama cabang">
                    <input
                      className="input h-11"
                      value={branchAdminForm.name}
                      onChange={(e) => setBranchAdminForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Kode (opsional)">
                    <input
                      className="input h-11"
                      value={branchAdminForm.code}
                      onChange={(e) => setBranchAdminForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button type="submit" className="btn-primary h-11 px-4">
                      Tambah cabang
                    </button>
                  </div>
                </form>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Nama</th>
                        <th className="px-3 py-2 text-left">Kode</th>
                        <th className="px-3 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBranches.map((b) => (
                        <tr key={b.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-900">{b.name}</td>
                          <td className="px-3 py-2 text-slate-700">{b.code ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-rose-600 hover:underline"
                              onClick={() => void handleDeleteBranch(b.id)}
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeMenu === "personil" && (
            <>
              <PageTitle title="Aset Personil" subtitle="Kelola data sopir aktif/nonaktif" />
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {personilSubmitError && (
                  <div
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                    role="alert"
                    aria-live="polite"
                  >
                    <p className="font-semibold text-rose-950">Data ditolak</p>
                    <p className="mt-1 text-xs leading-relaxed text-rose-800">{personilSubmitError}</p>
                  </div>
                )}
                <form onSubmit={submitPersonil} className="grid gap-3 md:grid-cols-4">
                  <Field label="Nama Sopir">
                    <input
                      className="input h-11"
                      value={personilForm.namaSopir}
                      onChange={(e) => {
                        setPersonilSubmitError("");
                        setPersonilForm((f) => ({ ...f, namaSopir: e.target.value }));
                      }}
                    />
                  </Field>
                  <Field label="Status Sopir">
                    <select className="input h-11" value={personilForm.statusSopir} onChange={(e) => setPersonilForm((f) => ({ ...f, statusSopir: e.target.value as StatusSopir }))}>
                      <option value="SOPIR HARIAN">SOPIR HARIAN</option>
                      <option value="SOPIR PREMI">SOPIR PREMI</option>
                    </select>
                  </Field>
                  <Field label="Status Aktif">
                    <select className="input h-11" value={personilForm.statusAktif} onChange={(e) => setPersonilForm((f) => ({ ...f, statusAktif: e.target.value as StatusAktif }))}>
                      <option value="AKTIF">AKTIF</option>
                      <option value="NONAKTIF">NONAKTIF</option>
                    </select>
                  </Field>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="btn-primary h-11 px-4">Simpan Personil</button>
                    <button
                      type="button"
                      className="btn-secondary h-11 px-4"
                      onClick={() => {
                        setPersonilSubmitError("");
                        setPersonilForm(defaultPersonilForm);
                        setEditPersonilId(null);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
              <PersonilTable
                rows={personil}
                onEdit={(row) => {
                  setPersonilSubmitError("");
                  setEditPersonilId(row.id);
                  setPersonilForm({ namaSopir: row.namaSopir, statusSopir: row.statusSopir, statusAktif: row.statusAktif });
                }}
                onDelete={(id) => savePersonilState(personil.filter((p) => p.id !== id))}
              />
            </>
          )}

          {activeMenu === "kendaraan" && (
            <>
              <PageTitle title="Aset Kendaraan" subtitle="Kelola armada aktif/nonaktif" />
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {kendaraanSubmitError && (
                  <div
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                    role="alert"
                    aria-live="polite"
                  >
                    <p className="font-semibold text-rose-950">Data ditolak</p>
                    <p className="mt-1 text-xs leading-relaxed text-rose-800">{kendaraanSubmitError}</p>
                  </div>
                )}
                <form onSubmit={submitKendaraan} className="grid gap-3 md:grid-cols-4">
                  <Field label="Jenis Kendaraan">
                    <select className="input h-11" value={kendaraanForm.jenisKendaraan} onChange={(e) => setKendaraanForm((f) => ({ ...f, jenisKendaraan: e.target.value as Kendaraan["jenisKendaraan"] }))}>
                      {DEFAULT_VEHICLE_RULES.map((r) => <option key={r.id} value={r.nama}>{r.nama}</option>)}
                    </select>
                  </Field>
                  <Field label="Plat Nomor">
                    <input
                      className="input h-11"
                      value={kendaraanForm.platNomor}
                      onChange={(e) => {
                        setKendaraanSubmitError("");
                        setKendaraanForm((f) => ({ ...f, platNomor: e.target.value }));
                      }}
                    />
                  </Field>
                  <Field label="Status Aktif">
                    <select className="input h-11" value={kendaraanForm.statusAktif} onChange={(e) => setKendaraanForm((f) => ({ ...f, statusAktif: e.target.value as StatusAktif }))}>
                      <option value="AKTIF">AKTIF</option>
                      <option value="NONAKTIF">NONAKTIF</option>
                    </select>
                  </Field>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="btn-primary h-11 px-4">Simpan Kendaraan</button>
                    <button
                      type="button"
                      className="btn-secondary h-11 px-4"
                      onClick={() => {
                        setKendaraanSubmitError("");
                        setKendaraanForm(defaultKendaraanForm);
                        setEditKendaraanId(null);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
              <KendaraanTable
                rows={kendaraan}
                onEdit={(row) => {
                  setKendaraanSubmitError("");
                  setEditKendaraanId(row.id);
                  setKendaraanForm({ jenisKendaraan: row.jenisKendaraan, platNomor: row.platNomor, statusAktif: row.statusAktif });
                }}
                onDelete={(id) => saveKendaraanState(kendaraan.filter((k) => k.id !== id))}
              />
            </>
          )}

          {activeMenu === "inputRitase" && (
            <>
              <PageTitle title="Input Ritase" subtitle="Input data ritase baru" />
              {(activePersonil.length === 0 || activeKendaraan.length === 0) && (
                <Warning text="Isi data Aset Personil dan Aset Kendaraan terlebih dahulu." />
              )}
              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold">Data Ritase</h3>
                  <form onSubmit={submitRitase} className="grid gap-3 md:grid-cols-2">
                    <Field label="Tanggal"><input type="date" className="input h-11" value={ritaseForm.tanggal} onChange={(e) => setRitaseForm((f) => ({ ...f, tanggal: e.target.value }))} /></Field>
                    <Field label="Sopir">
                      <select className="input h-11" value={selectedPersonilId} onChange={(e) => {
                        const p = personil.find((x) => x.id === e.target.value);
                        setSelectedPersonilId(e.target.value);
                        if (p) setRitaseForm((f) => ({ ...f, namaSopir: p.namaSopir, statusSopir: p.statusSopir }));
                      }}>
                        <option value="">Pilih sopir</option>
                        {activePersonil.map((p) => <option key={p.id} value={p.id}>{p.namaSopir} - {p.statusSopir}</option>)}
                      </select>
                    </Field>
                    <Field label="Kendaraan">
                      <select className="input h-11" value={selectedKendaraanId} onChange={(e) => {
                        const k = kendaraan.find((x) => x.id === e.target.value);
                        setSelectedKendaraanId(e.target.value);
                        if (k) setRitaseForm((f) => ({ ...f, jenisKendaraan: k.jenisKendaraan, platNomor: k.platNomor }));
                      }}>
                        <option value="">Pilih kendaraan</option>
                        {activeKendaraan.map((k) => <option key={k.id} value={k.id}>{k.platNomor} - {k.jenisKendaraan}</option>)}
                      </select>
                    </Field>
                    <Field label="Nama Paket Pekerjaan"><input className="input h-11" value={ritaseForm.namaPaketPekerjaan} onChange={(e) => setRitaseForm((f) => ({ ...f, namaPaketPekerjaan: e.target.value }))} /></Field>
                    <Field label="Lokasi Ambil"><input className="input h-11" value={ritaseForm.lokasiAmbil} onChange={(e) => setRitaseForm((f) => ({ ...f, lokasiAmbil: e.target.value }))} /></Field>
                    <Field label="Lokasi Kirim"><input className="input h-11" value={ritaseForm.lokasiKirim} onChange={(e) => setRitaseForm((f) => ({ ...f, lokasiKirim: e.target.value }))} /></Field>
                    <Field label="Jam berangkat"><input type="time" className="input h-11" value={ritaseForm.jamAmbil} onChange={(e) => setRitaseForm((f) => ({ ...f, jamAmbil: e.target.value }))} /></Field>
                    <Field label="Jam tiba"><input type="time" className="input h-11" value={ritaseForm.jamKirim} onChange={(e) => setRitaseForm((f) => ({ ...f, jamKirim: e.target.value }))} /></Field>
                    <Field label="Jarak Kilometer"><input type="number" className="input h-11" value={ritaseForm.jarakKm} onChange={(e) => setRitaseForm((f) => ({ ...f, jarakKm: Number(e.target.value) || 0 }))} /></Field>
                    <Field label="Jenis Medan">
                      <select className="input h-11" value={ritaseForm.jenisMedan} onChange={(e) => setRitaseForm((f) => ({ ...f, jenisMedan: e.target.value as SimpleTripInput["jenisMedan"] }))}>
                        <option value="MUDAH">MUDAH</option>
                        <option value="BERAT">BERAT</option>
                      </select>
                    </Field>
                    <Field label="Kategori Muatan">
                      <select
                        className="input h-11"
                        value={ritaseForm.kategoriMuatan}
                        onChange={(e) =>
                          setRitaseForm((f) => ({
                            ...f,
                            kategoriMuatan: e.target.value as KategoriMuatan,
                            ...(e.target.value === "UTAMA"
                              ? { muatanKembaliJenis: "KOSONG" as const, muatanKembaliUraian: "" }
                              : {}),
                          }))
                        }
                      >
                        <option value="UTAMA">Muatan Utama</option>
                        <option value="BALIK">Muatan Kembali</option>
                      </select>
                    </Field>
                    {ritaseForm.kategoriMuatan === "UTAMA" && (
                      <Field label="Muatan">
                        <select
                          className="input h-11"
                          value={ritaseForm.jenisMuatan}
                          onChange={(e) =>
                            setRitaseForm((f) => ({
                              ...f,
                              jenisMuatan: e.target.value as JenisMuatan,
                            }))
                          }
                        >
                          <option value="ASPAL">Aspal</option>
                          <option value="NON ASPAL">Non Aspal</option>
                        </select>
                      </Field>
                    )}
                    {ritaseForm.kategoriMuatan === "BALIK" && (
                      <Field label="Muatan kembali">
                        <select
                          className="input h-11"
                          value={ritaseForm.muatanKembaliJenis}
                          onChange={(e) =>
                            setRitaseForm((f) => ({
                              ...f,
                              muatanKembaliJenis: e.target.value as MuatanKembaliJenis,
                              ...(e.target.value === "KOSONG" ? { muatanKembaliUraian: "" } : {}),
                            }))
                          }
                        >
                          <option value="BERMUATAN">Bermuatan</option>
                          <option value="KOSONG">Kosong</option>
                        </select>
                      </Field>
                    )}
                    {ritaseForm.kategoriMuatan === "BALIK" &&
                      ritaseForm.muatanKembaliJenis === "BERMUATAN" && (
                        <label className="text-xs font-medium text-slate-600 md:col-span-2">
                          <span className="mb-1 block">Muatan yang dibawa</span>
                          <input
                            className="input h-11 w-full"
                            placeholder="Contoh: sisa material, peralatan, dll."
                            value={ritaseForm.muatanKembaliUraian ?? ""}
                            onChange={(e) =>
                              setRitaseForm((f) => ({ ...f, muatanKembaliUraian: e.target.value }))
                            }
                          />
                        </label>
                      )}
                    <label className="text-xs font-medium text-slate-600 md:col-span-2">
                      <span className="mb-1 block">Keterangan</span>
                      <textarea
                        className="input min-h-[100px] w-full resize-y rounded-lg py-3"
                        placeholder="Contoh: Angkut aspal hotmix / keperluan proyek / antar material..."
                        value={ritaseForm.keterangan ?? ""}
                        onChange={(e) => setRitaseForm((f) => ({ ...f, keterangan: e.target.value }))}
                        rows={4}
                      />
                    </label>
                    {muatanKembaliTanpaUraian && (
                      <div
                        className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                        role="alert"
                        aria-live="polite"
                      >
                        <p className="font-semibold text-rose-950">Ritase ditolak — muatan kembali bermuatan</p>
                        <p className="mt-1 text-xs leading-relaxed text-rose-800">
                          Isi kolom &quot;Muatan yang dibawa&quot; untuk perjalanan muatan kembali bermuatan.
                        </p>
                      </div>
                    )}
                    {jamTibaSebelumBerangkat && (
                      <div
                        className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                        role="alert"
                        aria-live="polite"
                      >
                        <p className="font-semibold text-rose-950">Ritase ditolak — jam tiba tidak valid</p>
                        <p className="mt-1 text-xs leading-relaxed text-rose-800">
                          Jam tiba tidak boleh lebih awal daripada jam berangkat pada hari yang sama (contoh: berangkat 08:00, tiba 07:00).
                          Sesuaikan jam tiba agar sama atau setelah jam berangkat.
                        </p>
                      </div>
                    )}
                    {platJadwalConflict && (
                      <div
                        className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                        role="alert"
                        aria-live="polite"
                      >
                        <p className="font-semibold text-rose-950">Ritase ditolak — jadwal plat bentrok</p>
                        <p className="mt-1 text-xs leading-relaxed text-rose-800">
                          Plat <span className="font-medium">{ritaseForm.platNomor}</span>{" "}
                          pada tanggal yang sama sudah terdaftar {platJadwalConflict.jamAmbil}–{platJadwalConflict.jamKirim}{" "}
                          (rute {platJadwalConflict.lokasiAmbil || "–"} → {platJadwalConflict.lokasiKirim || "–"}). Rentang jam
                          berangkat–tiba baru bertumpang tindih sehingga truk tidak bisa dipakai untuk lokasi lain bersamaan. Ubah jam
                          atau tanggal, atau perbaiki data ritase yang ada.
                        </p>
                      </div>
                    )}
                    {sopirBedaPlatJadwalConflict && (
                      <div
                        className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900"
                        role="alert"
                        aria-live="polite"
                      >
                        <p className="font-semibold text-rose-950">Ritase ditolak — sopir bentrok (kendaraan berbeda)</p>
                        <p className="mt-1 text-xs leading-relaxed text-rose-800">
                          Sopir yang sama tidak boleh punya jadwal tumpang tindih pada jam yang sama dengan plat kendaraan yang berbeda.
                          Sudah ada ritase <span className="font-medium">{sopirBedaPlatJadwalConflict.jenisKendaraan}</span> plat{" "}
                          <span className="font-medium">{sopirBedaPlatJadwalConflict.platNomor}</span>{" "}
                          {sopirBedaPlatJadwalConflict.jamAmbil}–{sopirBedaPlatJadwalConflict.jamKirim}, rute{" "}
                          {sopirBedaPlatJadwalConflict.lokasiAmbil || "–"} → {sopirBedaPlatJadwalConflict.lokasiKirim || "–"}. Ubah jam
                          atau plat, atau perbaiki data lama.
                        </p>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        className="btn-primary h-11 px-5"
                        disabled={!selectedPersonilId || !selectedKendaraanId || ritaseSubmitBlocked}
                      >
                        Simpan Ritase
                      </button>
                    </div>
                  </form>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
                    onClick={() => setHasilPerhitunganOpen((o) => !o)}
                    aria-expanded={hasilPerhitunganOpen}
                    aria-controls="hasil-perhitungan-panel"
                    id="hasil-perhitungan-toggle"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-slate-900">Hasil Perhitungan</span>
                      {!hasilPerhitunganOpen && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Total biaya ritase: <span className="font-medium text-slate-700">{formatRupiah(previewCalc.totalBiaya)}</span>
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${hasilPerhitunganOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {hasilPerhitunganOpen && (
                    <div id="hasil-perhitungan-panel" className="border-t border-slate-100 px-4 pb-4 pt-1" role="region" aria-labelledby="hasil-perhitungan-toggle">
                  <ResultItem label="Status Sopir" value={ritaseForm.statusSopir} />
                  <ResultItem label="Kategori muatan" value={labelKategoriMuatan(ritaseForm.kategoriMuatan)} />
                  {ritaseForm.kategoriMuatan === "BALIK" && (
                    <ResultItem label="Muatan kembali" value={labelMuatanKembali(ritaseForm.muatanKembaliJenis)} />
                  )}
                  {ritaseForm.kategoriMuatan === "BALIK" &&
                    ritaseForm.muatanKembaliJenis === "BERMUATAN" &&
                    !!ritaseForm.muatanKembaliUraian?.trim() && (
                      <ResultItem label="Muatan yang dibawa" value={ritaseForm.muatanKembaliUraian.trim()} />
                    )}
                  <ResultItem label="Driver Type" value={previewCalc.driverTypeLabel} />
                  {!previewCalc.isPremiDriver && (
                    <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      Sopir harian tidak mendapat upah ritase per KM dan upah pokok.
                    </p>
                  )}
                  <ResultItem label="Jarak Input" value={`${previewCalc.jarakInput} km`} />
                  <ResultItem label="Jarak Dihitung Maks 65 km" value={`${previewCalc.jarakHitungUpah} km`} />
                  <ResultItem label="Upah Ritase per KM" value={formatRupiah(previewCalc.premiUpahPerKm)} />
                  {ritaseForm.kategoriMuatan === "UTAMA" && (
                    <ResultItem label="Muatan" value={labelJenisMuatan(ritaseForm.jenisMuatan)} />
                  )}
                  {previewCalc.isPremiDriver && previewCalc.appliedPersentaseKembali != null && (
                    <>
                      <ResultItem
                        label="Referensi upah (seperti muatan utama)"
                        value={formatRupiah(previewCalc.upahUtamaReferensi)}
                      />
                      <ResultItem
                        label="Persentase muatan kembali bermuatan"
                        value={`${previewCalc.appliedPersentaseKembali}%`}
                      />
                    </>
                  )}
                  <ResultItem
                    label="Tambahan upah ritase (muatan)"
                    value={formatRupiah(previewCalc.tambahanUpahMuatan)}
                  />
                  <ResultItem label="Upah Ritase" value={formatRupiah(previewCalc.upahRitase)} />
                  <ResultItem label="Upah Pokok Sopir Premi" value={formatRupiah(previewCalc.premiBasePaySetting)} />
                  <ResultItem label="Upah Pokok Hari Ini" value={formatRupiah(previewCalc.upahPokok)} />
                  <ResultItem label="Total Upah Sopir" value={formatRupiah(previewCalc.totalUpahSopir)} />
                  <ResultItem label="Harga Solar per Liter" value={formatRupiah(previewCalc.solarPricePerLiter)} />
                  <ResultItem label="Rasio Kendaraan" value={`1 liter : ${previewCalc.kmPerLiter} km`} />
                  <ResultItem label="Liter per KM" value={`${previewCalc.literPerKm.toFixed(4)} liter`} />
                  <ResultItem label="Solar per KM" value={formatRupiah(previewCalc.solarPerKm)} />
                  <ResultItem label="Total Liter Solar" value={`${previewCalc.totalLiterSolar} liter`} />
                  <ResultItem label="Total Biaya Solar" value={formatRupiah(previewCalc.totalSolar)} />
                  <ResultItem label="Total Biaya Ritase" value={formatRupiah(previewCalc.totalBiaya)} />
                  {previewCalc.isPremiDriver &&
                    ritaseForm.kategoriMuatan === "BALIK" &&
                    ritaseForm.muatanKembaliJenis === "KOSONG" && (
                      <p className="mt-2 rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
                        Muatan kembali kosong: dihitung biaya solar saja, tanpa upah ritase dan tanpa upah pokok.
                      </p>
                    )}
                  <p className="mt-2 text-xs text-slate-500">
                    Upah pokok hanya diberikan 1x per hari per sopir (muatan utama), tanpa memandang kendaraan yang dipakai.
                  </p>
                    </div>
                  )}
                </section>
              </div>
              <TransactionsTable
                rows={ritaseHistoryTransactions}
                onDetail={setDetail}
                onDelete={(id) => saveTransactionsState(transactions.filter((t) => t.id !== id))}
              />
              {detail && <TransactionDetail row={detail} onClose={() => setDetail(null)} />}
            </>
          )}

          {activeMenu === "rekap" && (
            <>
              <div className="hidden print:block print:mb-4 print:border-b print:border-slate-300 print:pb-4">
                <div className="flex items-center gap-3">
                  <TripleSBrandMark className="h-11 w-11 shrink-0 print:h-[52px] print:w-[52px]" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase leading-tight tracking-widest text-slate-500 sm:text-[11px]">
                      TRIPLE S INDOSEDULUR Â· Construction
                    </p>
                  </div>
                </div>
                <h1 className="mt-3 text-xl font-bold text-slate-900">Laporan Rekap</h1>
                <p className="mt-2 text-sm font-semibold text-slate-800">{REKAP_TAB_LABEL[rekapTab]}</p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Periode: </span>
                  {formatRekapPeriode(rekapDateFilter.tanggalMulai, rekapDateFilter.tanggalAkhir)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Jumlah ritase dalam periode: <span className="font-semibold tabular-nums">{rekapGrandTotals.totalRitase}</span>
                </p>
                <p className="mt-3 text-[10px] text-slate-500">
                  Dicetak:{" "}
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date())}
                </p>
              </div>

              <div className="print:hidden">
                <PageTitle title="Rekap" subtitle="Rekap nama, upah, solar, dan biaya total" />
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Tanggal mulai">
                      <input
                        type="date"
                        className="input h-11"
                        value={rekapDateFilter.tanggalMulai}
                        onChange={(e) =>
                          setRekapDateFilter((f) => ({ ...f, tanggalMulai: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Tanggal akhir">
                      <input
                        type="date"
                        className="input h-11"
                        value={rekapDateFilter.tanggalAkhir}
                        onChange={(e) =>
                          setRekapDateFilter((f) => ({ ...f, tanggalAkhir: e.target.value }))
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
                      <button
                        type="button"
                        className="btn-secondary h-11 px-3"
                        onClick={() =>
                          setRekapDateFilter({ tanggalMulai: "", tanggalAkhir: "" })
                        }
                      >
                        Reset Tanggal
                      </button>
                      {profile?.role === "ADMIN_CABANG" ? (
                        <span className="text-xs text-slate-400 self-center">Tidak ada akses print</span>
                      ) : (profile?.role === "ADMIN_PUSAT" && canPrint) || profile?.role === "ID_MASTER" ? (
                        <button
                          type="button"
                          className="btn-primary inline-flex h-11 items-center gap-2 px-4"
                          onClick={() => window.print()}
                        >
                          <Printer className="h-4 w-4" aria-hidden />
                          Print
                        </button>
                      ) : profile?.role === "ADMIN_PUSAT" ? (
                        <span className="text-xs text-amber-600 self-center">Print terkunci — ajukan otorisasi</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-800 print:hidden">
                  <span className="font-semibold text-slate-900">Ringkasan periode: </span>
                  {formatRekapPeriode(rekapDateFilter.tanggalMulai, rekapDateFilter.tanggalAkhir)}
                </div>
              </section>              {/* Banner status otorisasi */}
              {profile?.role === "ADMIN_PUSAT" && pengajuanStatus && (
                <div className={`rounded-xl border p-4 mb-2 flex items-center justify-between flex-wrap gap-3 ${pengajuanStatus === "DISETUJUI" ? "bg-green-50 border-green-200" : pengajuanStatus === "DITOLAK" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                  <div className="text-sm font-semibold">
                    Status: {pengajuanStatus === "DISETUJUI" ? "Disetujui" : pengajuanStatus === "DITOLAK" ? "Ditolak" : "Menunggu Otorisasi"}
                  </div>
                </div>
              )}
              {profile?.role === "ADMIN_PUSAT" && !pengajuanStatus && rekapSopir.length > 0 && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-2 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-sm font-semibold text-yellow-800">Verifikasi sebelum pengajuan</div>
                    <div className="text-xs text-yellow-700 mt-1">Ceklis semua baris ({Object.values(ceklisSopir).filter(Boolean).length}/{rekapSopir.length} diceklis){semuaSopirDiceklis && " Semua terverifikasi"}</div>
                  </div>
                  <button onClick={handleAjukanOtorisasi} disabled={!semuaSopirDiceklis || loadingPengajuan} className={`h-10 px-5 rounded-lg text-sm font-semibold text-white ${semuaSopirDiceklis ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 cursor-not-allowed"}`}>{loadingPengajuan ? "Mengirim..." : "Pengajuan Otorisasi"}</button>
                </div>
              )}
              {profile?.role === "ID_MASTER" && pengajuanId && pengajuanStatus === "PENDING" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-2 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm font-semibold text-blue-800">Ada pengajuan otorisasi menunggu persetujuan</div>
                  <button onClick={() => setShowOtorisasiModal(true)} className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">Proses Otorisasi</button>
                </div>
              )}


              <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
                <Field label="Jenis Rekap">
                  <select
                    className="input h-11 max-w-sm"
                    value={rekapTab}
                    onChange={(e) => setRekapTab(e.target.value as RekapTab)}
                  >
                    <option value="sopir">Rekap Sopir</option>
                    <option value="paket">Rekap Paket</option>
                    <option value="kendaraan">Rekap Kendaraan</option>
                    <option value="rute">Rekap Rute</option>
                  </select>
                </Field>
              </section>

              <p className="hidden print:block text-sm font-medium text-slate-800">
                {REKAP_TAB_LABEL[rekapTab]}
              </p>

              {rekapTab === "sopir" && (
                <>
                  {profile?.role === "ADMIN_PUSAT" && !pengajuanStatus && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm mb-2">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-center w-10">Cek</th>
                            <th className="px-3 py-2 text-left">Nama Sopir</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Ritase</th>
                            <th className="px-3 py-2 text-right">KM</th>
                            <th className="px-3 py-2 text-right">Upah Ritase</th>
                            <th className="px-3 py-2 text-right">Upah Pokok</th>
                            <th className="px-3 py-2 text-right">Upah Sopir</th>
                            <th className="px-3 py-2 text-right">Solar</th>
                            <th className="px-3 py-2 text-right">Total Biaya</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rekapSopir.map((r, idx) => (
                            <tr key={idx} className={`border-t border-slate-100 ${ceklisSopir[r.namaSopir] ? "bg-green-50" : ""}`}>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" checked={!!ceklisSopir[r.namaSopir]} onChange={() => setCeklisSopir(prev => ({ ...prev, [r.namaSopir]: !prev[r.namaSopir] }))} className="w-4 h-4 cursor-pointer accent-green-600" />
                              </td>
                              <td className="px-3 py-2">{r.namaSopir}</td>
                              <td className="px-3 py-2">{r.statusSopir}</td>
                              <td className="px-3 py-2 text-right">{r.totalRitase}</td>
                              <td className="px-3 py-2 text-right">{r.totalKm}</td>
                              <td className="px-3 py-2 text-right">{formatRupiah(r.totalUpahRitase)}</td>
                              <td className="px-3 py-2 text-right">{formatRupiah(r.totalUpahPokok)}</td>
                              <td className="px-3 py-2 text-right">{formatRupiah(r.totalUpahSopir)}</td>
                              <td className="px-3 py-2 text-right">{formatRupiah(r.totalSolar)}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatRupiah(r.totalBiaya)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                            <td /><td className="px-3 py-2">Jumlah</td><td />
                            <td className="px-3 py-2 text-right">{rekapGrandTotals.totalRitase}</td>
                            <td className="px-3 py-2 text-right">{rekapGrandTotals.totalKm}</td>
                            <td className="px-3 py-2 text-right">{formatRupiah(rekapGrandTotals.totalUpahRitase)}</td>
                            <td className="px-3 py-2 text-right">{formatRupiah(rekapGrandTotals.totalUpahPokok)}</td>
                            <td className="px-3 py-2 text-right">{formatRupiah(rekapGrandTotals.totalUpahSopir)}</td>
                            <td className="px-3 py-2 text-right">{formatRupiah(rekapGrandTotals.totalSolar)}</td>
                            <td className="px-3 py-2 text-right">{formatRupiah(rekapGrandTotals.totalBiaya)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(profile?.role !== "ADMIN_PUSAT" || pengajuanStatus) && (
                    <RekapTable
                      headers={["Nama Sopir", "Status Sopir", "Total Ritase", "Total KM", "Total Upah Ritase", "Total Upah Pokok", "Total Upah Sopir", "Total Solar", "Total Biaya"]}
                      numericMinCol={2}
                      rows={rekapSopir.map((r) => [r.namaSopir, r.statusSopir, r.totalRitase, r.totalKm, formatRupiah(r.totalUpahRitase), formatRupiah(r.totalUpahPokok), formatRupiah(r.totalUpahSopir), formatRupiah(r.totalSolar), formatRupiah(r.totalBiaya)])}
                      footerRow={[
                        "Jumlah",
                        "",
                        rekapGrandTotals.totalRitase,
                        rekapGrandTotals.totalKm,
                        formatRupiah(rekapGrandTotals.totalUpahRitase),
                        formatRupiah(rekapGrandTotals.totalUpahPokok),
                        formatRupiah(rekapGrandTotals.totalUpahSopir),
                        formatRupiah(rekapGrandTotals.totalSolar),
                        formatRupiah(rekapGrandTotals.totalBiaya),
                      ]}
                      onRowClick={(idx) => {
                        const row = rekapSopir[idx];
                        setDetailTitle(`Detail Sopir: ${row.namaSopir}`);
                        setDetailList(rekapFilteredTransactions.filter((t) => t.namaSopir === row.namaSopir && t.statusSopir === row.statusSopir));
                      }}
                    />
                  )}
                </>
              )}
              {rekapTab === "paket" && (
                <RekapTable
                  headers={["Nama Paket Pekerjaan", "Total Ritase", "Total KM", "Total Upah Ritase", "Total Upah Pokok", "Total Upah Sopir", "Total Solar", "Total Biaya"]}
                  numericMinCol={1}
                  rows={rekapPaket.map((r) => [r.a, r.totalRitase, r.totalKm, formatRupiah(r.totalUpahRitase), formatRupiah(r.totalUpahPokok), formatRupiah(r.totalUpahSopir), formatRupiah(r.totalSolar), formatRupiah(r.totalBiaya)])}
                  footerRow={[
                    "Jumlah",
                    rekapGrandTotals.totalRitase,
                    rekapGrandTotals.totalKm,
                    formatRupiah(rekapGrandTotals.totalUpahRitase),
                    formatRupiah(rekapGrandTotals.totalUpahPokok),
                    formatRupiah(rekapGrandTotals.totalUpahSopir),
                    formatRupiah(rekapGrandTotals.totalSolar),
                    formatRupiah(rekapGrandTotals.totalBiaya),
                  ]}
                  onRowClick={(idx) => {
                    const row = rekapPaket[idx];
                    setDetailTitle(`Detail Paket: ${row.a}`);
                    setDetailList(rekapFilteredTransactions.filter((t) => (t.namaPaketPekerjaan || "(kosong)") === row.a));
                  }}
                />
              )}
              {rekapTab === "kendaraan" && (
                <RekapTable
                  headers={["Jenis Kendaraan", "Plat Nomor", "Total Ritase", "Total KM", "Total Upah Ritase", "Total Upah Pokok", "Total Upah Sopir", "Total Solar", "Total Biaya"]}
                  numericMinCol={2}
                  rows={rekapKendaraan.map((r) => [r.a, r.b, r.totalRitase, r.totalKm, formatRupiah(r.totalUpahRitase), formatRupiah(r.totalUpahPokok), formatRupiah(r.totalUpahSopir), formatRupiah(r.totalSolar), formatRupiah(r.totalBiaya)])}
                  footerRow={[
                    "Jumlah",
                    "",
                    rekapGrandTotals.totalRitase,
                    rekapGrandTotals.totalKm,
                    formatRupiah(rekapGrandTotals.totalUpahRitase),
                    formatRupiah(rekapGrandTotals.totalUpahPokok),
                    formatRupiah(rekapGrandTotals.totalUpahSopir),
                    formatRupiah(rekapGrandTotals.totalSolar),
                    formatRupiah(rekapGrandTotals.totalBiaya),
                  ]}
                  onRowClick={(idx) => {
                    const row = rekapKendaraan[idx];
                    setDetailTitle(`Detail Kendaraan: ${row.a} - ${row.b}`);
                    setDetailList(rekapFilteredTransactions.filter((t) => t.jenisKendaraan === row.a && t.platNomor === row.b));
                  }}
                />
              )}
              {rekapTab === "rute" && (
                <RekapTable
                  headers={["Lokasi Ambil", "Lokasi Kirim", "Total Ritase", "Total KM", "Total Upah Ritase", "Total Upah Pokok", "Total Upah Sopir", "Total Solar", "Total Biaya"]}
                  numericMinCol={2}
                  rows={rekapRute.map((r) => [r.a, r.b, r.totalRitase, r.totalKm, formatRupiah(r.totalUpahRitase), formatRupiah(r.totalUpahPokok), formatRupiah(r.totalUpahSopir), formatRupiah(r.totalSolar), formatRupiah(r.totalBiaya)])}
                  footerRow={[
                    "Jumlah",
                    "",
                    rekapGrandTotals.totalRitase,
                    rekapGrandTotals.totalKm,
                    formatRupiah(rekapGrandTotals.totalUpahRitase),
                    formatRupiah(rekapGrandTotals.totalUpahPokok),
                    formatRupiah(rekapGrandTotals.totalUpahSopir),
                    formatRupiah(rekapGrandTotals.totalSolar),
                    formatRupiah(rekapGrandTotals.totalBiaya),
                  ]}
                  onRowClick={(idx) => {
                    const row = rekapRute[idx];
                    setDetailTitle(`Detail Rute: ${row.a} - ${row.b}`);
                    setDetailList(rekapFilteredTransactions.filter((t) => t.lokasiAmbil === row.a && t.lokasiKirim === row.b));
                  }}
                />
              )}
              <div className="print:hidden">
                <DetailList title={detailTitle} rows={detailList} />
              </div>
            </>
          )}

          {activeMenu === "settings" && (
            <>
              <PageTitle title="Settings" subtitle="Pengaturan aplikasi" />
              {cloud && profile?.role === "ADMIN_PUSAT" && (
                <section className="max-w-2xl rounded-xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Migrasi dari localStorage</h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Pindahkan data lama peramban (personil, kendaraan, transaksi, pengaturan) ke cloud untuk cabang
                    yang dipilih.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs font-medium text-slate-600">
                      <span className="mb-1 block">Cabang tujuan migrasi</span>
                      <select
                        className="input h-11 max-w-xs"
                        value={pusatWriteBranchId}
                        onChange={(e) => setPusatWriteBranchId(e.target.value)}
                      >
                        <option value="">— pilih cabang —</option>
                        {allBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={migrating || !pusatWriteBranchId}
                      className="btn-primary h-11 px-4 disabled:opacity-50"
                      onClick={() => {
                        if (!pusatWriteBranchId) return;
                        setMigrating(true);
                        setMigrateMsg(null);
                        setMigrateErr(null);
                        void migrateLocalStorageToSupabase(pusatWriteBranchId)
                          .then((r) => {
                            if (r.ok) setMigrateMsg(r.message);
                            else setMigrateErr(r.message);
                          })
                          .catch((e) => setMigrateErr(e instanceof Error ? e.message : String(e)))
                          .finally(() => setMigrating(false));
                      }}
                    >
                      {migrating ? "Memigrasi…" : "Migrasi sekarang"}
                    </button>
                  </div>
                  {migrateMsg && <p className="mt-2 text-sm text-teal-900">{migrateMsg}</p>}
                  {migrateErr && (
                    <p className="mt-2 text-sm text-rose-800" role="alert">
                      {migrateErr}
                    </p>
                  )}
                </section>
              )}
              <section className="space-y-4">
                <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Pengaturan Solar</h3>
                  <div className="mt-4 space-y-3">
                    <Field label="Harga Solar per Liter">
                      <input
                        type="number"
                        min={1000}
                        max={50000}
                        className="input h-12"
                        value={settingsDraft}
                        onChange={(e) => {
                          setSettingsDraft(e.target.value);
                          setSettingsError("");
                        }}
                      />
                    </Field>
                    <p className="text-sm text-slate-700">
                      Nilai saat ini: <b>{formatRupiah(appSettings.solarPricePerLiter)}</b>
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSaveSettings} className="btn-primary h-11 px-4">
                        Simpan Pengaturan
                      </button>
                      <button type="button" onClick={handleResetSettings} className="btn-secondary h-11 px-4">
                        Reset Default Solar
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Perubahan harga solar hanya mempengaruhi transaksi baru.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Upah Pokok Sopir Premi</h3>
                  <div className="mt-3 max-w-sm">
                    <Field label="Upah Pokok Global">
                      <input
                        type="number"
                        min={0}
                        className="input h-11"
                        value={premiBasePayDraft}
                        onChange={(e) => {
                          setPremiBasePayDraft(e.target.value);
                          setSettingsError("");
                        }}
                      />
                    </Field>
                  </div>
                </div>

                <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Tambahan upah ritase (muatan)</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Ditambahkan ke upah ritase untuk sopir premi sesuai pilihan muatan di input ritase.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Muatan Aspal (Rp)">
                      <input
                        type="number"
                        min={0}
                        className="input h-11"
                        value={muatanAspalDraft}
                        onChange={(e) => {
                          setMuatanAspalDraft(e.target.value);
                          setSettingsError("");
                        }}
                      />
                    </Field>
                    <Field label="Muatan Non Aspal (Rp)">
                      <input
                        type="number"
                        min={0}
                        className="input h-11"
                        value={muatanNonAspalDraft}
                        onChange={(e) => {
                          setMuatanNonAspalDraft(e.target.value);
                          setSettingsError("");
                        }}
                      />
                    </Field>
                  </div>
                  <div className="mt-4 max-w-xs">
                    <Field label="Muatan kembali bermuatan — persentase dari upah utama (%)">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input h-11"
                        value={persentaseKembaliDraft}
                        onChange={(e) => {
                          setPersentaseKembaliDraft(e.target.value);
                          setSettingsError("");
                        }}
                      />
                    </Field>
                    <p className="mt-1 text-xs text-slate-500">
                      Nilai 30 berarti 30% dari upah ritase seolah muatan utama (upah KM + tambahan Aspal/Non Aspal).
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">Pengaturan Tarif Kendaraan</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Jenis Kendaraan</th>
                          <th className="px-3 py-2 text-left">Rasio KM/Liter</th>
                          <th className="px-3 py-2 text-left">Upah Ritase Per KM</th>
                          <th className="px-3 py-2 text-left">Aksi Simpan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.keys(vehicleRatesDraft) as Array<keyof AppSettings["vehicleRates"]>).map((jenis) => {
                          const rate = vehicleRatesDraft[jenis];
                          return (
                            <tr key={jenis} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium">{jenis}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0.0001}
                                  step="0.1"
                                  className="input h-10"
                                  value={rate.kmPerLiter}
                                  onChange={(e) =>
                                    setVehicleRatesDraft((prev) => ({
                                      ...prev,
                                      [jenis]: {
                                        ...prev[jenis],
                                        kmPerLiter: Math.max(0.0001, Number(e.target.value) || 0.0001),
                                      },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  className="input h-10"
                                  value={rate.premiUpahPerKm}
                                  onChange={(e) =>
                                    setVehicleRatesDraft((prev) => ({
                                      ...prev,
                                      [jenis]: {
                                        ...prev[jenis],
                                        premiUpahPerKm: Math.max(0, Number(e.target.value) || 0),
                                      },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="btn-secondary h-10 px-3"
                                  onClick={() => saveSingleVehicleRate(jenis)}
                                >
                                  Simpan
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {settingsError && <p className="mt-3 text-sm text-rose-600">{settingsError}</p>}
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={handleSaveSettings} className="btn-primary h-11 px-4">
                      Simpan Semua
                    </button>
                    <button type="button" onClick={handleResetSettings} className="btn-secondary h-11 px-4">
                      Reset Default Tarif Kendaraan
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function groupBySimple(rows: SimpleTrip[], keyFn: (t: SimpleTrip) => string) {
  const map = new Map<string, { a: string; b: string; totalRitase: number; totalKm: number; totalUpahRitase: number; totalUpahPokok: number; totalUpahSopir: number; totalSolar: number; totalBiaya: number }>();
  rows.forEach((t) => {
    const key = keyFn(t);
    const [a, b = ""] = key.split("__");
    if (!map.has(key)) {
      map.set(key, { a, b, totalRitase: 0, totalKm: 0, totalUpahRitase: 0, totalUpahPokok: 0, totalUpahSopir: 0, totalSolar: 0, totalBiaya: 0 });
    }
    const row = map.get(key)!;
    row.totalRitase += 1;
    row.totalKm += t.jarakKm;
    row.totalUpahRitase += t.upahRitase;
    row.totalUpahPokok += t.upahPokok;
    row.totalUpahSopir += t.totalUpahSopir;
    row.totalSolar += t.totalSolar;
    row.totalBiaya += t.totalBiaya;
  });
  return Array.from(map.values());
}

function SettingsAccessModal({
  password,
  onPasswordChange,
  error,
  onSubmit,
  onCancel,
}: {
  password: string;
  onPasswordChange: (v: string) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="settings-access-title">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 id="settings-access-title" className="text-lg font-semibold text-slate-900">
          Akses Settings
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Password
            <input
              type="password"
              className="input mt-1 h-12 w-full"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary h-11 flex-1 px-4">
              Masuk
            </button>
            <button type="button" className="btn-secondary h-11 flex-1 px-4" onClick={onCancel}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MenuGroup({
  items,
  activeMenu,
  onChange,
}: {
  items: Array<{ id: MenuKey; label: string; icon: React.ComponentType<{ className?: string }> }>;
  activeMenu: MenuKey;
  onChange: (id: MenuKey) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeMenu === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-gradient-to-r from-teal-700 to-teal-500 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function DashboardPeriodFilter({
  period,
  setPeriod,
}: {
  period: DashboardPeriodState;
  setPeriod: React.Dispatch<React.SetStateAction<DashboardPeriodState>>;
}) {
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const list: number[] = [];
    for (let i = y - 15; i <= y + 2; i += 1) list.push(i);
    return list;
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">Tipe Periode</span>
          <select
            className="input h-11 min-w-[140px]"
            value={period.periodType}
            onChange={(e) =>
              setPeriod((p) => ({
                ...p,
                periodType: e.target.value as DashboardPeriodState["periodType"],
              }))
            }
          >
            <option value="harian">Harian</option>
            <option value="bulanan">Bulanan</option>
            <option value="tahunan">Tahunan</option>
          </select>
        </label>
        {period.periodType === "harian" && (
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Pilih Tanggal</span>
            <input
              type="date"
              className="input h-11 min-w-[180px]"
              value={period.selectedDate}
              onChange={(e) => setPeriod((p) => ({ ...p, selectedDate: e.target.value }))}
            />
          </label>
        )}
        {period.periodType === "bulanan" && (
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Pilih Bulan</span>
            <input
              type="month"
              className="input h-11 min-w-[180px]"
              value={period.selectedMonth}
              onChange={(e) =>
                setPeriod((p) => ({
                  ...p,
                  selectedMonth: e.target.value,
                }))
              }
            />
          </label>
        )}
        {period.periodType === "tahunan" && (
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1 block">Pilih Tahun</span>
            <select
              className="input h-11 min-w-[120px]"
              value={period.selectedYear}
              onChange={(e) =>
                setPeriod((p) => ({
                  ...p,
                  selectedYear: Number(e.target.value),
                }))
              }
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn-secondary h-11 px-4" onClick={() => setPeriod(getDefaultDashboardPeriod())}>
          Reset Periode
        </button>
      </div>
    </section>
  );
}

function PeriodSummaryCards({
  summary,
}: {
  summary: {
    current: {
      ritase: number;
      solar: number;
      upahRitase: number;
      biaya: number;
    };
    previous: {
      ritase: number;
      solar: number;
      upahRitase: number;
      biaya: number;
    };
  };
}) {
  const changeText = (current: number, previous: number) => {
    if (previous === 0) return "Belum ada data periode sebelumnya";
    const pct = ((current - previous) / previous) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% dari periode sebelumnya`;
  };
  const cards = [
    ["Total Ritase", `${summary.current.ritase}`, changeText(summary.current.ritase, summary.previous.ritase)],
    ["Total Solar", formatRupiah(summary.current.solar), changeText(summary.current.solar, summary.previous.solar)],
    ["Total Upah Ritase", formatRupiah(summary.current.upahRitase), changeText(summary.current.upahRitase, summary.previous.upahRitase)],
    ["Total Biaya", formatRupiah(summary.current.biaya), changeText(summary.current.biaya, summary.previous.biaya)],
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(([k, v, c]) => (
        <div key={k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{k}</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{v}</p>
          <p className="mt-1 text-xs text-slate-500">{c}</p>
        </div>
      ))}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function Warning({ text }: { text: string }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{text}</div>;
}

function PersonilTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Personil[];
  onEdit: (row: Personil) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr><th className="px-3 py-2 text-left">No</th><th className="px-3 py-2 text-left">Nama Sopir</th><th className="px-3 py-2 text-left">Status Sopir</th><th className="px-3 py-2 text-left">Status Aktif</th><th className="px-3 py-2 text-left">Aksi</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{r.namaSopir}</td>
              <td className="px-3 py-2"><StatusSopirBadge value={r.statusSopir} /></td>
              <td className="px-3 py-2">{r.statusAktif}</td>
              <td className="px-3 py-2"><button className="mr-3 text-teal-700" onClick={() => onEdit(r)}>Edit</button><button className="text-rose-600" onClick={() => onDelete(r.id)}>Hapus</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function KendaraanTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Kendaraan[];
  onEdit: (row: Kendaraan) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[850px] text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr><th className="px-3 py-2 text-left">No</th><th className="px-3 py-2 text-left">Jenis Kendaraan</th><th className="px-3 py-2 text-left">Plat Nomor</th><th className="px-3 py-2 text-left">Status Aktif</th><th className="px-3 py-2 text-left">Aksi</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2"><span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800">{r.jenisKendaraan}</span></td>
              <td className="px-3 py-2">{r.platNomor}</td>
              <td className="px-3 py-2">{r.statusAktif}</td>
              <td className="px-3 py-2"><button className="mr-3 text-teal-700" onClick={() => onEdit(r)}>Edit</button><button className="text-rose-600" onClick={() => onDelete(r.id)}>Hapus</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 rounded-md border border-slate-200 p-2">
      <p className="text-[11px] uppercase text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function StatusSopirBadge({ value }: { value: StatusSopir }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${value === "SOPIR HARIAN" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
      {value}
    </span>
  );
}

function MedanBadge({ value }: { value: SimpleTrip["jenisMedan"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${value === "BERAT" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
      {value}
    </span>
  );
}

function TransactionsTable({
  rows,
  onDetail,
  onDelete,
}: {
  rows: SimpleTrip[];
  onDetail: (row: SimpleTrip) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold tracking-wide text-slate-900">
        DETAIL AKTIVITAS
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2040px] text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-2 py-2 text-left">No</th>
            <th className="px-2 py-2 text-left">Tanggal</th>
            <th className="px-2 py-2 whitespace-nowrap text-left">Jam berangkat</th>
            <th className="px-2 py-2 whitespace-nowrap text-left">Jam tiba</th>
            <th className="px-2 py-2 whitespace-nowrap text-left">Kat. muatan</th>
            <th className="px-2 py-2 text-left">Sopir</th>
            <th className="px-2 py-2 text-left">Status Sopir</th>
            <th className="px-2 py-2 text-left">Kendaraan</th>
            <th className="px-2 py-2 text-left">Plat Nomor</th>
            <th className="px-2 py-2 text-left">Paket Pekerjaan</th>
            <th className="px-2 py-2 text-left">Rute</th>
            <th className="px-2 py-2 text-right">Jarak KM</th>
            <th className="px-2 py-2 text-left">Medan</th>
            <th className="px-2 py-2 text-left">Muatan</th>
            <th className="px-2 py-2 max-w-[220px] text-left">Keterangan</th>
            <th className="px-2 py-2 text-right">Total Upah</th>
            <th className="px-2 py-2 text-right">Solar</th>
            <th className="px-2 py-2 text-right">Total Biaya</th>
            <th className="px-2 py-2 text-left">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/50" onClick={() => onDetail(r)}>
              <td className="px-2 py-2">{i + 1}</td>
              <td className="px-2 py-2">{r.tanggal}</td>
              <td className="px-2 py-2 whitespace-nowrap tabular-nums text-slate-800">{r.jamAmbil}</td>
              <td className="px-2 py-2 whitespace-nowrap tabular-nums text-slate-800">{r.jamKirim}</td>
              <td className="px-2 py-2 whitespace-nowrap text-slate-700" title={r.kategoriMuatan === "BALIK" ? labelMuatanKembali(r.muatanKembaliJenis) : ""}>
                {r.kategoriMuatan === "UTAMA" ? "Utama" : `Kembali Â· ${r.muatanKembaliJenis === "KOSONG" ? "Kosong" : "Isi"}`}
              </td>
              <td className="px-2 py-2">{r.namaSopir}</td>
              <td className="px-2 py-2"><StatusSopirBadge value={r.statusSopir} /></td>
              <td className="px-2 py-2"><span className="rounded-md bg-amber-100 px-2 py-0.5">{r.jenisKendaraan}</span></td>
              <td className="px-2 py-2">{r.platNomor}</td>
              <td className="px-2 py-2">{r.namaPaketPekerjaan}</td>
              <td className="px-2 py-2">{r.lokasiAmbil} - {r.lokasiKirim}</td>
              <td className="px-2 py-2 text-right">{r.jarakKm}</td>
              <td className="px-2 py-2"><MedanBadge value={r.jenisMedan} /></td>
              <td className="px-2 py-2 whitespace-nowrap text-slate-700">
                {r.kategoriMuatan === "UTAMA" ? labelJenisMuatan(r.jenisMuatan) : "—"}
              </td>
              <td className="px-2 py-2 max-w-[220px] break-words text-slate-700" title={formatKeteranganFallback(r.keterangan)}>{formatKeteranganTableCell(r.keterangan)}</td>
              <td className="px-2 py-2 text-right">{formatRupiah(r.totalUpahSopir)}</td>
              <td className="px-2 py-2 text-right">{formatRupiah(r.totalSolar)}</td>
              <td className="px-2 py-2 text-right">{formatRupiah(r.totalBiaya)}</td>
              <td className="px-2 py-2"><button onClick={(e) => { e.stopPropagation(); onDetail(r); }} className="mr-2 text-teal-700">Detail</button><button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="text-rose-600">Hapus</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function TransactionDetail({ row, onClose }: { row: SimpleTrip; onClose: () => void }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Detail Transaksi</h3><button className="text-sm text-slate-500" onClick={onClose}>Tutup</button></div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <ResultItem label="Tanggal" value={row.tanggal} />
        <ResultItem label="Sopir" value={row.namaSopir} />
        <ResultItem label="Status Sopir" value={row.statusSopir} />
        <ResultItem label="Kendaraan" value={`${row.jenisKendaraan} - ${row.platNomor}`} />
        <ResultItem label="Jam berangkat" value={row.jamAmbil} />
        <ResultItem label="Jam tiba" value={row.jamKirim} />
        <ResultItem label="Kategori muatan" value={labelKategoriMuatan(row.kategoriMuatan)} />
        {row.kategoriMuatan === "BALIK" && (
          <ResultItem label="Muatan kembali" value={labelMuatanKembali(row.muatanKembaliJenis)} />
        )}
        {row.kategoriMuatan === "BALIK" &&
          row.muatanKembaliJenis === "BERMUATAN" &&
          !!row.muatanKembaliUraian?.trim() && (
            <div className="md:col-span-2 rounded-md border border-slate-200 p-2">
              <p className="text-[11px] uppercase text-slate-500">Muatan yang dibawa</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{row.muatanKembaliUraian.trim()}</p>
            </div>
          )}
        <div className="md:col-span-2 rounded-md border border-slate-200 p-2">
          <p className="text-[11px] uppercase text-slate-500">Keterangan</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{formatKeteranganFallback(row.keterangan)}</p>
        </div>
        <ResultItem label="Jarak Dihitung" value={`${row.jarakDihitung} km`} />
        {row.kategoriMuatan === "UTAMA" && (
          <ResultItem label="Muatan" value={labelJenisMuatan(row.jenisMuatan)} />
        )}
        <ResultItem label="Tambahan upah ritase (muatan)" value={formatRupiah(row.tambahanUpahMuatan)} />
        <ResultItem label="Upah Ritase" value={formatRupiah(row.upahRitase)} />
        <ResultItem label="Upah Pokok Setting" value={formatRupiah(row.upahPokokSetting)} />
        <ResultItem label="Upah Pokok" value={formatRupiah(row.upahPokok)} />
        <ResultItem label="Total Upah Sopir" value={formatRupiah(row.totalUpahSopir)} />
        <ResultItem label="Total Liter Solar" value={`${row.totalLiterSolar} liter`} />
        <ResultItem label="Total Solar" value={formatRupiah(row.totalSolar)} />
        <ResultItem label="Total Biaya" value={formatRupiah(row.totalBiaya)} />
      </div>
    </section>
  );
}

function RekapTable({
  headers,
  rows,
  onRowClick,
  footerRow,
  numericMinCol = 0,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  onRowClick: (index: number) => void;
  footerRow?: Array<string | number>;
  /** Kolom indeks &gt;= ini diratakan kanan (angka & rupiah). */
  numericMinCol?: number;
}) {
  const thClass = (i: number) =>
    i >= numericMinCol ? "px-3 py-2 text-right font-semibold tabular-nums" : "px-3 py-2 text-left font-semibold";
  const tdClass = (i: number, isFooter?: boolean) =>
    [
      "px-3 py-2 align-top",
      i >= numericMinCol ? "text-right tabular-nums" : "text-left",
      isFooter ? "font-semibold text-slate-900" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-md print:border print:border-slate-400 print:shadow-none">
      <table className="w-full min-w-[920px] border-collapse text-xs print:min-w-0 print:w-full print:text-[10px]">
        <thead className="border-b border-slate-200 bg-slate-100 text-slate-700 print:bg-slate-200">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={thClass(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/50 print:break-inside-avoid print:hover:bg-transparent"
              onClick={() => onRowClick(idx)}
            >
              {row.map((cell, i) => (
                <td key={i} className={tdClass(i)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerRow && footerRow.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 print:bg-slate-100">
              {footerRow.map((cell, i) => (
                <td key={i} className={`${tdClass(i, true)} print:py-2`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

function DetailList({ title, rows }: { title: string; rows: SimpleTrip[] }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr><th className="px-2 py-2 text-left">Tanggal</th><th className="px-2 py-2 text-left">Sopir</th><th className="px-2 py-2 text-left">Paket</th><th className="px-2 py-2 max-w-[200px] text-left">Keterangan</th><th className="px-2 py-2 text-right">Total Upah</th><th className="px-2 py-2 text-right">Solar</th><th className="px-2 py-2 text-right">Total Biaya</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2 py-2">{r.tanggal}</td>
                <td className="px-2 py-2">{r.namaSopir}</td>
                <td className="px-2 py-2">{r.namaPaketPekerjaan}</td>
                <td className="px-2 py-2 max-w-[200px] break-words" title={formatKeteranganFallback(r.keterangan)}>{formatKeteranganTableCell(r.keterangan)}</td>
                <td className="px-2 py-2 text-right">{formatRupiah(r.totalUpahSopir)}</td>
                <td className="px-2 py-2 text-right">{formatRupiah(r.totalSolar)}</td>
                <td className="px-2 py-2 text-right">{formatRupiah(r.totalBiaya)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}










