import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/admin/NavLinks";
import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/app">
            <Logo />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-semibold">
                {user.name[0]}
              </span>
            )}
            <form action="/api/auth/logout" method="post">
              <button className="text-xs text-dim hover:text-ink">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
