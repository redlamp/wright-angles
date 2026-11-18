"use client";

import { useEffect, useMemo } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF, useTexture } from "@react-three/drei";
import { Vector3, type Mesh, type Texture } from "three";
import { candidateUrl, naturalHeightCm, type Candidate } from "./candidates";
import { assignPalette, preparePalette } from "./figure-regions";
import { NO_EYE_OFFSET } from "./audition-store";
import { AUTHORED_CM, buildRig, poseRig, type Rig } from "./rigged-figure";
import { makePose } from "../viewer-figure";
import type { Stance } from "./figure-hands";
import {
  applyPaint,
  isPaintable,
  paintFacet,
  useBrush,
  usePaintStore,
} from "./figure-paint";

/** A figure's rig, built once and re-posed (at its own height) whenever the stance changes. */
function usePosed(c: Candidate, stance: Stance): { rig: Rig; height: number } {
  const gltf = useGLTF(candidateUrl(c), false, false);
  const invalidate = useThree((s) => s.invalidate);
  const built = useMemo(() => {
    const rig = buildRig(gltf.scene, c);
    rig.outer.traverse((m) => {
      if ((m as Mesh).isMesh && /icosphere/i.test(m.name)) m.visible = false;
    });
    return { rig, height: naturalHeightCm(rig.height, AUTHORED_CM) };
  }, [gltf, c]);
  useEffect(() => {
    posture(built.rig, built.height, stance);
    invalidate();
  }, [built, stance, invalidate]);
  return built;
}

/** Pose a rig in a stance (the rest pose is restored first, so any stance can follow any other). */
function posture(rig: Rig, height: number, stance: Stance) {
  if (rig.missing.length) return;
  // poseRig works in world space for a figure standing at the origin, so pose
  // it detached from its lineup spot and put it back afterwards.
  const parent = rig.outer.parent;
  parent?.remove(rig.outer);
  const pair = () => [new Vector3(), new Vector3()];
  poseRig(
    rig,
    makePose(stance.scenario, stance.input, height, null),
    stance,
    stance,
    1,
    null,
    NO_EYE_OFFSET,
    "off",
    pair(),
    pair(),
    pair(),
  );
  rig.outer.updateMatrixWorld(true);
  parent?.add(rig.outer);
}

export type Pausable = { enabled: boolean };
/** Pause or resume the pan controls (a plain function: hook values are not mutated in components). */
export function setPaused(controls: Pausable | null, paused: boolean) {
  if (controls) controls.enabled = !paused;
}

export default function LineupFigure({
  c,
  position,
  turn,
  stance,
  paletteUrl,
  selected,
  hovered,
  onHover,
  onPick,
  onSpin,
}: {
  c: Candidate;
  position: [number, number, number];
  turn: number;
  stance: Stance;
  paletteUrl: string | null;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  onSpin: (x: number, controls: Pausable | null) => void;
}) {
  const { rig, height } = usePosed(c, stance);
  const controls = useThree((s) => s.controls) as unknown as Pausable | null;
  const invalidate = useThree((s) => s.invalidate);
  const paint = usePaintStore((s) => s.paints[c.id]);
  const paintable = isPaintable(c);
  useEffect(() => {
    if (!paintable) return;
    applyPaint(rig.meshes, paint);
    invalidate();
  }, [rig, paint, paintable, invalidate]);
  const painting = () => paintable && useBrush.getState().on;
  const brush = (e: ThreeEvent<PointerEvent>) => {
    if (e.faceIndex == null) return;
    paintFacet(c.id, rig.meshes, e.object as Mesh, e.faceIndex);
  };
  return (
    <group position={position}>
      <group rotation-y={(turn * Math.PI) / 180}>
        <primitive
          object={rig.outer}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(c.id);
          }}
          onPointerOut={() => onHover(null)}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (painting() && !e.nativeEvent.ctrlKey) {
              // Ctrl+drag turns the figures even while painting
              // Paint: hold the pan still for the stroke, color what is under the brush.
              useBrush.getState().startStroke();
              setPaused(controls, true);
              window.addEventListener(
                "pointerup",
                () => setPaused(controls, false),
                { once: true },
              );
              brush(e);
              return;
            }
            onSpin(e.clientX, controls); // left-drag on a figure turns them all
          }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (!(e.buttons & 1) || !painting() || e.nativeEvent.ctrlKey)
              return; // Ctrl held: turning, not painting
            e.stopPropagation();
            brush(e);
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (e.delta > 4) return; // a drag, not a click
            e.stopPropagation();
            if (painting()) return; // painting, not picking
            onPick(c.id);
          }}
        />
      </group>
      {paletteUrl ? <Palette rig={rig} url={paletteUrl} /> : null}
      {selected || hovered ? (
        <mesh position={[0, -8, 32]}>
          <boxGeometry args={[60, 4, 4]} />
          <meshBasicMaterial color={selected ? "#22d3ee" : "#ffffff"} />
        </mesh>
      ) : null}
      {selected || hovered ? (
        <Html
          position={[0, height + 18, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {c.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/** Puts one palette texture on a figure's own materials (palette textures are shared, loaded once per URL). */
function Palette({ rig, url }: { rig: Rig; url: string }) {
  const tex = useTexture(url, preparePalette) as Texture;
  useEffect(() => assignPalette(rig.meshes, tex), [rig, tex]);
  return null;
}
