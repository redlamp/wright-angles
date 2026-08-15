"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Sidebar } from "@/components/sidebar";
import { DisplayArea } from "@/components/display-area";
import { DeviceManagerPanel } from "@/components/panels/device-manager";
import { DeviceDetailWindows } from "@/components/panels/device-detail-windows";
import { MediaLibraryPanel } from "@/components/panels/media-library";
import { PerceptionReportPanel } from "@/components/panels/perception-report";
import { ComparisonTablePanel } from "@/components/panels/comparison-table";
import { InfoPanel } from "@/components/panels/info-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { Onboarding } from "@/components/onboarding";
import { useMediaStore } from "@/stores/media-store";
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
  const [dropScrim, setDropScrim] = useState(false);
  // 3D stays mounted through its exit animation so the camera can fly
  // back to the head-on pose before the 2D overlay returns.
  const [show3d, setShow3d] = useState(viewMode === "3d");
  const [exiting3d, setExiting3d] = useState(false);
  const [prevMode, setPrevMode] = useState(viewMode);
  if (viewMode !== prevMode) {
    setPrevMode(viewMode);
    if (viewMode === "3d") {
      setShow3d(true);
      setExiting3d(false);
    } else if (show3d) {
      setExiting3d(true);
    }
  }
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
  const isFileDrag = (e: DragEvent | React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

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
      {!mounted ? null : show3d ? (
        <div className="absolute inset-0 duration-300 animate-in fade-in">
          <SceneView
            exiting={exiting3d}
            onExited={() => {
              setShow3d(false);
              setExiting3d(false);
            }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 duration-300 animate-in fade-in">
          <DisplayArea />
        </div>
      )}

      {mounted ? (
        <>
          <Sidebar />
          <DeviceManagerPanel />
          <DeviceDetailWindows />
          <MediaLibraryPanel />
          <PerceptionReportPanel />
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
