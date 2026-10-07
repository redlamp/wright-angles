

/** Internal drag MIME so a tile drag never reads as a file import. */
export const MEDIA_DRAG_MIME = "application/x-wright-media";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}
