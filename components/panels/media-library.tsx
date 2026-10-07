"use client";

import { useMediaStore } from "@/stores/media-store";
import { SplitGrid } from "./split-grid";
import { Toolbar } from "./media-library/toolbar";
import { LibraryList } from "./media-library/library-list";
import { DetailCard, DisplayFillRow } from "./media-library/detail-card";
import { AutoScanBanner, ImportErrorsBanner } from "./media-library/banners";

export { MEDIA_DRAG_MIME } from "./media-library/shared";

/** Media Library tab content (hosted by the workbench panel). */
export function MediaLibraryContent() {
  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const active = items.find((i) => i.id === activeId);
  const detailColumn = (
    // Scrollbar always reserved so incoming content (scan lists, crop
    // rows) doesn't pop the layout width (Taylor 2026-08-17).
    <div className="min-h-0 min-w-0 overflow-y-scroll">
      {active ? (
        <DetailCard key={active.id} item={active} />
      ) : (
        <p className="p-2.5 text-base text-muted-foreground">
          Select something in the library to see its details.
        </p>
      )}
      <DisplayFillRow />
    </div>
  );

  return (
    <SplitGrid
      // Library and active media scroll independently.
      left={
        <div className="min-h-0 min-w-0 overflow-y-auto">
          <Toolbar />
          <ImportErrorsBanner />
          <AutoScanBanner />
          <LibraryList />
        </div>
      }
      right={detailColumn}
    />
  );
}
