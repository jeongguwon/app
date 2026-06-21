import { AdminReportQueue } from "@/components/admin/admin-report-queue";

export default function AdminReportsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <AdminReportQueue />
      </div>
    </main>
  );
}
