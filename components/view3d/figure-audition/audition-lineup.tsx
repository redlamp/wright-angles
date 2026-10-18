"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  Box3,
  Vector3,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import {
  assetUrl,
  candidateUrl,
  textureUrl,
  type Candidate,
} from "./candidates";
import { preparePalette } from "./figure-regions";
import { useAuditionStore } from "./audition-store";

/** Centimeters between figures in a row, and between rows (one row per set). */
const SPACING = 80;
const ROW_GAP = 280;

/**
 * Every local candidate standing at once, one row per set, for picking a
 * figure and comparing palette variants across the whole pack (dev only,
 * opened from the audition picker). The palette menu re-skins every figure
 * that takes a palette texture; clicking a figure selects it in the main
 * view and closes the lineup. Escape closes without changing anything.
 */
export default function AuditionLineup({ onClose }: { onClose: () => void }) {
  const local = useAuditionStore((s) => s.local);
  const candidate = useAuditionStore((s) => s.candidate);
  const setCandidate = useAuditionStore((s) => s.setCandidate);
  const palettes = useAuditionStore((s) => s.palettes);
  const palette = useAuditionStore((s) => s.palette);
  const setPalette = useAuditionStore((s) => s.setPalette);
  const [hover, setHover] = useState<string | null>(null);
  // The canvas mounts once its container exists, so pointer events attach to a real element.
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of local)
      map.set(c.group ?? "Local", [...(map.get(c.group ?? "Local") ?? []), c]);
    return [...map.entries()];
  }, [local]);
  const widest = Math.max(1, ...rows.map(([, items]) => items.length));
  const chosen = palettes.find((p) => p.id === palette);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const pick = (id: string) => {
    setCandidate(id);
    onClose();
  };
  const selectClass =
    "rounded border border-border bg-background px-1 text-foreground";
  const depth = (rows.length - 1) * ROW_GAP;

  return (
    <div
      data-chrome
      className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.16_0_0)] font-mono text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <span className="text-foreground">Lineup: {local.length} figures</span>
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
        <span>
          Up and down arrows cycle palettes · click a figure to use it · drag to
          orbit, scroll to zoom
        </span>
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
      <div ref={setHost} className="relative flex-1">
        {host ? (
          <Canvas
            eventSource={host}
            camera={{
              position: [0, 1050, depth + 850],
              fov: 40,
              near: 10,
              far: 20000,
            }}
            dpr={[1, 2]}
          >
            <color attach="background" args={["#1e1e20"]} />
            <hemisphereLight args={["#ffffff", "#444444", 1.6]} />
            <directionalLight position={[300, 800, 900]} intensity={1.8} />
            <OrbitControls makeDefault target={[0, 60, depth * 0.62]} />
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, depth / 2]}>
              <planeGeometry args={[widest * SPACING + 400, depth + 400]} />
              <meshStandardMaterial color="#2a2a2e" />
            </mesh>
            {rows.map(([group, items], r) => {
              const z = r * ROW_GAP;
              const x0 = -((items.length - 1) * SPACING) / 2;
              return (
                <group key={group}>
                  <Html
                    position={[x0 - SPACING, 90, z]}
                    center
                    style={{ pointerEvents: "none" }}
                  >
                    <div className="whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
                      {group.replace("Mega-Pack: ", "")}
                    </div>
                  </Html>
                  {items.map((c, i) => (
                    <Suspense key={c.id} fallback={null}>
                      <LineupFigure
                        c={c}
                        x={x0 + i * SPACING}
                        z={z}
                        paletteUrl={
                          chosen && c.texture
                            ? assetUrl(chosen.file)
                            : textureUrl(c)
                        }
                        selected={c.id === candidate}
                        hovered={c.id === hover}
                        onHover={setHover}
                        onPick={pick}
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

function LineupFigure({
  c,
  x,
  z,
  paletteUrl,
  selected,
  hovered,
  onHover,
  onPick,
}: {
  c: Candidate;
  x: number;
  z: number;
  paletteUrl: string | null;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const gltf = useGLTF(candidateUrl(c), false, false);
  const { obj, height } = useMemo(() => {
    const o = cloneSkinned(gltf.scene);
    o.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((x: Material) => x.clone())
        : mesh.material.clone();
      if (/icosphere/i.test(mesh.name)) mesh.visible = false;
    });
    // Feet on the ground, centered on its spot; meters scale up to centimeters.
    const box = new Box3().setFromObject(o);
    const size = box.getSize(new Vector3());
    const k = size.y < 10 ? 100 : 1;
    o.scale.setScalar(k);
    const center = box.getCenter(new Vector3());
    o.position.set(-center.x * k, -box.min.y * k, -center.z * k);
    return { obj: o, height: size.y * k };
  }, [gltf]);

  return (
    <group position={[x, 0, z]}>
      <primitive
        object={obj}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(c.id);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return; // an orbit drag, not a click
          e.stopPropagation();
          onPick(c.id);
        }}
      />
      {paletteUrl ? <Palette obj={obj} url={paletteUrl} /> : null}
      {selected || hovered ? (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.5, 0]}>
          <ringGeometry args={[26, 32, 40]} />
          <meshBasicMaterial color={selected ? "#22d3ee" : "#ffffff"} />
        </mesh>
      ) : null}
      {selected || hovered ? (
        <Html
          position={[0, height + 14, 0]}
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

/** Puts one palette texture on every material of a figure (palette textures are shared, loaded once per URL). */
function Palette({
  obj,
  url,
}: {
  obj: ReturnType<typeof cloneSkinned>;
  url: string;
}) {
  const tex = useTexture(url, preparePalette) as Texture;
  useEffect(() => {
    obj.traverse((m) => {
      const mesh = m as Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
        const sm = mat as MeshStandardMaterial;
        if (sm.map === tex) continue;
        sm.map = tex;
        sm.needsUpdate = true;
      }
    });
  }, [obj, tex]);
  return null;
}
