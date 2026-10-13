---
tags: [domain/display-math, status/draft]
---

# Plan: Measuring Viewing Distance (and Screen Size) Without a Tape

**Date:** 2026-10-13 · **Status:** draft, for Taylor's review. Picks up
issue 4 and builds on [[plan-display-setup-wizard]] and
[[screen-auto-detection]].

## What we actually need

Three numbers set every arc-minute reading on This Device:

- **Aspect ratio:** already known. Native pixels give it exactly (square
  pixels), so it never needs measuring.
- **Diagonal:** the bank card measures it well today.
- **Viewing distance:** the weak link. No browser API reports it, and it
  matters as much as the diagonal.

So the question is mostly "how far is the viewer's eye from the screen".

## Options, ranked

### 1. Webcam ranging on the same machine (recommended first)

A laptop or monitor webcam sits in the plane of the screen, which is
exactly the distance we want. A face-landmark model finds the irises; the
human iris is close to 11.7 mm wide for almost all adults (about ±0.5 mm),
so distance ≈ focal length × 11.7 mm ÷ iris width in pixels.

- **Accuracy:** about ±10–15% with an assumed webcam field of view.
  Interpupillary distance (about 63 mm, ±4 mm) is a second, independent
  estimate; averaging both over a few seconds of "sit as you normally do"
  tightens it.
- **Calibrating the focal length:** hold the bank card flat against your
  face, next to your eye, for one frame. The card's known width gives the
  camera's focal length, after which iris ranging is good to a few
  percent. This reuses the card the size flow already asks for.
- **Local-only fits:** MediaPipe Face Landmarker runs in the browser via
  WASM. Vendor the model and runtime under `public/` the way Tesseract is
  vendored (about 4 MB). Frames are processed in memory and never stored or
  sent anywhere; say so on the permission screen.
- **Degrades cleanly:** no camera, or permission denied, falls back to the
  typed number with a stance default.

### 2. Phone companion via QR code (larger, later)

The desktop shows a QR code that opens a small page of the same app on a
phone (`/measure`).

- **Android Chrome:** WebXR AR with hit-testing gives real metric
  distances. From your seat, point the phone at the display: it reports the
  distance to the screen plane, and tapping two screen corners measures
  the width, like Google's Measure app. That covers distance **and**
  diagonal with no card.
- **iPhone:** Safari has no WebXR AR. Two fallbacks: guide the user
  through Apple's Measure app and have them type the result, or have the
  phone camera look at a pattern the desktop draws (size known from card
  calibration) using an assumed camera field of view, at about ±10%.
- **Getting results back to the desktop is the hard part.** The site is
  static with no backend, and the local-only decision rules out a relay
  server. Options that keep the promise: the phone shows the numbers large
  and the user types them in (simple, always works); or the phone shows a
  QR code that the desktop webcam reads. A peer-to-peer WebRTC link needs a
  signaling server, so it is out unless the local-only decision is
  revisited for measurement-only data. That is a product call, not a
  technical one.

### 3. No-device fallbacks (keep, improve copy)

- Stance defaults (desk, couch, standing) prefilled, so nobody is blocked.
- A body reference: an arm's length is about 60–70 cm for most adults,
  close to a typical desk monitor distance.
- Card at arm's length: hold the card at a known distance and match it to
  an on-screen shape. Sound geometry, fiddly choreography; lowest priority.

## Proposed order

1. Webcam ranging with the card-based focal calibration, as its own PR.
2. Phone companion: Android WebXR first, typed result return, iPhone
   guidance. Decide on the return channel before building.
3. Revisit acoustic ranging (phone and laptop timing a chirp) only if
   1 and 2 fall short; it needs both devices talking, which brings back the
   return-channel problem.

## Open questions

1. Is a 4 MB vendored face model acceptable for an optional feature, loaded
   only when the user opens the distance tool?
2. For the phone companion, is typing the result back acceptable, or is a
   relay worth revisiting [[decision-local-only-media]] for numbers only?
3. Should the app show distance as a range (for example 64–72 cm) rather
   than one number, so the estimate never looks more exact than it is?
