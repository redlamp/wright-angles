/**
 * Analytic two-bone IK on plain vectors, for rigs whose segment lengths
 * come from the model rather than from authored constants. Pure: no
 * three.js, no DOM. Same solve as the capsule figure's applyArm, which
 * keeps its own copy tied to its fixed UPPER/FORE spans.
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3) => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : mul(a, 1 / l);
};

export interface TwoBoneSolve {
  /** Joint between the two segments (elbow or knee). */
  mid: V3;
  /** End effector after clamping the reach (wrist or ankle). */
  end: V3;
  /** True when the target was out of reach and the chain points at it. */
  clamped: boolean;
}

/**
 * Place a two-segment chain from `root` toward `target`, bending toward
 * `pole`. Out-of-reach targets keep their direction and the chain
 * stretches just short of straight, so a limb points ALONG the line to
 * a far device instead of snapping to it (the capsule figure's rule).
 */
export function solveTwoBone(
  root: V3,
  target: V3,
  upperLen: number,
  lowerLen: number,
  pole: V3,
): TwoBoneSolve {
  const toTarget = sub(target, root);
  const raw = len(toTarget);
  const maxReach = (upperLen + lowerLen) * 0.995;
  const minReach = Math.max(Math.abs(upperLen - lowerLen) + 1e-3, 1e-3);
  const d = Math.min(Math.max(raw, minReach), maxReach);
  let dir = norm(toTarget);
  if (len(dir) === 0) dir = { x: 0, y: -1, z: 0 };
  const end = add(root, mul(dir, d));

  const cosA = Math.min(
    1,
    Math.max(-1, (upperLen * upperLen + d * d - lowerLen * lowerLen) / (2 * upperLen * d)),
  );
  const a = Math.acos(cosA);
  // Bend plane: the pole hint with its component along the chain removed.
  let bend = sub(pole, mul(dir, dot(pole, dir)));
  if (len(bend) < 1e-6) bend = sub({ x: 0, y: 0, z: -1 }, mul(dir, -dir.z));
  bend = norm(bend);
  const mid = add(add(root, mul(dir, Math.cos(a) * upperLen)), mul(bend, Math.sin(a) * upperLen));
  return { mid, end, clamped: raw > maxReach };
}
