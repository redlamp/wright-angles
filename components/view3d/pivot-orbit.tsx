"use client";

import { useEffect, useRef, useState } from "react";
import { Box3, DoubleSide, Group, Raycaster, Vector2, Vector3, type Object3D } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { computeHandoffTarget, stepPivotOrbit } from "@/lib/orbit-pivot";

interface ControlsLike {
  target: Vector3;
  enabled: boolean;
  update: () => void;
}

/**
 * Ctrl+left-drag orbit: pivots the camera around the 3D point that was
 * under the cursor at press time, instead of OrbitControls' fixed
 * `target` — setting `target` to the hit point would make OrbitControls
 * re-aim the camera at it immediately, a visible jump. A plain drag is
 * still drei's own orbit (Taylor 2026-09-02: "default orbit is drei,
 * Ctrl+drag pins the clicked location"). Active only while `active` (the
 * orbit pose has settled — no camera-rig fly-in/out in progress).
 *
 * The pivot is the hit point on a device rect, but on the furniture and
 * the viewer figure it snaps to the model's BOTTOM-CENTRE — the base of
 * the couch, the figure's feet — found via an ancestor tagged
 * `userData.orbitPivot === "base"`. Orbiting a cushion corner reads as
 * arbitrary; orbiting the couch reads as intended.
 *
 * The pointerdown listener runs in the CAPTURE phase and stops
 * propagation, because OrbitControls treats Ctrl+left as a pan and
 * listens on the same element.
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
  // The pivot, for the duration of the drag only — rendered as a marker
  // so the user can see what the world is turning around (Taylor
  // 2026-09-02: without it the rotation read as confusing).
  const [shownPivot, setShownPivot] = useState<Vector3 | null>(null);

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
        // Re-enable only now: drei's wrapper calls controls.update() every
        // frame while enabled, and update() ends with lookAt(target) —
        // during the drag that would re-aim the camera at the OLD target
        // each frame, so the position orbited the pivot while the
        // orientation kept pointing elsewhere (Taylor 2026-09-02: "not
        // pivoting around the marked point"). With the target now on the
        // view axis, this first update() changes nothing.
        controls.enabled = true;
        controls.update();
      }
      if (pointerId.current !== null && el.hasPointerCapture?.(pointerId.current)) {
        el.releasePointerCapture(pointerId.current);
      }
      pointerId.current = null;
      setShownPivot(null);
      invalidate();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!activeRef.current) return;
      if (e.button !== 0) return;
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;

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
        (h) => (h.object as { isMesh?: boolean }).isMesh && isShown(h.object),
      );
      if (meshHit) {
        const base = baseAncestor(meshHit.object);
        if (base) {
          const box = new Box3().setFromObject(base);
          pivot.current.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
        } else {
          pivot.current.copy(meshHit.point);
        }
      } else {
        // Empty-sky drag: pivot on the pointer ray at the same distance
        // controls.target currently sits at, so it behaves like today.
        const dist = camera.position.distanceTo(controls.target);
        pivot.current
          .copy(raycaster.current.ray.origin)
          .addScaledVector(raycaster.current.ray.direction, dist);
      }

      // Ours, not OrbitControls' pan.
      e.stopImmediatePropagation();
      e.preventDefault();
      dragging.current = true;
      // Hand the camera to this component outright for the drag; see
      // endDrag for why OrbitControls must not run update() meanwhile.
      controls.enabled = false;
      setShownPivot(pivot.current.clone());
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

    el.addEventListener("pointerdown", onPointerDown, { capture: true });
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onLostPointerCapture);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown, { capture: true });
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", onLostPointerCapture);
    };
  }, [gl, camera, scene, get, invalidate, minPolarAngle, maxPolarAngle, rotateSpeed]);

  return shownPivot ? <PivotMarker position={shownPivot} /> : null;
}

/** Visible, and every ancestor visible (a hidden furniture group still
 * has visible meshes inside it). */
function isShown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Nearest ancestor (self included) tagged to pivot at its base. */
function baseAncestor(o: Object3D): Object3D | null {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (p.userData?.orbitPivot === "base") return p;
  }
  return null;
}

/** Fraction of the camera distance the marker spans: constant on screen. */
const MARKER_SCALE = 0.022;

/**
 * Screen-facing ring and dot at the orbit pivot. Scaled every frame by
 * its distance from the camera so it reads the same size wherever the
 * pivot lands, drawn on top of everything (no depth test) so a pivot on
 * the far side of a panel is still visible.
 */
function PivotMarker({ position }: { position: Vector3 }) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.quaternion.copy(camera.quaternion);
    g.scale.setScalar(camera.position.distanceTo(position) * MARKER_SCALE);
  });
  return (
    <group ref={group} position={position} renderOrder={1000}>
      <mesh renderOrder={1000}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh renderOrder={1000}>
        <ringGeometry args={[1.6, 1.7, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthTest={false} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh renderOrder={1000}>
        <circleGeometry args={[0.18, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
