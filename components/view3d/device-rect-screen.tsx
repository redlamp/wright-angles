"use client";

import { BackSide, DoubleSide } from "three";
import type { Device } from "@/lib/types";
import type { DisplayFill } from "@/stores/settings-store";
import type { fitBox } from "@/lib/fit";
import type { ScreenMedia } from "./device-rect";

/**
 * One device's screen surface: the media quad (flat or a cylinder
 * segment) over its letterbox backing, or the empty-panel fill when no
 * media is shown. Rendered by DeviceRect inside its pitched panel group.
 */
export default function DeviceScreen({
  device,
  media,
  fit,
  displayFill,
  curved,
  R,
  widthCm,
  heightCm,
}: {
  device: Device;
  media?: ScreenMedia | null;
  fit: ReturnType<typeof fitBox> | null;
  displayFill: DisplayFill;
  curved: boolean;
  R: number;
  widthCm: number;
  heightCm: number;
}) {
  // Letterbox backing behind media content, matching the 2D view's fill.
  const backing = displayFill === "device-color" ? device.color : "#000000";

  return (
    <>
      {media && fit ? (
        curved ? (
          <group position={[0, 0, -R]}>
            {/* Letterbox backing, a hair inside the outline's arc. */}
            {/* Backing renders viewer-side only so the content's mirror
                image stays visible from behind the device (double-sided
                screens are intentional — Taylor). */}
            <mesh>
              <cylinderGeometry
                args={[R - 0.1, R - 0.1, heightCm, 48, 1, true,
                  -widthCm / (R - 0.1) / 2, widthCm / (R - 0.1)]}
              />
              <meshBasicMaterial color={backing} side={BackSide} toneMapped={false} />
            </mesh>
            <mesh>
              <cylinderGeometry
                args={[R - 0.25, R - 0.25, fit.h, 48, 1, true,
                  -fit.w / (R - 0.25) / 2, fit.w / (R - 0.25)]}
              />
              <meshBasicMaterial map={media.texture} side={DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        ) : (
          <>
            {/* Backing renders viewer-side only so the content's mirror
                image stays visible from behind the device (double-sided
                screens are intentional — Taylor). */}
            <mesh position={[0, 0, -0.15]}>
              <planeGeometry args={[widthCm, heightCm]} />
              <meshBasicMaterial color={backing} side={BackSide} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.3]}>
              <planeGeometry args={[fit.w, fit.h]} />
              <meshBasicMaterial map={media.texture} side={DoubleSide} toneMapped={false} />
            </mesh>
          </>
        )
      ) : (
        /* Empty panel: solid key-color fill when the setting asks for it,
           else a faint fill so nested rects still read where outlines
           overlap. depthWrite stays off either way so nesting never
           z-fights. */
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
            opacity={displayFill === "device-color" ? 0.9 : 0.06}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
