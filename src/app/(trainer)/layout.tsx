import { DashboardShell } from "@/components/DashboardShell";
import { TrainerSidebar } from "@/components/Sidebar";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell sidebar={<TrainerSidebar />}>{children}</DashboardShell>;
}
