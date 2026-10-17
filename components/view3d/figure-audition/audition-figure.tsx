"use client";

import { Suspense, useDeferredValue, useMemo, type ComponentProps } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import ViewerFigure from "../viewer-figure";
import RiggedFigure from "./rigged-figure";
import { assetUrl, candidateUrl, findCandidate, textureUrl, type Candidate } from "./candidates";
import { preparePalette } from "./figure-regions";
import type { HandSources } from "./hand-graft";
import { useAuditionStore, type FigureLook } from "./audition-store";

type FigureProps = ComponentProps<typeof ViewerFigure>;
type RigProps = FigureProps & {
  candidate: Candidate;
  look: FigureLook;
  outfit: string;
  showRig: boolean;
  /** Palette variant id, or "" for the model's own. */
  variant: string;
};

/** Bumped when the hand files change: the loader caches by URL and the browser by path. */
const HAND_VERSION = 8;
const HAND_URLS = () => [assetUrl(`hands/hand-left.glb?v=${HAND_VERSION}`), assetUrl(`hands/hand-right.glb?v=${HAND_VERSION}`)];

/** The blocky three-digit hands (CC0, public/figures/audition/hands), for candidates that take them; null when switched off. */
function useHands(): HandSources | null {
  const swap = useAuditionStore((s) => s.swapHands);
  const [l, r] = useGLTF(HAND_URLS(), false, false);
  return useMemo(() => (swap ? { left: l.scene, right: r.scene } : null), [swap, l, r]);
}

/** A candidate whose glTF carries no texture reference: the manifest's palette is assigned. */
function TexturedFigure(props: RigProps & { url: string }) {
  const gltf = useGLTF(candidateUrl(props.candidate), false, false);
  const texture = useTexture(props.url, preparePalette);
  const hands = useHands();
  return <RiggedFigure source={gltf.scene} texture={texture} hands={hands} {...props} />;
}

function GltfFigure(props: RigProps) {
  // A chosen palette variant replaces the candidate's own palette; only
  // candidates that take a palette texture offer the choice.
  const palettes = useAuditionStore((s) => s.palettes);
  const chosen = props.candidate.texture ? palettes.find((p) => p.id === props.variant) : undefined;
  const url = chosen ? assetUrl(chosen.file) : textureUrl(props.candidate);
  if (url) return <TexturedFigure {...props} url={url} />;
  return <PlainFigure {...props} />;
}

function PlainFigure(props: RigProps) {
  const gltf = useGLTF(candidateUrl(props.candidate), false, false);
  const hands = useHands();
  return <RiggedFigure source={gltf.scene} hands={hands} {...props} />;
}

/**
 * The viewer figure, or the audition candidate picked in the dev
 * overlay. The capsule figure stands in only for the first load: model
 * and palette changes are deferred, so the figure on screen stays until
 * the next one is ready instead of flashing back to the capsules.
 */
export default function AuditionFigure(props: FigureProps) {
  const id = useDeferredValue(useAuditionStore((s) => s.candidate));
  const variant = useDeferredValue(useAuditionStore((s) => s.palette));
  const look = useAuditionStore((s) => s.look);
  const outfit = useAuditionStore((s) => s.outfit);
  const showRig = useAuditionStore((s) => s.showRig);
  const local = useAuditionStore((s) => s.local);
  const c = findCandidate(id, local);
  if (!c) return <ViewerFigure {...props} />;
  return (
    <Suspense fallback={<ViewerFigure {...props} />}>
      <GltfFigure
        key={c.id}
        {...props}
        candidate={c}
        look={look}
        outfit={outfit}
        showRig={showRig}
        variant={variant}
      />
    </Suspense>
  );
}
