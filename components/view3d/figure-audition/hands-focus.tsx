"use client";

import { useEffect, useRef } from "react";
import { Vector3, type Bone } from "three";
import { useThree } from "@react-three/fiber";
import { useAuditionStore } from "./audition-store";
import { worldPos } from "./rig-math";

/** One hand: in front, above and on that hand's own side, 55 cm out. */
const SIDE_OFFSET = new Vector3(0.5, 0.45, 0.75).normalize().multiplyScalar(55);
/** Both hands: from the figure's front left, a little above, under the device screens. */
const BOTH_OFFSET = new Vector3(60, 22, 40);

/**
 * Snaps the orbit camera onto the hands when the picker asks (a counter
 * in the store): one wrist, or the midpoint of both. Always mounted, no
 * render. A store selector, not a frame-loop poll: with the demand
 * frameloop no frame runs until something re-renders, and this is it.
 */
export default function HandsFocus({ sides }: { sides: Record<1 | -1, { hand: Bone }> }) {
  const n = useAuditionStore((s) => s.focusWrist);
  const side = useAuditionStore((s) => s.focusSide);
  const seen = useRef(n);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (n === seen.current) return;
    seen.current = n;
    const at = new Vector3();
    if (side === 0) {
      at.copy(worldPos(sides[1].hand, new Vector3())).add(worldPos(sides[-1].hand, new Vector3())).multiplyScalar(0.5);
      camera.position.copy(at).add(BOTH_OFFSET);
    } else {
      worldPos(sides[side].hand, at);
      camera.position.copy(at).add(new Vector3(SIDE_OFFSET.x * side, SIDE_OFFSET.y, SIDE_OFFSET.z));
    }
    if (controls) {
      controls.target.copy(at);
      controls.update();
    } else camera.lookAt(at);
    invalidate();
  }, [n, side, sides, camera, controls, invalidate]);
  return null;
}
