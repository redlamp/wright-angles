"use client";

import { useMemo } from "react";
import { ACUITY, deviceAngles } from "@/lib/display-math";
import {
  DEFAULT_REFERENCE_HEIGHT,
  formatReferenceHeight,
  textSizeGuide,
} from "@/lib/text-size";
import type { Device } from "@/lib/types";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { CautionIcon, HelpTip } from "@/components/legibility-ui";

/**
 * Live readout for one device, designer units first: the headline is
 * the smallest text size that reads on this screen, in px at the
 * active media's authoring resolution ("at 1080p"). The arc-minute
 * rosetta stone — field of view, pixel density — follows as detail,
 * each term with a "?" definition.
 */
export function AngleReadout({ device }: { device: Device }) {
  const showBands = useSettingsStore((s) => s.showLegibilityBands);
  const refH = useMediaStore(
    (s) =>
      s.items.find((i) => i.id === s.activeId)?.referenceHeight ||
      DEFAULT_REFERENCE_HEIGHT,
  );
  const a = useMemo(() => deviceAngles(device), [device]);
  const guide = useMemo(() => textSizeGuide(refH, device), [refH, device]);
  return (
    <div className="panel-inset space-y-1 rounded-md px-2.5 py-2 text-sm leading-5 text-muted-foreground">
      {showBands ? (
        <div className="border-b border-border pb-1.5">
          <div className="flex items-center gap-1 text-base font-medium text-foreground">
            Body text ≥ {guide.comfortablePx} px
            <span className="font-normal text-muted-foreground">
              · minimum {guide.minPx} px
            </span>
            <HelpTip term="minText" />
          </div>
          <div className="flex items-center gap-1">
            <span>
              at {formatReferenceHeight(refH)}, fullscreen ·{" "}
              {ACUITY.comfortableTextArcmin}′ / {ACUITY.minCriticalTextArcmin}′
              cap height
            </span>
            <HelpTip term="arcmin" />
          </div>
        </div>
      ) : null}
      <div className="font-mono">
        {a.horizontalArcmin.toFixed(0)}′ × {a.verticalArcmin.toFixed(0)}′ (
        {a.horizontalDeg.toFixed(1)}° × {a.verticalDeg.toFixed(1)}°) field
      </div>
      <div className="flex flex-wrap items-center gap-x-1 font-mono">
        {a.ppd.toFixed(1)} px/°
        <HelpTip term="ppd" />· {a.arcminPerPx.toFixed(2)}′/px ·{" "}
        {a.ppi.toFixed(0)} ppi
        {a.ppd < 60 ? (
          <span className="inline-flex items-center gap-1">
            · <CautionIcon />
            sub-retina
            <HelpTip term="subRetina" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
