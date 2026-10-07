"use client";

import { DoubleSide, type Group } from "three";
import { Line } from "@react-three/drei";
import type { Device } from "@/lib/types";
import { legibilityColor } from "@/lib/legibility";
import { boxMetricsOnDevice } from "@/lib/box-metrics";
import type { fitBox } from "@/lib/fit";
import { groupColor } from "@/lib/text-groups";
import type { ContentBox, ScreenMedia } from "./device-rect";
import {
  setDeviceHover,
  projectBounds,
  boxLoopPoints,
} from "./device-rect-helpers";

/**
 * Measure boxes / detected lines ON one device's screen, with their
 * invisible hover catchers. Rendered by DeviceRect inside its pitched
 * panel group.
 */
export default function DeviceContentBoxes({
  contentBoxes,
  media,
  fit,
  device,
  selectedBoxId,
  boxColorMode,
  curved,
  R,
  rectRef,
  widthCm,
  heightCm,
}: {
  contentBoxes: ContentBox[];
  media: ScreenMedia;
  fit: ReturnType<typeof fitBox>;
  device: Device;
  selectedBoxId?: string | null;
  boxColorMode: "group" | "rating";
  curved: boolean;
  R: number;
  /** DeviceRect's outer group, for the hover card's screen footprint. */
  rectRef: React.RefObject<Group | null>;
  widthCm: number;
  heightCm: number;
}) {
  return (
    <>
      {contentBoxes.map((cb) => {
        const arcmin = boxMetricsOnDevice(
          cb.hMeasure,
          { width: media.width, height: media.height },
          device,
        ).arcmin;
        const sel = cb.id === selectedBoxId;
        const color =
          boxColorMode === "group" && cb.groupId !== undefined
            ? groupColor(cb.groupId)
            : legibilityColor(arcmin);
        // Invisible hover catcher over the box (chord plane — close
        // enough on curved panels for pointer purposes): hovering
        // feeds the inspector's live text details (Taylor).
        const yCenter = fit.h / 2 - (cb.rect.y + cb.rect.h / 2) * fit.h;
        const uc = 0.5 - (cb.rect.x + cb.rect.w / 2);
        // Fatter hot zone than the visible outline: half a line of
        // padding, floored at ~1.2% of the screen height, so small
        // text is hoverable from across the room. Neighbors may
        // overlap slightly; whichever catcher wins is fine.
        const pad = Math.max(cb.rect.h * fit.h * 0.5, fit.h * 0.012);
        const hitW = cb.rect.w * fit.w + pad * 2;
        const hitH = cb.rect.h * fit.h + pad * 2;
        return (
          <group key={cb.id}>
            <Line
              points={boxLoopPoints(cb.rect, fit.w, fit.h, curved ? R : 0)}
              color={sel ? "#ffffff" : color}
              lineWidth={sel ? 2.5 : 1.25}
              transparent
              opacity={sel ? 1 : 0.9}
            />
            {/* One catcher per SIDE of the screen: pointer events
                deliver front-to-back, so from behind the (nearer)
                media plane would swallow the hit before a single
                viewer-side catcher ever saw it. The back catcher
                sits just past the screen surface, making a catcher
                the first hit from either side — hovering the
                mirrored view works too, and the DOM card reads
                normally regardless (bounds are min/max normalized). */}
            {([-1, 1] as const).map((face) => {
              const r = curved ? (face < 0 ? R - 0.5 : R + 0.05) : 0;
              const theta = curved ? (fit.w / r) * uc : 0;
              return (
                <mesh
                  key={face}
                  position={
                    curved
                      ? [
                          r * Math.sin(theta),
                          yCenter,
                          -R + r * Math.cos(theta),
                        ]
                      : [uc * fit.w, yCenter, face < 0 ? -0.35 : 0.05]
                  }
                  rotation={[0, theta, 0]}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setDeviceHover({
                      deviceId: device.id,
                      box: {
                        id: cb.id,
                        label: cb.label,
                        srcPx: cb.srcPx,
                        hFull: cb.hFull,
                        groupId: cb.groupId,
                        bounds: projectBounds(
                          e,
                          cb.rect.w * fit.w,
                          cb.rect.h * fit.h,
                        ),
                        // The panel's own footprint, so the card can
                        // sit fully off the screen space.
                        screen: rectRef.current
                          ? projectBounds(
                              e,
                              widthCm,
                              heightCm,
                              rectRef.current,
                            )
                          : undefined,
                      },
                    });
                  }}
                  // No pointerout handler: the leave bubbles to the
                  // group (clearing hover), and whatever the pointer
                  // lands on next re-sets it in the same event batch.
                >
                  <planeGeometry args={[hitW, hitH]} />
                  <meshBasicMaterial
                    transparent
                    opacity={0}
                    depthWrite={false}
                    side={DoubleSide}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}
