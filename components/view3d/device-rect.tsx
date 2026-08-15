"use client";

import { useEffect, useMemo, useRef } from "react";
import { BackSide, DoubleSide, MathUtils, type Group, type Texture } from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, RoundedBox, Text } from "@react-three/drei";
import type { Device } from "@/lib/types";
import { physicalSizeCm } from "@/lib/display-math";
import { containFit } from "@/lib/fit";
import { HANDHELD_BODIES } from "@/lib/presets";
import type { ScenePalette } from "./scene-palette";

const SHOW_LABELS = true;

/** Matches the viewer figure's pose tween so stance changes move in sync. */
const TWEEN_S = 0.5;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Module-level mutator (react-compiler lint forbids property assignment on
 * hook-returned objects inside components). Places everything that depends
 * on the animated center height: the rect group itself, the drop-line group
 * (a unit line anchored at the rect bottom whose scale.y is the drop length
 * to the floor), and the floor label 5cm above the floor.
 */
/**
 * Rect-bottom → floor span for the drop line's scale.y. The epsilon keeps
 * the matrix invertible when the rect bottom sits exactly on the floor;
 * sign is preserved so a below-floor bottom draws upward.
 */
function dropLen(y: number, heightCm: number): number {
  const len = y - heightCm / 2;
  return Math.abs(len) < 1e-3 ? 1e-3 : len;
}

function applyCenterY(
  rect: Group | null,
  drop: Group | null,
  label: Group | null,
  y: number,
  heightCm: number,
) {
  if (rect) rect.position.y = y;
  if (drop) drop.scale.y = dropLen(y, heightCm);
  if (label) label.position.y = -y + 5;
}

/**
 * The active media item's texture, loaded once at scene level and shared by
 * every rect. Width/height are the content's intrinsic pixels (for fit).
 */
export interface ScreenMedia {
  texture: Texture;
  width: number;
  height: number;
}

/**
 * One device drawn true-to-scale (1 unit = 1cm): an outlined rect facing the
 * viewer at its viewing distance, centered at `centerY` (resolved by the
 * parent from the device's per-scenario elevation or the viewer's eye
 * height), plus a drop line to the floor with the distance readout.
 * Rotation stays face-on even when off the sight line — elevation is scene
 * realism, not gaze math.
 *
 * When `centerY` changes (stance change, elevation edit) the rect group's Y
 * tweens toward it (~0.5s ease in-out, matching the figure's pose tween)
 * imperatively in useFrame — retargetable mid-flight, no setState per
 * frame. The drop line and its floor label track the moving rect.
 *
 * Screens with curvatureR render as a cylinder segment (radius R, arc length
 * = physical width) concave toward the viewer. All screen surfaces face +Z,
 * so the viewer at -Z sees their back faces; the shared texture is mirrored
 * in U once at load time to compensate (see scene-view).
 */
export default function DeviceRect({
  device,
  centerY,
  palette,
  media,
}: {
  device: Device;
  /** Target screen-center height (cm); the rendered Y tweens toward it. */
  centerY: number;
  palette: ScenePalette;
  media?: ScreenMedia | null;
}) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);

  const rectRef = useRef<Group>(null);
  const dropRef = useRef<Group>(null);
  const labelRef = useRef<Group>(null);

  // Height tween state, same pattern as viewer-figure's pose tween: the
  // live value in a ref, an anim record capturing where the flight started.
  const curY = useRef(centerY);
  const anim = useRef<{ from: number; start: number | null } | null>(null);
  const prevTarget = useRef(centerY);
  useEffect(() => {
    if (prevTarget.current !== centerY) {
      anim.current = { from: curY.current, start: null };
      prevTarget.current = centerY;
    }
  }, [centerY]);

  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / TWEEN_S);
      curY.current =
        t >= 1 ? centerY : MathUtils.lerp(a.from, centerY, easeInOutCubic(t));
      if (t >= 1) anim.current = null;
    }
    applyCenterY(rectRef.current, dropRef.current, labelRef.current, curY.current, heightCm);
  });

  // Curvature radius in cm; concave toward the viewer, so the center of
  // curvature sits on the viewer side at local z = -R.
  const R = device.curvatureR ? device.curvatureR / 10 : 0;
  const curved = R > 0;

  const outline = useMemo<[number, number, number][]>(() => {
    const hw = widthCm / 2;
    const hh = heightCm / 2;
    if (!curved) {
      return [
        [-hw, -hh, 0],
        [hw, -hh, 0],
        [hw, hh, 0],
        [-hw, hh, 0],
        [-hw, -hh, 0],
      ];
    }
    // Arc sampled so the outline hugs the curved surface; arc length is the
    // physical width, matching the angular math in display-math.
    const N = 24;
    const arc = widthCm / R;
    const pt = (t: number): [number, number] => {
      const th = (t - 0.5) * arc;
      return [R * Math.sin(th), -R + R * Math.cos(th)];
    };
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const [x, z] = pt(i / N);
      pts.push([x, -hh, z]);
    }
    for (let i = N; i >= 0; i--) {
      const [x, z] = pt(i / N);
      pts.push([x, hh, z]);
    }
    pts.push(pts[0]);
    return pts;
  }, [widthCm, heightCm, curved, R]);

  const body =
    device.show3dBody !== false && device.deviceName
      ? HANDHELD_BODIES[device.deviceName]
      : undefined;
  const fit = media ? containFit(media.width, media.height, widthCm, heightCm) : null;

  // Name label scales with the rect so a phone at 36cm doesn't drown in text.
  const nameSize = Math.min(12, Math.max(4, heightCm * 0.14));

  return (
    <group ref={rectRef} position={[0, centerY, device.distanceCm]}>
      <Line points={outline} color={device.color} lineWidth={2} />

      {body ? (
        // Full chassis behind the screen so device-vs-screen size reads.
        <RoundedBox
          args={[body.bodyWCm, body.bodyHCm, body.depthCm]}
          radius={Math.min(0.6, body.depthCm / 2 - 0.05)}
          position={[0, 0, body.depthCm / 2 + 0.05]}
        >
          <meshBasicMaterial color={palette.handheldBody} />
        </RoundedBox>
      ) : null}

      {media && fit ? (
        curved ? (
          <group position={[0, 0, -R]}>
            {/* Letterbox backing, a hair inside the outline's arc. */}
            <mesh>
              <cylinderGeometry
                args={[R - 0.1, R - 0.1, heightCm, 48, 1, true,
                  -widthCm / (R - 0.1) / 2, widthCm / (R - 0.1)]}
              />
              <meshBasicMaterial color="#000000" side={DoubleSide} toneMapped={false} />
            </mesh>
            <mesh>
              <cylinderGeometry
                args={[R - 0.25, R - 0.25, fit.h, 48, 1, true,
                  -fit.w / (R - 0.25) / 2, fit.w / (R - 0.25)]}
              />
              <meshBasicMaterial map={media.texture} side={BackSide} toneMapped={false} />
            </mesh>
          </group>
        ) : (
          <>
            <mesh position={[0, 0, -0.15]}>
              <planeGeometry args={[widthCm, heightCm]} />
              <meshBasicMaterial color="#000000" side={DoubleSide} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.3]}>
              <planeGeometry args={[fit.w, fit.h]} />
              <meshBasicMaterial map={media.texture} side={BackSide} toneMapped={false} />
            </mesh>
          </>
        )
      ) : (
        /* Faint fill so nested rects still read where outlines overlap. */
        <mesh position={curved ? [0, 0, -R] : [0, 0, 0]}>
          {curved ? (
            <cylinderGeometry
              args={[R, R, heightCm, 48, 1, true, -widthCm / R / 2, widthCm / R]}
            />
          ) : (
            <planeGeometry args={[widthCm, heightCm]} />
          )}
          <meshBasicMaterial
            color={device.color}
            transparent
            opacity={0.06}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

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
          color={palette.label}
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      </group>
      {SHOW_LABELS ? (
        <Billboard ref={labelRef} position={[0, -centerY + 5, 0]}>
          <Text
            fontSize={5}
            color={palette.label}
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
