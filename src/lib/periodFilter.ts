import type { DashboardPeriodType, SimpleTrip } from "@/lib/types";

/** Normalizes legacy dates: YYYY-MM-DD or DD/MM/YYYY → YYYY-MM-DD */
export function normalizeTransactionDateIso(tanggal: string): string | null {
  const s = tanggal.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const d = Number(dmy[1]);
    const mo = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function filterTransactionsByPeriod(
  transactions: SimpleTrip[],
  periodType: DashboardPeriodType,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: number,
): SimpleTrip[] {
  return transactions.filter((t) => {
    const iso = normalizeTransactionDateIso(t.tanggal);
    if (!iso) return false;
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));

    if (periodType === "harian") {
      return iso === selectedDate;
    }
    if (periodType === "bulanan") {
      const parts = selectedMonth.split("-");
      const sy = Number(parts[0]);
      const sm = Number(parts[1]);
      return y === sy && m === sm;
    }
    if (periodType === "tahunan") {
      return y === selectedYear;
    }
    return false;
  });
}

/** Selection values for the period immediately before the active one (same period type). */
export function getPreviousPeriodSelection(
  periodType: DashboardPeriodType,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: number,
): { selectedDate: string; selectedMonth: string; selectedYear: number } {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const defaultDate = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  if (periodType === "harian") {
    const base = selectedDate || defaultDate;
    const dt = new Date(`${base}T12:00:00`);
    if (Number.isNaN(dt.getTime())) {
      return { selectedDate: base, selectedMonth: selectedMonth || defaultMonth, selectedYear };
    }
    dt.setDate(dt.getDate() - 1);
    const y = dt.getFullYear();
    const mo = dt.getMonth() + 1;
    const d = dt.getDate();
    const sd = `${y}-${pad2(mo)}-${pad2(d)}`;
    return { selectedDate: sd, selectedMonth: `${y}-${pad2(mo)}`, selectedYear: y };
  }

  if (periodType === "bulanan") {
    const sm = selectedMonth || defaultMonth;
    const [yStr, moStr] = sm.split("-");
    const y = Number(yStr);
    const mo = Number(moStr);
    const dt = new Date(y, mo - 1, 1);
    dt.setMonth(dt.getMonth() - 1);
    const ny = dt.getFullYear();
    const nm = dt.getMonth() + 1;
    return {
      selectedDate: `${ny}-${pad2(nm)}-01`,
      selectedMonth: `${ny}-${pad2(nm)}`,
      selectedYear: ny,
    };
  }

  const y = Number.isFinite(selectedYear) ? selectedYear : today.getFullYear();
  return {
    selectedDate: "",
    selectedMonth: "",
    selectedYear: y - 1,
  };
}
