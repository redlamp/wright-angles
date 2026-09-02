"use client";

import { useEffect, useRef } from "react";
import { Raycaster, Vector2, Vector3, type Object3D } from "three";
import { useThree } from "@react-three/fiber";
import { computeHandoffTarget, stepPivotOrbit } from "@/lib/orbit-pivot";

interface ControlsLike {
  target: Vector3;
  update: () => void;
}

/**
 * Hand-rolled left-drag orbit: pressing the left mouse button pivots the
 * camera around the 3D point that was under the cursor at press time,
 * instead of OrbitControls' fixed `target` — setting `target` to the hit
 * point would make OrbitControls re-aim the camera at it immediately, a
 * visible jump. OrbitControls (`enableRotate={false}`) keeps wheel zoom and
 * right/middle-button pan; this component owns rotation only, and only
 * while `active` (the orbit pose has settled — no camera-rig fly-in/out in
 * progress).
 *
 * On release, hands the camera back to OrbitControls with no jump: its
 * `target` is set to the point on the camera's current view axis at the
 * pivot's distance along that axis (`computeHandoffTarget`), so re-aiming
 * at it doesn't move the camera.
 *
 * Doesn't touch touch input: OrbitControls' `enableRotate` gates mouse AND
 * touch rotate together, so disabling it also turns off its one-finger
 * touch rotate; this component only wires up pointer events for the
 * left-button mouse gesture the task asked for. See the task report.
 */
export default function PivotOrbit({
  active,
  minPolarAngle,
  maxPolarAngle,
  rotateSpeed = 1,
}: {
  /** Gate: only while OrbitControls owns the camera and no fly animation
   * (camera-rig's enter/exit) is running. */
  active: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
  rotateSpeed?: number;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);

  // Native listeners stay mounted for the component's lifetime; `active`
  // is read fresh on every pointerdown via a ref instead of re-attaching.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const pivot = useRef(new Vector3());
  const last = useRef({ x: 0, y: 0 });
  // Own Raycaster instance — never touches r3f's shared state.raycaster,
  // which is reserved for r3f's own hover/click hit-testing.
  const raycaster = useRef(new Raycaster());

  useEffect(() => {
    const el = gl.domElement;

    const ndcFromEvent = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };

    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const controls = get().controls as unknown as ControlsLike | null;
      if (controls) {
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        controls.target.copy(computeHandoffTarget(camera.position, forward, pivot.current));
        // enableDamping only affects zoom/pan momentum here (rotate never
        // touched OrbitControls' own delta state), so a single update() is
        // enough to make the handoff target take effect with no jump.
        controls.update();
      }
      if (pointerId.current !== null && el.hasPointerCapture?.(pointerId.current)) {
        el.releasePointerCapture(pointerId.current);
      }
      pointerId.current = null;
      invalidate();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!activeRef.current) return;
      if (e.button !== 0) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

      const controls = get().controls as unknown as ControlsLike | null;
      if (!controls) return;

      raycaster.current.setFromCamera(ndcFromEvent(e), camera);

      // Don't steal a drag that a device-rect handle (the distance-node
      // sphere, its label) or any other r3f-interactive object already
      // owns: r3f dispatches pointerdown to the nearest hit (by distance)
      // among state.internal.interaction, bubbling up to whichever
      // ancestor registered a handler — same list, same raycaster, so this
      // mirrors r3f's own hit-test instead of guessing at it.
      const interaction = get().internal.interaction;
      if (interaction.length) {
        const hit = raycaster.current.intersectObjects(interaction, true)[0];
        let o: Object3D | null = hit?.object ?? null;
        while (o) {
          const handlers = (o as unknown as { __r3f?: { handlers?: Record<string, unknown> } })
            .__r3f?.handlers;
          if (handlers?.onPointerDown) return;
          o = o.parent;
        }
      }

      const sceneHits = raycaster.current.intersectObjects(scene.children, true);
      const meshHit = sceneHits.find(
        (h) => (h.object as { isMesh?: boolean }).isMesh && h.object.visible,
      );
      if (meshHit) {
        pivot.current.copy(meshHit.point);
      } else {
        // Empty-sky drag: pivot on the pointer ray at the same distance
        // controls.target currently sits at, so it behaves like today.
        const dist = camera.position.distanceTo(controls.target);
        pivot.current
          .copy(raycaster.current.ray.origin)
          .addScaledVector(raycaster.current.ray.direction, dist);
      }

      dragging.current = true;
      pointerId.current = e.pointerId;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current || pointerId.current !== e.pointerId) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      const h = el.clientHeight || 1;
      const result = stepPivotOrbit({
        position: camera.position,
        quaternion: camera.quaternion,
        pivot: pivot.current,
        yaw: ((-2 * Math.PI * dx) / h) * rotateSpeed,
        pitch: ((-2 * Math.PI * dy) / h) * rotateSpeed,
        minPolarAngle,
        maxPolarAngle,
      });
      camera.position.copy(result.position);
      camera.quaternion.copy(result.quaternion);
      invalidate();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      endDrag();
    };
    const onLostPointerCapture = (e: PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      endDrag();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onLostPointerCapture);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", onLostPointerCapture);
    };
  }, [gl, camera, scene, get, invalidate, minPolarAngle, maxPolarAngle, rotateSpeed]);

  return null;
}
