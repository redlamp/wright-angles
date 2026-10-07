"use client";

import { useEffect, useRef } from "react";
import type { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { easeInOutCubic } from "@/lib/easing";
import type { Scenario } from "@/stores/viewer-store";
import { FPS_NODE_ID } from "./scene-hud";

/** Module-level so the react-compiler lint permits the mutation. */
function applySightY(group: Group | null, y: number) {
  if (group) group.position.y = y;
}

/**
 * Tweens the shared eye height toward its target in sync with the
 * figure's pose tween (same 0.5s ease), moving the sight line and
 * feeding every rect's projection origin via the shared ref.
 */
export function EyeTween({
  target,
  scenario,
  eyeRef,
  sightRef,
}: {
  target: number;
  scenario: Scenario;
  eyeRef: React.MutableRefObject<number>;
  sightRef: React.RefObject<Group | null>;
}) {
  const anim = useRef<{ from: number; start: number | null } | null>(null);
  const prev = useRef(target);
  const prevScenario = useRef(scenario);
  useEffect(() => {
    if (prev.current !== target) {
      // Tween on stance changes only; height-slider edits snap so the
      // sight line and projections track the drag without lag.
      if (prevScenario.current !== scenario) {
        anim.current = { from: eyeRef.current, start: null };
      } else {
        anim.current = null;
        eyeRef.current = target;
      }
      prev.current = target;
    }
    prevScenario.current = scenario;
  }, [target, scenario, eyeRef]);
  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / 0.5);
      eyeRef.current =
        t >= 1
          ? target
          : a.from + (target - a.from) * easeInOutCubic(t);
      if (t >= 1) anim.current = null;
      state.invalidate();
    }
    applySightY(sightRef.current, eyeRef.current);
  });
  return null;
}

/** Smoothed FPS, written to the HUD's DOM node at ~2Hz — no setState. */
export function FpsProbe() {
  const ema = useRef(0);
  const acc = useRef(1); // start "due" so the first frame writes immediately
  useFrame((_, delta) => {
    if (delta <= 0) return;
    const inst = 1 / delta;
    ema.current = ema.current === 0 ? inst : ema.current + (inst - ema.current) * 0.1;
    acc.current += delta;
    if (acc.current >= 0.5) {
      acc.current = 0;
      const el = document.getElementById(FPS_NODE_ID);
      if (el) el.textContent = String(Math.round(ema.current));
    }
  });
  return null;
}
