"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { Billboard, Line, Text } from "@react-three/drei";
import type { Device } from "@/lib/types";
import { physicalSizeCm } from "@/lib/display-math";

const LABEL_GRAY = "#9a9a9a";
const SHOW_LABELS = true;

/**
 * One device drawn true-to-scale (1 unit = 1cm): an outlined rect facing the
 * viewer at its viewing distance, centered at elevationCm (or the viewer's
 * eye height when unset), plus a drop line to the floor with the distance
 * readout. Rotation stays face-on even when off the sight line — elevation
 * is scene realism, not gaze math.
 */
export default function DeviceRect({
  device,
  eyeHeight,
}: {
  device: Device;
  eyeHeight: number;
}) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const centerY = device.elevationCm ?? eyeHeight;

  const outline = useMemo<[number, number, number][]>(() => {
    const hw = widthCm / 2;
    const hh = heightCm / 2;
    return [
      [-hw, -hh, 0],
      [hw, -hh, 0],
      [hw, hh, 0],
      [-hw, hh, 0],
      [-hw, -hh, 0],
    ];
  }, [widthCm, heightCm]);

  // Name label scales with the rect so a phone at 36cm doesn't drown in text.
  const nameSize = Math.min(12, Math.max(4, heightCm * 0.14));

  return (
    <group position={[0, centerY, device.distanceCm]}>
      <Line points={outline} color={device.color} lineWidth={2} />
      {/* Faint fill so nested rects still read where outlines overlap. */}
      <mesh>
        <planeGeometry args={[widthCm, heightCm]} />
        <meshBasicMaterial
          color={device.color}
          transparent
          opacity={0.06}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {SHOW_LABELS ? (
        <Billboard position={[0, heightCm / 2 + 3, 0]}>
          <Text
            fontSize={nameSize}
            color={device.color}
            anchorX="center"
            anchorY="bottom"
          >
            {device.label}
          </Text>
        </Billboard>
      ) : null}

      <Line
        points={[
          [0, -heightCm / 2, 0],
          [0, -centerY, 0],
        ]}
        color={LABEL_GRAY}
        lineWidth={1}
        transparent
        opacity={0.45}
      />
      {SHOW_LABELS ? (
        <Billboard position={[0, -centerY + 5, 0]}>
          <Text
            fontSize={5}
            color={LABEL_GRAY}
            anchorX="center"
            anchorY="bottom"
          >
            {`${Math.round(device.distanceCm)} cm`}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}
