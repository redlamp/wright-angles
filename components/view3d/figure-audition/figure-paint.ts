"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BufferAttribute,
  Color,
  type BufferGeometry,
  type Material,
  type Mesh,
} from "three";
import type { Candidate } from "./candidates";

/**
 * Facet painting for kit-bashed figures (dev only, local only). A paint is
 * a color per triangle, keyed by candidate, then by "<mesh index>:<mesh
 * name>" in the rig's mesh list, then by triangle index: rigs make their
 * geometry non-indexed, so triangle i is vertices 3i..3i+2 in both the
 * lineup and the main view. Painted triangles point their UVs at the
 * kit-bash palette's reserved white block and take the color as a vertex
 * color; unpainted ones keep their swatch (vertex color white).
 */
export type FigurePaint = Record<string, Record<string, string>>;

/** glTF UV of the white block kitbash.py reserves (the last 8x8 block of its 64x64 swatch texture). */
const WHITE_UV = [0.9375, 0.9375] as const;

/** Only kit-bashed figures have the reserved white block. */
export const isPaintable = (c: Candidate) => c.file.startsWith("local/de/");

interface PaintState {
  paints: Record<string, FigurePaint>;
  /** Set (or with null, clear) a list of triangles on one mesh. */
  setFaces: (
    id: string,
    meshKey: string,
    tris: number[],
    hex: string | null,
  ) => void;
  clearFigure: (id: string) => void;
  replaceAll: (paints: Record<string, FigurePaint>) => void;
}

export const usePaintStore = create<PaintState>()(
  persist(
    (set) => ({
      paints: {},
      setFaces: (id, meshKey, tris, hex) =>
        set((s) => {
          const fig = { ...(s.paints[id] ?? {}) };
          const m = { ...(fig[meshKey] ?? {}) };
          for (const t of tris) {
            if (hex) m[t] = hex;
            else delete m[t];
          }
          fig[meshKey] = m;
          return { paints: { ...s.paints, [id]: fig } };
        }),
      clearFigure: (id) =>
        set((s) => {
          const next = { ...s.paints };
          delete next[id];
          return { paints: next };
        }),
      replaceAll: (paints) => set({ paints }),
    }),
    { name: "wright-angles:figure-paint", version: 1 },
  ),
);

export const meshKey = (meshes: { mesh: Mesh }[], mesh: Mesh) => {
  const i = meshes.findIndex((m) => m.mesh === mesh);
  return i < 0 ? null : `${i}:${mesh.name}`;
};

const _c = new Color();

/** Write a figure's paint into its geometry (colors and UVs), resetting whatever was painted before. */
export function applyPaint(
  meshes: { mesh: Mesh }[],
  paint: FigurePaint | undefined,
) {
  meshes.forEach(({ mesh }, i) => {
    const key = `${i}:${mesh.name}`;
    const faces = paint?.[key];
    const geo = mesh.geometry as BufferGeometry;
    const uv = geo.getAttribute("uv") as BufferAttribute | undefined;
    if (!uv) return;
    if (!faces && !geo.userData.uv0) return; // never painted: leave it alone
    if (!geo.userData.uv0)
      geo.userData.uv0 = (uv.array as Float32Array).slice();
    const uv0 = geo.userData.uv0 as Float32Array;
    const n = uv.count;
    let col = geo.getAttribute("color") as BufferAttribute | undefined;
    if (!col || col.count !== n) {
      col = new BufferAttribute(new Float32Array(n * 3).fill(1), 3);
      geo.setAttribute("color", col);
    }
    (uv.array as Float32Array).set(uv0);
    (col.array as Float32Array).fill(1);
    for (const [tri, hex] of Object.entries(faces ?? {})) {
      _c.set(hex).convertSRGBToLinear();
      for (let k = 0; k < 3; k++) {
        const v = Number(tri) * 3 + k;
        if (v >= n) continue;
        uv.setXY(v, WHITE_UV[0], WHITE_UV[1]);
        col.setXYZ(v, _c.r, _c.g, _c.b);
      }
    }
    uv.needsUpdate = true;
    col.needsUpdate = true;
    for (const m of (Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) as (Material & { vertexColors: boolean })[]) {
      if (!m.vertexColors) {
        m.vertexColors = true;
        m.needsUpdate = true;
      }
    }
  });
}

/** Triangles on the same mesh that wear the same swatch as `tri` (its original UV), for the fill brush. */
export function samePart(mesh: Mesh, tri: number): number[] {
  const geo = mesh.geometry as BufferGeometry;
  const uv = geo.getAttribute("uv") as BufferAttribute;
  const src =
    (geo.userData.uv0 as Float32Array | undefined) ??
    (uv.array as Float32Array);
  const key = (t: number) =>
    `${src[t * 6].toFixed(3)},${src[t * 6 + 1].toFixed(3)}`;
  const want = key(tri);
  const out: number[] = [];
  for (let t = 0; t < uv.count / 3; t++) if (key(t) === want) out.push(t);
  return out;
}

/** One painted triangle's previous color, for undo; entries from one stroke undo together. */
interface UndoEntry {
  stroke: number;
  id: string;
  key: string;
  tri: number;
  prev: string | null;
}

interface BrushState {
  on: boolean;
  color: string;
  /** Fill every triangle that wears the same swatch, instead of one facet. */
  fill: boolean;
  stroke: number;
  undo: UndoEntry[];
  set: (b: Partial<Pick<BrushState, "on" | "color" | "fill">>) => void;
  startStroke: () => void;
  record: (entries: Omit<UndoEntry, "stroke">[]) => void;
  /** Undo the last stroke: returns its entries, newest first, for the caller to write back. */
  popStroke: () => UndoEntry[];
}

/** The lineup's brush and undo history (not persisted). */
export const useBrush = create<BrushState>()((set, get) => ({
  on: false,
  color: "#c9541c",
  fill: false,
  stroke: 0,
  undo: [],
  set: (b) => set(b),
  startStroke: () => set((s) => ({ stroke: s.stroke + 1 })),
  record: (entries) =>
    set((s) => ({
      undo: [
        ...s.undo,
        ...entries.map((e) => ({ ...e, stroke: s.stroke })),
      ].slice(-5000),
    })),
  popStroke: () => {
    const u = get().undo;
    if (!u.length) return [];
    const last = u[u.length - 1].stroke;
    set({ undo: u.filter((e) => e.stroke !== last) });
    return u.filter((e) => e.stroke === last).reverse();
  },
}));

/** Paint the facet (or, with fill, the part) under the brush; records undo. */
export function paintFacet(
  id: string,
  meshes: { mesh: Mesh }[],
  mesh: Mesh,
  tri: number,
) {
  const { color, fill, record } = useBrush.getState();
  const key = meshKey(meshes, mesh);
  if (key === null) return;
  const tris = fill ? samePart(mesh, tri) : [tri];
  const cur = usePaintStore.getState().paints[id]?.[key] ?? {};
  const todo = tris.filter((t) => cur[t] !== color);
  if (!todo.length) return;
  record(todo.map((t) => ({ id, key, tri: t, prev: cur[t] ?? null })));
  usePaintStore.getState().setFaces(id, key, todo, color);
}

/** Undo the last stroke. */
export function undoStroke() {
  const { setFaces } = usePaintStore.getState();
  for (const e of useBrush.getState().popStroke())
    setFaces(e.id, e.key, [e.tri], e.prev);
}
