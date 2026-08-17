"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { Hotkeys } from "@/components/hotkeys";
import { DisplayArea } from "@/components/display-area";
import { CvdFilters, cvdFilter } from "@/components/cvd-filters";
import { WorkbenchPanel } from "@/components/panels/workbench";
import { DeviceInspector } from "@/components/panels/device-inspector";
import { MEDIA_DRAG_MIME } from "@/components/panels/media-library";
import { DeviceDetailWindows } from "@/components/panels/device-detail-windows";
import { ComparisonTablePanel } from "@/components/panels/comparison-table";
import { InfoPanel } from "@/components/panels/info-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { Onboarding } from "@/components/onboarding";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { useResolvedTheme } from "@/lib/use-theme";
import {
  disposeEngine,
  ensureEngine,
  isAnimatedItem,
} from "@/lib/playback-engine";

const SceneView = dynamic(() => import("@/components/view3d/scene-view"), {
  ssr: false,
});

export default function Home() {
  const hydrate = useMediaStore((s) => s.hydrate);
  const addFiles = useMediaStore((s) => s.addFiles);
  const theme = useResolvedTheme();
  const viewMode = useUiStore((s) => s.viewMode);
  const cvdMode = useSettingsStore((s) => s.cvdMode);
  const [dropScrim, setDropScrim] = useState(false);
  // 3D stays mounted through its exit animation so the camera can fly
  // back to the head-on pose before the 2D overlay returns. The 2D view
  // is ALWAYS mounted beneath it, so both handoffs are crossfades of
  // the canvas over a live matching frame instead of a mount pop.
  const [show3d, setShow3d] = useState(viewMode === "3d");
  const [sceneShown, setSceneShown] = useState(viewMode === "3d");
  const [exiting3d, setExiting3d] = useState(false);
  const [prevMode, setPrevMode] = useState(viewMode);
  const handoffTimer = useRef<number | null>(null);
  if (viewMode !== prevMode) {
    setPrevMode(viewMode);
    if (viewMode === "3d") {
      setShow3d(true);
      setExiting3d(false);
    } else if (show3d) {
      setExiting3d(true);
    }
  }
  // Re-entering 3D while the exit fade-out is still pending must cancel
  // the deferred unmount.
  useEffect(() => {
    if (viewMode === "3d" && handoffTimer.current !== null) {
      window.clearTimeout(handoffTimer.current);
      handoffTimer.current = null;
    }
  }, [viewMode]);
  // Mount the canvas transparent, then flip visible a frame later so
  // the CSS transition fades it in over the matching 2D frame.
  useEffect(() => {
    if (show3d && !exiting3d && !sceneShown) {
      const raf = requestAnimationFrame(() => setSceneShown(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [show3d, exiting3d, sceneShown]);
  // Everything below renders from persisted client state; skipping SSR
  // output entirely avoids hydration mismatches on the static export.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The playback engine follows the active media item.
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const videoUrls = useMediaStore((s) => s.videoUrls);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  useEffect(() => {
    const item = items.find((i) => i.id === activeId) ?? null;
    if (item && isAnimatedItem(item)) {
      void ensureEngine(
        item,
        item.kind === "video" ? videoUrls[item.id] : objectUrls[item.id],
      );
    } else {
      disposeEngine();
    }
  }, [items, activeId, videoUrls, objectUrls]);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Whole-window image drop, anywhere — the media panel need not be open.
  // Internal library reorders carry their own MIME and must never be
  // mistaken for an import.
  const isFileDrag = (e: DragEvent | React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types ?? []);
    return types.includes("Files") && !types.includes(MEDIA_DRAG_MIME);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDropScrim(true);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setDropScrim(false);
      if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  return (
    <main
      className="relative h-dvh w-full overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        // Only clear when leaving the window, not moving between children.
        if (e.relatedTarget === null) setDropScrim(false);
      }}
      onDrop={onDrop}
    >
      {!mounted ? null : (
        <>
          <CvdFilters />
          {/* Color-vision simulation wraps BOTH view layers (panels and
              chrome stay unfiltered — the simulation is about content). */}
          <div
            className="absolute inset-0"
            style={{ filter: cvdFilter(cvdMode) }}
          >
            {/* `isolate` contains the 2D view's internal z-indexes (rect
                stack, toolbar z-40) in their own stacking context, so the
                later canvas sibling paints over ALL of it in 3D mode. */}
            <div className="absolute inset-0 isolate">
              <DisplayArea />
            </div>
            {show3d ? (
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-150",
                  sceneShown ? "opacity-100" : "opacity-0",
                )}
              >
                <SceneView
                  exiting={exiting3d}
                  onExited={() => {
                    // The camera flew to a head-on pose matching 2D's OWN
                    // framing (mode + pan untouched) — just reveal it.
                    setSceneShown(false);
                    handoffTimer.current = window.setTimeout(() => {
                      handoffTimer.current = null;
                      setShow3d(false);
                      setExiting3d(false);
                    }, 180);
                  }}
                />
              </div>
            ) : null}
          </div>
        </>
      )}

      {mounted ? (
        <>
          <Hotkeys />
          <Sidebar />
          <WorkbenchPanel />
          <DeviceInspector />
          <DeviceDetailWindows />
          <ComparisonTablePanel />
          <InfoPanel />
          <SettingsPanel />
          <Onboarding />
        </>
      ) : null}

      {dropScrim ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-ring bg-background/60 text-sm">
          Drop images to add them to the library
        </div>
      ) : null}
    </main>
  );
}
