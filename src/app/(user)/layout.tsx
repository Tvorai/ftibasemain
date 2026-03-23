import { DashboardShell } from "@/components/DashboardShell";
import { UserSidebar } from "@/components/Sidebar";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell sidebar={<UserSidebar />}>{children}</DashboardShell>;
}
