---
tags: [domain/cartography, domain/3d-visualization, origin/external-research, status/draft]
---

# Label Placement & Decluttering for 3D Annotations

Preventing overlap of billboarded text labels anchored to points at varying depths in 3D scenes. Current Wright Angles implementation clusters labels in world space at build time; this note surveys established approaches and proposes a phased path to real-time screen-space decluttering.

## Cartographic Conventions

### Imhof's Principles (1962)

[Imhof's foundational rules](https://www.researchgate.net/figure/mhofs-31-model-for-positional-prioritization-of-point-feature-labeling_fig4_263859497) for label placement remain the gold standard across cartography and GIS. Labels should: (1) be legible; (2) associate clearly with the feature; (3) not overlap map content; (4) reflect the feature's extent; (5) use hierarchy via typeface/weight; (6) avoid dense clustering or even dispersion. The principles are deliberately qualitative to permit domain-specific tuning.

### 8-Position Point Label Model

The standard model (also called the 8-compass or cardinal+corner model) places candidate labels at the 8 positions around a point's bounding box: top-left, top, top-right, right, bottom-right, bottom, bottom-left, left. [Imhof's original 5-position variant](https://arxiv.org/html/2407.11996) favored top-right, reflecting Latin typography (ascenders > descenders). Contemporary practice varies in priority order, though top-right and right remain conventional preferences for left-to-right reading.

The 8-position model is often called a Position Priority Order (PPO) in the literature—a ranked list of candidate placements tried in sequence during layout computation.

## Automatic Label Placement Algorithms

All approaches trade speed against quality. Survey source: [Wolff's comprehensive dissertation](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/w-alptp-99.pdf) (Würzburg, 1999); more recent algorithms in [Legible Label Layout for Data Visualization](https://arxiv.org/pdf/2405.10953).

### Greedy Cycling (Simplest)

**Approach:** Walk the ordered label set; for each label, try candidate positions in priority order; place the first position with no collision, or leave it unplaced if all fail.

**Pros:** Extremely fast (10,000 labels in milliseconds); deterministic and stable; easy to implement.

**Cons:** Gets stuck in local minima; later labels lose options if early labels consume space; order-dependent (reordering produces different results).

**Runtime:** O(n × k) where n = label count, k = candidate positions (typically 4–8).

### Simulated Annealing

**Approach:** Iteratively adjust the label layout by proposing random moves (swap positions, toggle visibility). Accept all improving moves and some degrading moves per a temperature schedule; temperature decreases over time, eventually converging to a local optimum.

**Pros:** Escapes local minima better than greedy; can find higher-quality layouts; well-studied for decades.

**Cons:** Slow (iterative); requires tuning cooling schedule, initial temperature, move probabilities; not suitable for real-time interaction or dense labels.

**Runtime:** Proportional to iteration count × cost per iteration; typically milliseconds for 100–500 labels, seconds for 1000+.

### Force-Directed / Repulsion

**Approach:** Model labels as particles in a force field: springs pull labels toward their anchors, repulsion forces push overlapping labels apart. Iteratively move labels according to net force until equilibrium.

**Pros:** Intuitive physics metaphor; can produce visually pleasing layouts; parallelizable.

**Cons:** Tuning spring/repulsion constants is empirical; not always faster than simulated annealing; can oscillate if damping is poor.

**Runtime:** Similar to simulated annealing; depends on convergence criteria and iteration count.

### 0-1 Integer Programming

**Approach:** Formulate label placement as an integer linear program: maximize a preference score (e.g., distance to anchor, position priority) subject to non-overlap constraints. Solve via branch-and-bound or constraint propagation.

**Pros:** Guarantees optimal or near-optimal solution within time/iteration budget.

**Cons:** Very slow for dense scenarios; requires specialized solvers (CPLEX, SCIP); not interactive.

**Runtime:** Exponential worst-case; practical for tens to hundreds of labels.

## 3D Screen-Space Approaches

Label overlap in 3D is best detected in screen space: project anchor points to 2D, test bounding boxes/circles for collision per frame. This decouples layout from camera pose.

### Mapbox GL (Web Maps, Real-time)

[Mapbox GL collision detection](https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/) uses a global viewport-based grid (not per-tile) to enable cross-source collision and variable placement. Key properties:

- **`text-allow-overlap`** and **`icon-allow-overlap`** (default false): whether to display overlapping symbols.
- **`text-variable-anchor`**: array of fallback positions tried in order at collision-detection time.
- **`text-radial-offset`** and **`text-justify`**: fine-tune position and alignment.
- **`symbol-sort-key`**: prioritize which labels render when collisions occur (draw order).

Algorithm: for each symbol in sorted order, insert its bounding rectangle into a spatial grid; if insertion succeeds, mark space as used; if collision occurs, mark the symbol "collided" and skip. Variable-anchor fallback tries the next position before giving up. Collision circles are computed at runtime for line labels to account for zoom-dependent text size.

**Integration model:** Stateless per-frame; collision result depends only on viewport, current zoom, camera position, label content—not on previous frames. Enables smooth fade-in/-out as camera moves.

### deck.gl CollisionFilterExtension (GPU-based, Real-time)

[deck.gl's CollisionFilterExtension](https://deck.gl/docs/api-reference/extensions/collision-filter-extension) uses GPU rasterization for collision detection:

- **Method:** Render all features to a screen-space collision buffer; for each feature, test whether its anchor point is occupied (point-in-polygon rasterized test).
- **Trade-off:** Anchor-point test is faster but less precise than full bounding-box test; sufficient for sparse label layouts.
- **Performance:** Real-time at 60 fps on dense point clouds (10k+ points) because tests run on GPU each frame.
- **Collision groups:** Define which layers collide with which, allowing selective decluttering.

### Cesium (3D Globe, Dynamic)

[Cesium's declutter roadmap](https://github.com/CesiumGS/cesium/issues/1097) and community notes describe several strategies:

- **Max-label budget:** Set a maximum label count per frame; priority culling selects the "best" labels (e.g., selected > this device > nearest) and hides others.
- **Leader lines:** Draw a line from a hidden/displaced label to its world-space anchor so the user can trace it.
- **Separation vector approach:** Use force vectors and bounding-box separating-axis theorem (SAT) to compute collision separation; allow labels to move up to a threshold distance, then go transparent or hide.
- **Keep-out zones:** Define 2D screen regions (e.g., HUD areas, credits) that labels cannot enter.

These strategies are prioritized by user preference and computational budget; no single unified algorithm is currently default in Cesium.

## Leader Lines & Callouts

[Cartographic best practice](https://slcc.pressbooks.pub/maps/chapter/9-4/): use a line from the label to its anchor point only when the label is forced to displace. Guidelines:

- Never touch the point symbol; no arrowheads.
- Consistent color and stroke throughout the map.
- Use sparingly—overuse creates visual clutter.
- Sparing use keeps legibility high; balance with masks/halos if needed.

Leader lines enable the viewer to trace a displaced label back to its feature, trading additional ink for reduced cognitive load when label density is high.

## What This Implies for Wright Angles

The current `computeLabelPlacements` function (components/view3d/scene-view.tsx, lines 140–218) runs at build time and clusters labels in world space using hyperbolic distance in (y, z) plane. It walks visible devices sorted by distance, groups those within ~1.5× label height, and alternates name labels left/right and stacks them upward; floor-distance labels alternate sides and stagger height by 7cm.

This approach works well for sparse layouts (< 10 devices) but fails when many devices cluster at similar distances (e.g., 10 handhelds at 36–40 cm + the TV at 270 cm): labels can overlap in screen space even if world-space clustering assigned different offsets.

## Implementation Plan: Phase 1 → Phase 2

### Phase 1: Screen-Space Collision at Camera Rest (Simplest, ~4–6 hours)

**Goal:** Prevent overlaps when the user stops rotating/panning; maintain the existing world-space clustering as a fallback for dense near-field cases.

**Strategy:** Greedy 8-position cycling in screen space, computed once per frame (or on-demand after camera settle timeout).

1. **Project anchors to screen:** Use Three.js camera.project() on each label's anchor point (centerY + nameY offset).
2. **Build candidate positions:** For each label, generate 8 positions (top-right, right, bottom-right, … bottom-left) offset by typical label bounding box (width ≈ device name length, height ≈ font size + line-height).
3. **Test AABB collision:** For each label (sorted by distance / priority), try candidates in order; test axis-aligned bounding-box overlap against all previously placed labels' bounding boxes.
4. **Place or fallback:** Use the first collision-free position; if none found, use the default (right-of-node) but mark as "collided" (e.g., fade to 50% opacity or hide).

**Code integration:**

- Extend `LabelPlacement` type (DeviceRect.tsx) to include `collided?: boolean` and screenPos?: {x, y} for debugging.
- Refactor `computeLabelPlacements` to accept optional camera + viewport context; compute screen-space AABB.
- Call during `useFrame` or in a callback when `OrbitControls` emits "end" event (camera at rest).
- Render name labels with conditional opacity: `opacity = collided ? 0.5 : 1.0` or conditional display.

**Advantages:** No external solver; greedy is fast; screen-space decouples from world geometry; visual stability (labels don't flicker as camera moves, only when user stops).

**Limitations:** Greedy order-dependence means sort-by-distance vs. sort-by-selected-status yields different results; deep occlusion (labels hidden by other rects) not handled; no leader lines yet.

### Phase 2: Priority Culling + Leader Lines (Incremental, ~6–8 hours)

**Goal:** Reduce label clutter by hiding low-priority labels and drawing leader lines for the hidden ones.

1. **Define priority:** `[selected, thisDevice, nearestK]` where K = configurable (default 3). Hide all other labels.
2. **Leader-line rendering:** For hidden labels, draw a line from the anchor point to a "off-screen proxy position" or a fixed callout box (e.g., bottom-left corner) and display the label there with transparency or outline.
3. **Interaction:** On click/select, that device's label comes back (priority 1) and others shift down.

**Code integration:**

- Add priority tier to Device or a selection context.
- Extend DeviceRect's rendering: conditional leader-line <Line> component if label is hidden but selected.
- Callout box could be a separate DOM overlay (like SceneHud) or a 3D text element in a fixed screen-space position.

**Advantages:** Massive simplification for crowded scenes (near-field cluster); clear hierarchy; eye can trace leader lines.

**Limitations:** Leader lines add visual complexity; callout box layout is a new problem; hidden labels lose detail until hover/select.

### Phase 2b (Optional): Simulated Annealing for Dense Scenes

If greedy+priority still leaves overlaps, run a single iteration of simulated annealing (low temperature, fast cooling) to improve layout after Phase 1. Practically useful only if user has 15+ devices visible at once; overkill for typical Wright Angles sessions (5–8 devices).

## References

- [Imhof Principles (ResearchGate)](https://www.researchgate.net/figure/mhofs-31-model-for-positional-prioritization-of-point-feature-labeling_fig4_263859497)
- [From Top-Right to User-Right: Perceptual Prioritization of Point-Feature Label Positions (arXiv:2407.11996)](https://arxiv.org/html/2407.11996)
- [Automated Label Placement Dissertation (Wolff, Würzburg 1999)](https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/w-alptp-99.pdf)
- [Legible Label Layout for Data Visualization (arXiv:2405.10953)](https://arxiv.org/pdf/2405.10953)
- [Automatic Label Placement - Wikipedia](https://en.wikipedia.org/wiki/Label_placement)
- [Mapbox GL Collision Detection & Variable Label Placement](https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/)
- [deck.gl CollisionFilterExtension](https://deck.gl/docs/api-reference/extensions/collision-filter-extension)
- [Cesium Declutter Roadmap (Issue #1097)](https://github.com/CesiumGS/cesium/issues/1097)
- [Cartographic Best Practice: Leader Lines & Callouts (SLCC Pressbooks)](https://slcc.pressbooks.pub/maps/chapter/9-4/)
- [Label Placement Algorithms for Automated Mapping](https://www.maplibrary.org/1398/label-placement-algorithms-for-automated-mapping/)
