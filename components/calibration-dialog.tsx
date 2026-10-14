"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { aspectFromResolution } from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { CalibrationPanel } from "@/components/calibration-panel";

/**
 * Standalone calibration entry point (Settings → "Calibrate screen
 * size…"). The actual card/edge-drag UI lives in CalibrationPanel so it
 * can also be embedded as an onboarding sub-step without nesting a
 * second Dialog inside the onboarding one.
 */
export function CalibrationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Body only mounts while open so every session re-reads the
          current This Device spec and devicePixelRatio. */}
      {open ? (
        <DialogContent className="max-h-[calc(100vh-2rem)] w-auto max-w-none overflow-y-auto sm:max-w-none">
          <CalibrationPanel
            resolution={thisDevice.resolution}
            diagonalIn={thisDevice.diagonalIn}
            onApply={(diagonalIn, resolution) => {
              // Resolution (and the aspect derived from it) only change
              // when the pre-check corrected it; an untouched spec keeps
              // its own aspect.
              const changed =
                resolution.w !== thisDevice.resolution.w ||
                resolution.h !== thisDevice.resolution.h;
              updateThisDevice(
                changed
                  ? {
                      diagonalIn,
                      resolution,
                      aspect: aspectFromResolution(resolution),
                    }
                  : { diagonalIn },
              );
              close();
            }}
            onCancel={close}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
