import { Heart, Home, Package } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/stores/favorites";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/orders", label: "Orders", icon: Package },
];

export function BottomNav() {
  const count = useFavorites((s) => s.favorites.length);

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-stone-200 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="flex">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-muted",
              )
            }
          >
            <span className="relative">
              <Icon className="size-[22px]" />
              {label === "Favorites" && count > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-favorite px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
