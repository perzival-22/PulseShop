import { Construction } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export function DashboardPlaceholder({ title }: { title: string }) {
  return (
    <DashboardShell>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Construction className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">This section ships in a later phase.</p>
        </div>
      </div>
    </DashboardShell>
  );
}
