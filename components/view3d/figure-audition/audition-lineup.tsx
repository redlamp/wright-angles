"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { MOUSE } from "three";
import { assetUrl, textureUrl, type Candidate } from "./candidates";
import { useAuditionStore } from "./audition-store";
import type { Stance } from "./figure-hands";
import { CtrlScroll, Framer, ROW_H, SPACING } from "./lineup-camera";
import PacksMenu, { packName } from "./lineup-packs-menu";
import PaintBar from "./lineup-paint";
import LineupFigure, { setPaused, type Pausable } from "./lineup-figure";
import { isPaintable, undoStroke, useBrush } from "./figure-paint";

const SCENARIOS: { id: Stance["scenario"]; label: string }[] = [
  { id: "standing", label: "Standing" },
  { id: "desk", label: "At a desk" },
  { id: "couch", label: "On a couch" },
];
const INPUTS: { id: Stance["input"]; label: string }[] = [
  { id: "keyboard", label: "Mouse & KB" },
  { id: "gamepad", label: "Gamepad" },
  { id: "handheld", label: "Handheld" },
];
const TURNS = [
  { label: "Front", deg: 0 },
  { label: "Three-quarter", deg: 35 },
  { label: "Side", deg: 90 },
  { label: "Back", deg: 180 },
];

/**
 * Every local candidate at once, one row per pack, for picking a figure and
 * comparing palette variants across the pack (dev only, opened from the
 * audition picker). Pose, input, camera angle and palette are menus that
 * apply to every figure; the Packs menu chooses which rows show. The camera
 * looks straight at the rows: drag pans, the wheel zooms toward the cursor,
 * Fit frames everything shown. Clicking a figure selects it in the main
 * view and closes the lineup; Escape closes.
 */
export default function AuditionLineup({
  onClose,
  packs = null,
}: {
  onClose: () => void;
  /** Show only packs whose names contain one of these words (lower case); null shows all. */
  packs?: string[] | null;
}) {
  const local = useAuditionStore((s) => s.local);
  const candidate = useAuditionStore((s) => s.candidate);
  const setCandidate = useAuditionStore((s) => s.setCandidate);
  const palettes = useAuditionStore((s) => s.palettes);
  const palette = useAuditionStore((s) => s.palette);
  const setPalette = useAuditionStore((s) => s.setPalette);
  const [hover, setHover] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  // Left-drag on a figure turns every figure: start x, start angle, and the controls paused meanwhile.
  const spin = useRef<{
    x0: number;
    t0: number;
    controls: Pausable | null;
  } | null>(null);
  const turnRef = useRef(0);
  useEffect(() => {
    turnRef.current = turn;
  });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const sp = spin.current;
      if (sp) setTurn(Math.round(sp.t0 + (e.clientX - sp.x0) * 0.6));
    };
    const up = () => {
      if (spin.current) setPaused(spin.current.controls, false);
      spin.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  const startSpin = (x: number, controls: Pausable | null) => {
    setPaused(controls, true);
    spin.current = { x0: x, t0: turnRef.current, controls };
  };
  const [stance, setStance] = useState<Stance>({
    scenario: "standing",
    input: "keyboard",
  });
  const [fit, setFit] = useState(0);
  const [litPref, setLit] = useState(true);
  // Painting is unlit, so every facet shows the exact color of its swatch.
  const brushOn = useBrush((s) => s.on);
  const lit = litPref && !brushOn;
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (!packs) return new Set();
    const groups = new Set(local.map((c) => c.group ?? "Local"));
    return new Set(
      [...groups].filter(
        (g) => !packs.some((w) => g.toLowerCase().includes(w)),
      ),
    );
  });
  // The canvas mounts once its container exists, so pointer events attach to a real element.
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of local)
      map.set(c.group ?? "Local", [...(map.get(c.group ?? "Local") ?? []), c]);
    return [...map.entries()];
  }, [local]);
  const shown = rows.filter(([g]) => !hidden.has(g));
  const widest = Math.max(1, ...shown.map(([, items]) => items.length));
  const chosen = palettes.find((p) => p.id === palette);
  const count = shown.reduce((n, [, items]) => n + items.length, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      // P toggles paint mode (not while typing in a field).
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "SELECT" ||
          t.tagName === "TEXTAREA");
      if (
        (e.key === "p" || e.key === "P") &&
        !typing &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.stopImmediatePropagation();
        useBrush.getState().set({ on: !useBrush.getState().on });
      }
      // Ctrl+Z (Cmd+Z on a Mac) undoes the last paint stroke while painting.
      if (
        (e.key === "z" || e.key === "Z") &&
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        !typing &&
        useBrush.getState().on
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        undoStroke();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const pick = (id: string) => setCandidate(id);
  const setPacks = (next: Set<string>) => {
    setHidden(next);
    setFit((n) => n + 1);
  };
  const selectClass =
    "rounded border border-border bg-background px-1 text-foreground";

  return (
    <div
      data-chrome
      className="fixed inset-0 z-50 bg-[oklch(0.16_0_0)] font-mono text-xs text-muted-foreground"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 border-b border-border bg-[oklch(0.16_0_0)]/90 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-foreground">
            Lineup: {count} of {local.length} figures
          </span>
          <PacksMenu
            groups={rows.map(([g, items]) => [g, items.length])}
            hidden={hidden}
            onChange={setPacks}
            className={selectClass}
          />
          <label className="flex items-center gap-1">
            Pose
            <select
              className={selectClass}
              value={stance.scenario}
              onChange={(e) =>
                setStance((s) => ({
                  ...s,
                  scenario: e.target.value as Stance["scenario"],
                }))
              }
            >
              {SCENARIOS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Input
            <select
              className={selectClass}
              value={stance.input}
              onChange={(e) =>
                setStance((s) => ({
                  ...s,
                  input: e.target.value as Stance["input"],
                }))
              }
            >
              {INPUTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Camera
            <select
              className={selectClass}
              value={TURNS.some((t) => t.deg === turn) ? turn : "custom"}
              onChange={(e) => setTurn(Number(e.target.value))}
            >
              {TURNS.some((t) => t.deg === turn) ? null : (
                <option value="custom">{`Dragged (${((turn % 360) + 360) % 360} deg)`}</option>
              )}
              {TURNS.map((t) => (
                <option key={t.label} value={t.deg}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Palette
            <select
              className={selectClass}
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
            >
              <option value="">model default</option>
              {palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`px-2 ${selectClass}`}
            onClick={() => setFit((n) => n + 1)}
          >
            Fit
          </button>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={litPref}
              disabled={brushOn}
              title={
                brushOn ? "Painting is unlit so swatch colors match" : undefined
              }
              onChange={(e) => setLit(e.target.checked)}
            />
            Lighting
          </label>
          <span className="ml-auto text-foreground">
            {hover ? local.find((c) => c.id === hover)?.label : ""}
          </span>
          <button
            type="button"
            className={`px-2 ${selectClass}`}
            onClick={onClose}
          >
            Close (Esc)
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PaintBar className={selectClass} />
          <span>
            drag to pan · drag a figure to turn them all (Ctrl+drag while
            painting) · scroll to zoom · Ctrl+scroll to scroll (Shift sideways)
            · click a figure to select it
          </span>
        </div>
      </div>
      <div
        ref={setHost}
        data-lineup-host
        className="absolute inset-0 overflow-hidden"
      >
        {host ? (
          // flat: no tone mapping, so a painted facet shows the picked color exactly (with Lighting off).
          <Canvas eventSource={host} dpr={[1, 2]} flat>
            <OrthographicCamera
              makeDefault
              position={[0, 0, 3000]}
              near={10}
              far={10000}
            />
            <color attach="background" args={["#1e1e20"]} />
            {lit ? (
              <>
                <hemisphereLight args={["#ffffff", "#444444", 1.6]} />
                <directionalLight position={[300, 800, 900]} intensity={1.8} />
              </>
            ) : (
              // Unlit: an even ambient at pi shows each swatch at its exact color.
              <ambientLight intensity={Math.PI} />
            )}
            <OrbitControls
              makeDefault
              enableRotate={false}
              screenSpacePanning
              zoomToCursor
              mouseButtons={{
                LEFT: MOUSE.PAN,
                MIDDLE: MOUSE.DOLLY,
                RIGHT: MOUSE.PAN,
              }}
            />
            <Framer fit={fit} rows={shown.length} widest={widest} />
            <CtrlScroll />
            {shown.map(([group, items], r) => {
              const y = -r * ROW_H;
              return (
                <group key={group}>
                  <Html
                    position={[-SPACING * 0.75, y + 100, 0]}
                    style={{ pointerEvents: "none" }}
                  >
                    <div className="-translate-x-full -translate-y-1/2 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
                      {packName(group)}
                    </div>
                  </Html>
                  <mesh
                    position={[((items.length - 1) * SPACING) / 2, y - 1, 0]}
                  >
                    <boxGeometry args={[items.length * SPACING, 2, 60]} />
                    <meshStandardMaterial color="#34343a" />
                  </mesh>
                  {items.map((c, i) => (
                    <Suspense key={c.id} fallback={null}>
                      <LineupFigure
                        c={c}
                        position={[i * SPACING, y, 0]}
                        turn={turn}
                        stance={stance}
                        paletteUrl={
                          chosen && c.texture && !isPaintable(c)
                            ? assetUrl(chosen.file)
                            : textureUrl(c)
                        }
                        selected={c.id === candidate}
                        hovered={c.id === hover}
                        onHover={setHover}
                        onPick={pick}
                        onSpin={startSpin}
                      />
                    </Suspense>
                  ))}
                </group>
              );
            })}
          </Canvas>
        ) : null}
      </div>
    </div>
  );
}
