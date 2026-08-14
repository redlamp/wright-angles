"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { simulatedSizeOnHostPx } from "@/lib/display-math";
import type { Device } from "@/lib/types";

/**
 * The 2D overlay: every visible device rendered at equal angular size,
 * mapped through This Device's panel.
 *
 * Mapping chain: device → simulatedSizeOnHostPx (This-Device pixels) → CSS
 * px via k = containFit(area, This Device resolution). When the app runs
 * fullscreen at native resolution, k = 1/devicePixelRatio and the overlay
 * is physically 1:1 on the user's actual panel.
 */
export function DisplayArea() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const items = useMediaStore((s) => s.items);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const activeId = useMediaStore((s) => s.activeId);

  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArea({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    setDpr(window.devicePixelRatio || 1);
    const onResize = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const activeUrl = activeItem ? objectUrls[activeItem.id] : null;

  const rects = useMemo(() => {
    if (!area.w || !area.h) return [];
    const k = Math.min(
      area.w / thisDevice.resolution.w,
      area.h / thisDevice.resolution.h,
    );
    const all: (Device & { isThis?: boolean })[] = [
      ...(thisDevice.visible ? [{ ...thisDevice, isThis: true }] : []),
      ...devices.filter((d) => d.visible),
    ];
    return all
      .map((d) => {
        const sim = d.isThis
          ? {
              widthPx: thisDevice.resolution.w,
              heightPx: thisDevice.resolution.h,
            }
          : simulatedSizeOnHostPx(d, thisDevice);
        return {
          device: d,
          w: sim.widthPx * k,
          h: sim.heightPx * k,
        };
      })
      .sort((a, b) => b.w * b.h - a.w * a.h);
  }, [area.w, area.h, thisDevice, devices]);

  const scalePct = useMemo(() => {
    if (!area.w || !area.h) return null;
    const k = Math.min(
      area.w / thisDevice.resolution.w,
      area.h / thisDevice.resolution.h,
    );
    return Math.round(k * dpr * 100);
  }, [area.w, area.h, dpr, thisDevice.resolution.w, thisDevice.resolution.h]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden bg-[oklch(0.16_0_0)]"
    >
      {rects.map(({ device, w, h }, i) => (
        <div
          key={device.id}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: w, height: h, zIndex: i + 1 }}
        >
          <div
            className="absolute inset-0 bg-black"
            style={{
              outline: `2px solid ${device.color}`,
              outlineOffset: -1,
              background: activeUrl ? "black" : `${device.color}0d`,
            }}
          >
            {activeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeUrl}
                alt=""
                draggable={false}
                className="size-full object-contain select-none"
              />
            ) : null}
          </div>
          {/* Cycle label corners so tightly nested rects stay readable. */}
          <span
            className={
              "absolute px-1 font-mono text-[10px] leading-4 whitespace-nowrap " +
              [
                "top-0 left-0 -translate-y-full pb-0.5",
                "top-0 right-0 translate-y-0 pt-0.5 pr-1.5 text-right",
                "bottom-0 left-0 translate-y-full pt-0.5",
                "bottom-0 right-0 translate-y-0 pb-0.5 pr-1.5 text-right",
              ][i % 4]
            }
            style={{ color: device.color }}
          >
            {device.label} · {Math.round(device.distanceCm)} cm
          </span>
        </div>
      ))}

      {rects.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
          No visible devices — toggle one on in the Device Manager.
        </div>
      ) : null}

      {scalePct !== null ? (
        <div className="absolute right-2 bottom-2 z-40 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-white/60">
          {scalePct === 100
            ? "1:1 physical scale"
            : `${scalePct}% scale — fullscreen at native res for 1:1`}
        </div>
      ) : null}
    </div>
  );
}
