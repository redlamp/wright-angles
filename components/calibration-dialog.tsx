"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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
        <DialogContent className="w-auto max-w-none sm:max-w-none">
          <CalibrationPanel
            aspect={thisDevice.aspect}
            resolution={thisDevice.resolution}
            diagonalIn={thisDevice.diagonalIn}
            onApply={(diagonalIn) => {
              updateThisDevice({ diagonalIn });
              close();
            }}
            onCancel={close}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
