import { AuthGate } from "@/components/AuthGate";
import { DashboardShell } from "@/components/DashboardShell";

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardShell />
    </AuthGate>
  );
}
