"use client";

import type { Group } from "three";
import { Billboard, Line, Text } from "@react-three/drei";
import type { Device } from "@/lib/types";
import type { LabelPlacement } from "./device-rect";
import type { DistanceDragHandlers } from "./use-distance-drag";
import {
  SHOW_LABELS,
  FONT_URL,
  dropLen,
  raiseDistLabel,
  raiseNameLabel,
  NAME_FONT_CM,
} from "./device-rect-helpers";

/**
 * DeviceRect's name billboard above the panel. Untilted readout; its
 * inner offset group is driven per frame by DeviceRect (applyNameOffset).
 */
export function DeviceNameLabel({
  device,
  heightCm,
  lp,
  nameOffsetRef,
}: {
  device: Device;
  heightCm: number;
  lp: LabelPlacement;
  nameOffsetRef: React.RefObject<Group | null>;
}) {
  const nameSize = NAME_FONT_CM;

  return (
    <>
      {SHOW_LABELS ? (
        <Billboard position={[0, heightCm / 2 + 3 + lp.nameLift, 0]}>
          {/* Registration-point clip (same model as the distance
              labels): the horizontal de-collision offset lives on this
              inner group and flips with the camera side per frame, so
              nested rects' names keep a stable side relative to the
              viewer instead of crossing over. */}
          <group ref={nameOffsetRef} position={[lp.nameX, 0, 0]}>
            <Text
              font={FONT_URL}
              fontSize={nameSize}
              color={device.color}
              anchorX="center"
              anchorY="bottom"
              outlineColor="#000000"
              outlineOpacity={0.5}
              outlineOffsetX="3%"
              outlineOffsetY="3%"
              onSync={raiseNameLabel}
            >
              {device.label}
            </Text>
          </group>
        </Billboard>
      ) : null}
    </>
  );
}

/**
 * DeviceRect's drop line to the floor plus the floor node with the
 * distance readout and drag target. The refs are driven per frame by
 * DeviceRect (applyCenterY, applyLabelLift).
 */
export function DeviceFloorMarker({
  device,
  centerY,
  heightCm,
  lp,
  shownDistLabel,
  dragHandlers,
  dropRef,
  labelRef,
  distLiftRef,
}: {
  device: Device;
  centerY: number;
  heightCm: number;
  lp: LabelPlacement;
  shownDistLabel: string;
  dragHandlers: DistanceDragHandlers;
  dropRef: React.RefObject<Group | null>;
  labelRef: React.RefObject<Group | null>;
  distLiftRef: React.RefObject<Group | null>;
}) {
  return (
    <>
      {/* Unit-length drop line anchored at the rect bottom; applyCenterY
          scales it down to the floor as the rect animates. lineWidth is in
          screen px, so scale.y doesn't fatten it. */}
      <group
        ref={dropRef}
        position={[0, -heightCm / 2, 0]}
        scale={[1, dropLen(centerY, heightCm), 1]}
      >
        <Line
          points={[
            [0, 0, 0],
            [0, -1, 0],
          ]}
          color={device.color}
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      </group>
      {SHOW_LABELS ? (
        /* Floor marker: a small node where the drop line lands, with the
           distance laid flat on the ground at 45° (spreadsheet-header
           style) — parallel diagonals never collide. */
        <group ref={labelRef} position={[0, -centerY + 0.12, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[1.4, 16, 12]} />
            <meshBasicMaterial color={device.color} />
          </mesh>
          {/* Oversized invisible hit target: the node doubles as a drag
              handle for the viewing distance along the sight line. */}
          {dragHandlers ? (
            <mesh position={[0, 1.2, 0]} {...dragHandlers}>
              <sphereGeometry args={[5, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ) : null}
          {/* Per Taylor's markup (2026-08-15 screenshots): the label
              hangs just below-right of the node, sloping 30° south-east
              in screen space, text reading along the slope. Parallel
              diagonals keep neighbors legible; static offsets only. */}
          {/* Flash model: a clip whose registration point (text left
              edge, vertical center) anchors ON the node; the 30° slope
              rotates about that point. De-collision moves the text's
              local Y inside the rotated clip, so neighboring parallel
              labels separate perpendicular to the slope with an even
              buffer. */}
          <Billboard position={[0, 1.2, 0]}>
            <group rotation={[0, 0, -Math.PI / 6]}>
              {/* Inner clip: per-frame camera-aware lift (applyLabelLift). */}
              <group ref={distLiftRef} position={[0, lp.distLift, 0]}>
                <Text
                  font={FONT_URL}
                  fontSize={5}
                  color={device.color}
                  anchorX="left"
                  anchorY="middle"
                  position={[6, 0, 0]}
                  outlineColor="#000000"
                  outlineOpacity={0.5}
                  outlineOffsetX="3%"
                  outlineOffsetY="3%"
                  onSync={raiseDistLabel}
                  {...(dragHandlers ?? {})}
                >
                  {shownDistLabel}
                </Text>
              </group>
            </group>
          </Billboard>
        </group>
      ) : null}
    </>
  );
}
