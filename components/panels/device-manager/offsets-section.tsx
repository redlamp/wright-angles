"use client";

import type { Device } from "@/lib/types";
import { SCENARIOS, type Scenario } from "@/stores/viewer-store";
import {
  TILT_LIMIT_DEG,
  autoOrientDefaultFor,
  autoOrientOf,
  autoTiltDeg,
  centerYFor,
  eyeLevelForScenario,
} from "@/lib/viewing-geometry";
import { NumberStepper } from "@/components/number-stepper";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  DistanceUnitFlip,
  Microlabel,
  OffsetControls,
  StanceRow,
} from "./controls";

/**
 * The Offsets fold of the device editor: screen height and tilt for
 * every stance at once. Store reads stay in DeviceEditor; this only
 * renders what it is handed.
 */
export function OffsetsSection({
  device,
  onPatch,
  scenario,
  heightCm,
}: {
  device: Device;
  onPatch: (patch: Partial<Device>) => void;
  scenario: Scenario;
  heightCm: number;
}) {
  return (
    <Collapsible label="Offsets">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Microlabel>Screen height · from eye line</Microlabel>
            <DistanceUnitFlip />
          </span>
          <span className="text-sm text-muted-foreground">Eye level</span>
        </div>
        {SCENARIOS.map((s) => (
          <StanceRow key={s.id} label={s.label} active={s.id === scenario}>
            <OffsetControls
              label={s.label}
              offsetCm={device.heightOffsetCm?.[s.id]}
              onChange={(v) =>
                onPatch({
                  heightOffsetCm: { ...device.heightOffsetCm, [s.id]: v },
                })
              }
            />
          </StanceRow>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Microlabel>Tilt</Microlabel>
          <span className="text-sm text-muted-foreground">Auto-orient</span>
        </div>
        {SCENARIOS.map((s) => {
          const auto = autoOrientOf(device, s.id);
          // While auto-orienting the controls stay put but go inert,
          // showing the angle the geometry WORKED OUT rather than a
          // dead zero — you can read off that a screen below the gaze
          // is pitched up to meet it. Same row shape as screen height
          // above, so the two blocks line up (Taylor 2026-08-20).
          const eyeY = eyeLevelForScenario(s.id, heightCm);
          const deg = auto
            ? autoTiltDeg(
                centerYFor(device, s.id, eyeY),
                eyeY,
                device.distanceCm,
              )
            : (device.tilt?.[s.id] ?? 0);
          const patchTilt = (v: number | undefined) =>
            onPatch({ tilt: { ...device.tilt, [s.id]: v } });
          return (
            <StanceRow key={s.id} label={s.label} active={s.id === scenario}>
              <Slider
                min={-TILT_LIMIT_DEG}
                max={TILT_LIMIT_DEG}
                step={1}
                // An auto angle can exceed the slider's range (a
                // handheld in the lap needs ~48°); the track pins at
                // its end while the readout keeps the true figure.
                value={Math.max(-TILT_LIMIT_DEG, Math.min(TILT_LIMIT_DEG, deg))}
                disabled={auto}
                aria-label={`${s.label} screen tilt`}
                onValueChange={(v) =>
                  patchTilt(Array.isArray(v) ? v[0] : v)
                }
              />
              <NumberStepper
                ariaLabel={`${s.label} screen tilt in degrees`}
                value={deg}
                onChange={patchTilt}
                step={1}
                bigStep={5}
                min={-TILT_LIMIT_DEG}
                max={TILT_LIMIT_DEG}
                suffix="°"
                disabled={auto}
                className="h-7"
              />
              {/* Per stance, the same shape as eye level above. Stored
                  only when it disagrees with the category, so
                  untouched devices serialize byte-identically. */}
              <Switch
                checked={auto}
                aria-label={`${s.label} auto-orient`}
                onCheckedChange={(on) =>
                  onPatch({
                    autoOrient: {
                      ...device.autoOrient,
                      [s.id]:
                        on === autoOrientDefaultFor(device.category)
                          ? undefined
                          : on,
                    },
                  })
                }
              />
            </StanceRow>
          );
        })}
      </div>
    </Collapsible>
  );
}
