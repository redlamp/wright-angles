"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaStore } from "@/stores/media-store";
import { FloatingPanel } from "./floating-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REFERENCE_CHOICES = [720, 1080, 1440, 2160];

export function MediaLibraryPanel() {
  const items = useMediaStore((s) => s.items);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const activeId = useMediaStore((s) => s.activeId);
  const addFiles = useMediaStore((s) => s.addFiles);
  const remove = useMediaStore((s) => s.remove);
  const setActive = useMediaStore((s) => s.setActive);
  const setReferenceHeight = useMediaStore((s) => s.setReferenceHeight);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const active = items.find((i) => i.id === activeId);

  return (
    <FloatingPanel
      id="media"
      title="Media Library"
      icon={ImageIcon}
      defaultPosition={{ x: 420, y: 16 }}
      width={300}
    >
      <div className="space-y-2.5 p-2.5">
        <button
          type="button"
          className={cn(
            "panel-inset flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs text-muted-foreground transition-colors hover:text-foreground",
            dragOver && "border-ring text-foreground",
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <UploadIcon className="size-4" />
          Drop images or click to browse
          <span className="text-[10px] opacity-70">
            Stored in your browser only — never uploaded
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {items.length > 0 ? (
          <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "block aspect-video w-full overflow-hidden rounded-md border-2 bg-black/40",
                    item.id === activeId
                      ? "border-ring"
                      : "border-transparent opacity-80 hover:opacity-100",
                  )}
                  title={item.name}
                  onClick={() => setActive(item.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={objectUrls[item.id]}
                    alt={item.name}
                    className="size-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  className="absolute top-0.5 right-0.5 hidden size-5 items-center justify-center rounded bg-black/60 text-white/80 group-hover:flex hover:text-white"
                  onClick={() => void remove(item.id)}
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {active ? (
          <div className="panel-inset space-y-1.5 rounded-md px-2.5 py-2">
            <div className="truncate text-xs" title={active.name}>
              {active.name}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {active.width}×{active.height}
            </div>
            <label className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
              Reference size
              <Select
                value={String(active.referenceHeight)}
                onValueChange={(v) =>
                  setReferenceHeight(active.id, Number(v))
                }
              >
                <SelectTrigger size="sm" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([active.height, ...REFERENCE_CHOICES])]
                    .sort((a, b) => a - b)
                    .map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h}p{h === active.height ? " (native)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>
            <p className="text-[10px] leading-4 text-muted-foreground">
              The resolution this content was authored for. A 1080p capture
              shown on a 1440p device is scaled up, like a console would.
            </p>
          </div>
        ) : null}
      </div>
    </FloatingPanel>
  );
}
