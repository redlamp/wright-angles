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
import { MediaLibraryPanel } from "@/components/panels/media-library";
import { PerceptionReportPanel } from "@/components/panels/perception-report";
import { InfoPanel } from "@/components/panels/info-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { Onboarding } from "@/components/onboarding";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";

const SceneView = dynamic(() => import("@/components/view3d/scene-view"), {
  ssr: false,
});

export default function Home() {
  const hydrate = useMediaStore((s) => s.hydrate);
  const addFiles = useMediaStore((s) => s.addFiles);
  const theme = useSettingsStore((s) => s.theme);
  const viewMode = useUiStore((s) => s.viewMode);
  const [dropScrim, setDropScrim] = useState(false);
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
      {!mounted ? null : viewMode === "2d" ? (
        <DisplayArea />
      ) : (
        <div className="absolute inset-0">
          <SceneView />
        </div>
      )}

      {mounted ? (
        <>
          <Sidebar />
          <DeviceManagerPanel />
          <MediaLibraryPanel />
          <PerceptionReportPanel />
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
