"use client";

import { useEffect, useMemo, useRef } from "react";
import { Euler, Group, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { PivotControls } from "@react-three/drei";
import { sideFit, type HandFit, type HandGraft, type SideFits } from "./hand-graft";
import { useAuditionStore } from "./audition-store";
import { worldPos } from "./rig-math";
import type { Bone } from "three";

const DEG = MathUtils.degToRad;

/**
 * A pivot gizmo on one hand's wrist, in the aligned hand frame (x along
 * the fingers, y along the palm normal, z across the wrist). Its arrows
 * slide the hand, its rings rotate it and its handles scale it; the
 * result is written back into that hand's own HandFit, so the numbers
 * can be baked later. Shown in T-pose.
 */
export default function HandGizmo({
  graft,
  fit,
  onChange,
}: {
  graft: HandGraft;
  fit: HandFit;
  onChange: (fit: HandFit) => void;
}) {
  const anchor = useRef<Group>(null);
  const matrix = useMemo(() => {
    const mat = new Matrix4();
    const q = new Quaternion().setFromEuler(new Euler(DEG(fit.rotX), DEG(fit.rotY), DEG(fit.rotZ), "XYZ"));
    return mat.compose(new Vector3(fit.slideZ, fit.slideY, fit.slideX), q, new Vector3(fit.size, fit.size, fit.size));
  }, [fit]);
  const tmp = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3(), e: new Euler() }), []);
  useFrame(() => {
    const a = anchor.current;
    if (!a) return;
    a.position.copy(graft.anchorPos);
    a.quaternion.copy(graft.anchorQ);
    a.updateMatrixWorld(true);
  });
  return (
    <group ref={anchor}>
      <PivotControls
        matrix={matrix}
        autoTransform={false}
        depthTest={false}
        scale={10}
        lineWidth={2}
        fixed={false}
        onDrag={(l) => {
          l.decompose(tmp.p, tmp.q, tmp.s);
          tmp.e.setFromQuaternion(tmp.q, "XYZ");
          onChange({
            size: Math.min(1.5, Math.max(0.5, tmp.s.x)),
            flareX: fit.flareX,
            flareY: fit.flareY,
            slideZ: tmp.p.x,
            slideY: tmp.p.y,
            slideX: tmp.p.z,
            rotX: MathUtils.radToDeg(tmp.e.x),
            rotY: MathUtils.radToDeg(tmp.e.y),
            rotZ: MathUtils.radToDeg(tmp.e.z),
          });
        }}
      />
    </group>
  );
}

const FOCUS_OFFSET = new Vector3(0.5, 0.45, 0.75).normalize().multiplyScalar(55);

/**
 * Snaps the orbit camera onto the left wrist when the picker asks (a
 * counter in the store): target on the wrist, camera 55 cm away, in
 * front, above and to the figure's left. Always mounted, no render.
 */
export function WristFocus({ sides }: { sides: Record<1 | -1, { graft: HandGraft | null; hand: Bone }> }) {
  // A store selector, not a frame-loop poll: with the demand frameloop no
  // frame runs until something re-renders, and this re-render is it.
  const n = useAuditionStore((s) => s.focusWrist);
  const side = useAuditionStore((s) => s.focusSide);
  const seen = useRef(n);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (n === seen.current) return;
    seen.current = n;
    const { graft, hand } = sides[side];
    const at = new Vector3();
    if (graft) at.copy(graft.anchorPos);
    else worldPos(hand, at);
    // Approach from the figure's front, above, on that hand's own side.
    camera.position.copy(at).add(new Vector3(FOCUS_OFFSET.x * side, FOCUS_OFFSET.y, FOCUS_OFFSET.z));
    if (controls) {
      controls.target.copy(at);
      controls.update();
    } else camera.lookAt(at);
    invalidate();
  }, [n, side, sides, camera, controls, invalidate]);
  return null;
}

/** Both hands' gizmos (T-pose), each editing its own side's fit. */
export function HandGizmos({ sides, fits, onChange }: { sides: Record<1 | -1, { graft: HandGraft | null }>; fits: SideFits; onChange: (side: 1 | -1, fit: HandFit) => void }) {
  return (
    <>
      {([1, -1] as const).map((side) => {
        const g = sides[side].graft;
        return g ? <HandGizmo key={side} graft={g} fit={sideFit(fits, side)} onChange={(f) => onChange(side, f)} /> : null;
      })}
    </>
  );
}
