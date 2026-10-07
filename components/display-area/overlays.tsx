"use client";

import { LayersIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAnnotationStore } from "@/stores/annotation-store";
import { fitBox } from "@/lib/fit";
import { cropDims, cropScaleOf } from "@/lib/media-crop";
import type { FitMode, MediaCrop, MediaItem } from "@/lib/types";

/**
 * Wrapper-based CSS crop for media elements that take no style prop
 * (SyncedVideo, the GIF follower canvas — object-view-box needs an inline
 * style): the effective region contain-fit into the rect becomes a clip
 * box, with the full-frame element oversized and offset behind it.
 */
export function CropFrame({
  item,
  crop,
  mode,
  w,
  h,
  children,
}: {
  item: MediaItem;
  /** The crop to show — the owning device's EFFECTIVE crop. */
  crop: MediaCrop;
  /** The owning device's fit mode — stretch fills the whole rect. */
  mode: FitMode;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const eff = cropDims(item, crop);
  const area = fitBox(mode, eff.width, eff.height, w, h);
  return (
    <div
      className="absolute overflow-hidden"
      style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
    >
      <div className="absolute" style={cropScaleOf(crop)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Debug-overlays menu chip (plan topic 10): safe areas, contrast
 * badges, pixel loupe. Session-only toggles with app-wide parity.
 */
export function OverlaysChip() {
  const showSafeAreas = useAnnotationStore((s) => s.showSafeAreas);
  const setShowSafeAreas = useAnnotationStore((s) => s.setShowSafeAreas);
  const showContrast = useAnnotationStore((s) => s.showContrast);
  const setShowContrast = useAnnotationStore((s) => s.setShowContrast);
  const loupeOn = useAnnotationStore((s) => s.loupeOn);
  const setLoupeOn = useAnnotationStore((s) => s.setLoupeOn);
  const anyOn = showSafeAreas || showContrast || loupeOn;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-2.5 font-mono text-sm transition-colors",
          anyOn
            ? "bg-white/25 text-white"
            : "bg-black/50 text-white/60 hover:text-white",
        )}
        title="Debug overlays: safe areas, contrast badges, pixel loupe"
      >
        <LayersIcon className="size-3" />
        overlays
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={showSafeAreas}
          onCheckedChange={setShowSafeAreas}
        >
          TV safe areas (93% / 90%)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showContrast}
          onCheckedChange={setShowContrast}
        >
          Contrast badges on scanned text
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={loupeOn}
          onCheckedChange={setLoupeOn}
        >
          Pixel loupe
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * SMPTE ST 2046-1 safe-area frames, relative to the DISPLAY (not the
 * media): action-safe 93%, title-safe 90%. Overlaid per device rect so
 * TV-bound UI can be judged against every screen at once.
 */
export function SafeAreas({ large }: { large: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute border border-dashed border-white/50"
        style={{ inset: "3.5%" }}
      >
        {large ? (
          <span className="absolute top-0 left-1 font-mono text-sm text-white/50">
            action 93%
          </span>
        ) : null}
      </div>
      <div
        className="absolute border border-dashed border-[#f5a524]/60"
        style={{ inset: "5%" }}
      >
        {large ? (
          <span className="absolute bottom-0 left-1 font-mono text-sm text-[#f5a524]/70">
            title 90%
          </span>
        ) : null}
      </div>
    </div>
  );
}
