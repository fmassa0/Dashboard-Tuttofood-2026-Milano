import type { ViewName } from "../types";

const ITEMS: Array<{ id: ViewName; label: string; icon: string }> = [
  { id: "list", label: "Lista", icon: "M4 6h16M4 12h16M4 18h16" },
  { id: "map", label: "Mappa", icon: "M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.553-1.894L9 4m0 16l6-2m-6 2V4m6 14l4.447 1.724A2 2 0 0021 17.382V6.618a2 2 0 00-1.553-1.894L15 3m0 15V3" },
  { id: "dashboard", label: "Dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
  { id: "export", label: "Export", icon: "M12 4v12m0 0l-4-4m4 4l4-4m-9 8h10" },
];

interface Props {
  current: ViewName;
  onChange: (v: ViewName) => void;
}

export function BottomNav({ current, onChange }: Props) {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur pb-safe"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((it) => {
          const active = it.id === current;
          return (
            <li key={it.id} className="flex">
              <button
                type="button"
                aria-label={it.label}
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(it.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-tap py-2 text-xs font-medium transition-colors ${
                  active
                    ? "text-brand-500"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={it.icon} />
                </svg>
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
