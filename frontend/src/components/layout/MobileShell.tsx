import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

/** Phone-width shell for all customer routes: constrained column + sticky bottom nav. */
export function MobileShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="app-surface mx-auto min-h-dvh w-full max-w-[430px]">
      <div className={nav ? "pb-28" : ""}>{children}</div>
      {nav && <BottomNav />}
    </div>
  );
}
