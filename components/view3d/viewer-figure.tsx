"use client";

/** Eye level of the standing figure (cm); device rects center on this. */
export const EYE_HEIGHT_CM = 150;

const FIGURE_GRAY = "#b6b6b6";

/**
 * Stylized standing human at the origin, ~162cm tall with eyes at
 * EYE_HEIGHT_CM. Unlit on purpose — the scene has no lighting rig.
 */
export default function ViewerFigure() {
  return (
    <group>
      {/* Body capsule: radius 14 + length 110 → top at 138, under the head. */}
      <mesh position={[0, 69, 0]}>
        <capsuleGeometry args={[14, 110, 8, 16]} />
        <meshBasicMaterial color={FIGURE_GRAY} />
      </mesh>
      <mesh position={[0, EYE_HEIGHT_CM, 0]}>
        <sphereGeometry args={[12, 24, 16]} />
        <meshBasicMaterial color={FIGURE_GRAY} />
      </mesh>
    </group>
  );
}
