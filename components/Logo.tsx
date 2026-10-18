/** Marca tipográfica propia (sin usar el logo de terceros). */
export function Logo({ suffix = "Agenda" }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-accent font-mono text-sm font-bold text-on-accent">
        e
      </span>
      <span>
        exponenciales <span className="font-mono text-xs font-normal uppercase tracking-[0.14em] text-dim">{suffix}</span>
      </span>
    </span>
  );
}
