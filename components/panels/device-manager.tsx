"use client";

import { useRef, useState } from "react";
import { CornerDownRightIcon } from "lucide-react";
import { useDeviceStore } from "@/stores/device-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { SplitGrid } from "./split-grid";
import { AddDeviceMenu } from "./device-manager/add-device-menu";
import { Microlabel } from "./device-manager/controls";
import { DeviceRow } from "./device-manager/device-row";
import { EditorColumn } from "./device-manager/editor-column";

export { DeviceEditor } from "./device-manager/device-editor";

/** Device Manager tab content (hosted by the workbench panel). */
export function DeviceManagerContent() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const openPanel = useUiStore((s) => s.openPanel);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const moveDevice = useDeviceStore((s) => s.moveDevice);
  const toggleVisible = useDeviceStore((s) => s.toggleVisible);
  const listRef = useRef<HTMLDivElement>(null);
  /** Where a dragged device will land on release (0..devices.length). */
  const [insertIdx, setInsertIdx] = useState<number | null>(null);

  const rowDragOver = (index: number) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-wa-device")) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setInsertIdx(e.clientY < r.top + r.height / 2 ? index : index + 1);
  };
  const rowDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData("application/x-wa-device");
    if (id && insertIdx !== null) {
      e.preventDefault();
      const from = devices.findIndex((d) => d.id === id);
      if (from >= 0) {
        moveDevice(id, insertIdx > from ? insertIdx - 1 : insertIdx);
      }
    }
    setInsertIdx(null);
  };
  const clearMarker = () => setInsertIdx(null);

  return (
    <SplitGrid
      left={
      <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-x-clip overflow-y-scroll">
        <div className="px-2.5 pt-2 pb-1">
          <Microlabel>This device</Microlabel>
        </div>
        <DeviceRow
          device={thisDevice}
          onToggleVisible={() =>
            updateThisDevice({ visible: !thisDevice.visible })
          }
        />
        <div className="mt-1 border-t border-border px-2.5 pt-2 pb-1">
          <Microlabel>Test devices</Microlabel>
        </div>
        <div
          ref={listRef}
          className="divide-y divide-border/50"
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              clearMarker();
            }
          }}
        >
          {devices.map((d, i) => (
            <DeviceRow
              key={d.id}
              device={d}
              onToggleVisible={() => toggleVisible(d.id)}
              reorder={{
                onDragOver: rowDragOver(i),
                onDrop: rowDrop,
                onDragEnd: clearMarker,
                markerTop: insertIdx === i,
                markerBottom: i === devices.length - 1 && insertIdx === devices.length,
              }}
            />
          ))}
        </div>
      </div>
      {/* Pinned to the bottom of the column, like the report's spec
          strip: add-device plus the comparison-table link (which
          opens from here now, not the rail). */}
      <div className="shrink-0 space-y-1.5 border-t border-border p-2.5">
        <AddDeviceMenu />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => openPanel("table")}
        >
          <CornerDownRightIcon className="size-4" /> Comparison Table
        </Button>
      </div>
      </div>
      }
      right={<EditorColumn />}
    />
  );
}
