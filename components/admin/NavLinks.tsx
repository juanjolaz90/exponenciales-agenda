"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Agendas" },
  { href: "/app/reservas", label: "Reservas" },
  { href: "/app/ajustes", label: "Ajustes" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/app" ? path === "/app" || path.startsWith("/app/agendas") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-1.5 transition ${active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
