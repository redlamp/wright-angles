"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useDeviceStore } from "@/stores/device-store";
import {
  CARD_H_MM,
  CARD_W_MM,
  cardWidthCssPx,
  diagonalFromCardPx,
} from "@/lib/calibration";

/**
 * Credit-card screen calibration (test plan 11.2): hold a real ID-1
 * bank card against the screen, resize the outline until they match,
 * and the card's known 85.60mm width measures the panel's true
 * pixels-per-cm — hence its true diagonal.
 */
export function CalibrationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Body only mounts while open so every session re-reads the
          current This Device spec and devicePixelRatio. */}
      {open ? <CalibrationBody close={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

/** Real ID-1 cards have a 3.18mm corner radius; scale it with the card. */
const CORNER_R_RATIO = 3.18 / CARD_W_MM;

function CalibrationBody({ close }: { close: () => void }) {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);

  // Snapshot the environment once per open. dpr changes mid-dialog
  // (zooming, moving the window across monitors) invalidate the whole
  // exercise anyway, and the zoom warning covers that case.
  const [env] = useState(() => {
    const dpr = window.devicePixelRatio || 1;
    const initial = cardWidthCssPx(
      thisDevice.diagonalIn,
      thisDevice.aspect,
      thisDevice.resolution.w,
      dpr,
    );
    // Adjustment range ~0.5×–2×, capped so the card stays inside the
    // viewport (if a card doesn't fit on screen, neither does calibration).
    const minPx = initial * 0.5;
    const maxPx = Math.min(
      initial * 2,
      Math.max(280, window.innerWidth - 96),
    );
    // screen.width stays in zoom-independent CSS px while dpr scales
    // with page zoom, so their product against the native width reads
    // the zoom factor (same trick as the display-area chip, 11.1).
    const zoomSuspect =
      Math.abs((dpr * window.screen.width) / thisDevice.resolution.w - 1) >
      0.02;
    return { dpr, initial, minPx, maxPx, zoomSuspect };
  });

  const [widthPx, setWidthPx] = useState(() =>
    Math.min(env.initial, env.maxPx),
  );
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const clamp = (v: number) => Math.min(Math.max(v, env.minPx), env.maxPx);
  const heightPx = (widthPx * CARD_H_MM) / CARD_W_MM;
  const implied = diagonalFromCardPx(widthPx, env.dpr, thisDevice.resolution);

  const apply = () => {
    updateThisDevice({ diagonalIn: Math.round(implied * 10) / 10 });
    close();
  };

  return (
    <DialogContent
      className="w-auto max-w-none sm:max-w-none"
      style={{ width: Math.max(420, env.maxPx + 40) }}
    >
      <DialogHeader>
        <DialogTitle>Calibrate screen size</DialogTitle>
        <DialogDescription>
          Hold any bank card flat against the screen over the outline,
          then drag the slider — or the card&rsquo;s right edge — until
          the outline matches the card exactly. Browser zoom must be at
          100%.
        </DialogDescription>
      </DialogHeader>

      {env.zoomSuspect ? (
        <p className="rounded-md bg-[#f5a524]/15 px-2.5 py-1.5 text-sm text-[#b97e0c] dark:text-[#f5a524]">
          Browser zoom isn&rsquo;t 100% (or This Device&rsquo;s resolution
          doesn&rsquo;t match this screen) — calibration will be
          unreliable until that&rsquo;s fixed.
        </p>
      ) : null}

      <div
        className="relative select-none"
        style={{ width: widthPx, height: heightPx }}
      >
        <div
          className="flex h-full w-full items-center justify-center border-2 border-foreground/70 bg-foreground/10"
          style={{ borderRadius: widthPx * CORNER_R_RATIO }}
        >
          <span className="font-mono text-sm text-muted-foreground">
            85.60 × 53.98 mm
          </span>
        </div>
        {/* Fine-adjust drag handle on the card's right edge. */}
        <div
          className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize touch-none"
          onPointerDown={(e) => {
            drag.current = { startX: e.clientX, startW: widthPx };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setWidthPx(
              clamp(drag.current.startW + e.clientX - drag.current.startX),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <div className="absolute inset-y-0 right-1.5 w-1 rounded-full bg-foreground/40" />
        </div>
      </div>

      <Slider
        min={env.minPx}
        max={env.maxPx}
        step={0.25}
        value={widthPx}
        onValueChange={(v) => setWidthPx(Array.isArray(v) ? v[0] : v)}
      />

      <p className="font-mono text-sm text-muted-foreground">
        implies {implied.toFixed(1)}″ — configured{" "}
        {thisDevice.diagonalIn.toFixed(1)}″
      </p>

      <DialogFooter>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button onClick={apply}>
          Apply {(Math.round(implied * 10) / 10).toFixed(1)}″
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
