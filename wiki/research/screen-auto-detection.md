---
tags: [domain/product, origin/external-research, status/draft]
---

# Screen Auto-Detection

Can the browser tell Wright Angles the user's monitor diagonal and
viewing distance, or infer them well enough to be worth prefilling?
Short answer: distance, never. Diagonal, only as a labelled guess with
real error bars — and only for a minority of panels. Gathered
2026-08-20 against MDN, the CSSOM View draft, WICG/W3C standards-positions
trackers, and vendor spec pages. This is the reconnaissance pass before
committing to any onboarding UI; it makes no UI recommendation binding.

## 1. `window.getScreenDetails()` / the Window Management API

**What it returns.** `getScreenDetails()` resolves to a `ScreenDetails`
with `screens` (a `ScreenDetailed[]`) and `currentScreen`. Each
`ScreenDetailed` extends the ordinary `Screen` interface, so per-screen
you get:

- From `Screen`: `width`, `height`, `availWidth`, `availHeight`,
  `colorDepth`, `pixelDepth`, `orientation` (a `ScreenOrientation` —
  `type` + `angle`, no size).
- Added by `ScreenDetailed`: `left`, `top`, `availLeft`, `availTop`,
  `devicePixelRatio` (per-screen, not the window-global one),
  `isPrimary`, `isInternal`, `label` (a human string like "Built-in
  Retina Display" or the OS device name).

Sources: [MDN: ScreenDetailed](https://developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed),
[MDN: Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API),
[MDN: Window.getScreenDetails()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails).

**No physical size, anywhere.** Every field above is pixels, a boolean,
a string label, or an angle. Nothing in `ScreenDetailed` — nor in
`Screen`, nor anywhere else in the spec — is millimetres or inches.
`label` is the closest thing to a hint ("Built-in Retina Display"
implies *some* Apple internal panel) but it's an opaque OS-supplied
string, not a queryable field, and most external monitors report their
EDID product name or something generic like "DELL U2723QE" — parseable
only by hand-maintained pattern matching, and not guaranteed to be
present or stable across OSes. **This API cannot answer "how many
inches is this screen" under any circumstance.** It answers "how many
screens, at what pixel geometry and arrangement, and which is
internal/primary" — useful for multi-monitor placement, useless for
diagonal size.

**Permission.** Gated by the `window-management` [Permissions
Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy)
and a browser permission prompt ("know when a page shows a permission
request for window placement"); an iframe needs
`allow="window-management"`. The call must run in a secure context
(HTTPS) and from a user gesture. On denial, policy block, insecure
context, or missing gesture, the promise rejects with a
`NotAllowedError` `DOMException` — same error for every failure mode,
so the app can't distinguish "user said no" from "not HTTPS" from
"no user gesture" without other checks. Source: [MDN:
Window.getScreenDetails()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails).

**Browser support: Chromium-only, and contested.** [caniuse: mdn-api /
window / getscreendetails](https://caniuse.com/mdn-api_window_getscreendetails)
shows Chrome/Edge 100+, Opera 86+, Samsung Internet 19+ — no Firefox,
no Safari (desktop or iOS), across every tested version. This isn't a
temporary gap:

- Mozilla's tracking issue,
  [mozilla/standards-positions#542](https://github.com/mozilla/standards-positions/issues/542),
  opened 2021-06-14, is still open with no published position as of
  this research.
- WebKit's tracking issue,
  [WebKit/standards-positions#117](https://github.com/WebKit/standards-positions/issues/117),
  is still open too, labelled `concerns: privacy` and
  `concerns: annoyance` — a per-screen fingerprint surface (label,
  exact pixel geometry, arrangement of every connected display) is
  exactly the kind of thing WebKit has opposed elsewhere.

Two multi-year-open, explicitly privacy-flagged tracking issues from
the two other engines is a stronger signal than "not yet shipped" — it
reads as "not planned." Practically: **this API is a Chromium/Windows
majority-desktop-only feature**, unavailable on all of Safari (macOS
+ iOS, a large share of Wright Angles' likely AAA-studio Mac-heavy
user base) and Firefox.

**Bottom line for Q1:** even setting aside the missing-mm problem, the
API's own support matrix rules it out as a primary path — it would
silently do nothing for every Safari and Firefox user, which is not
acceptable for a first-run flow.

## 2. What's available without that API — and where the repo's zoom trick has a real gap

None of these give physical size either, but they're worth cataloguing
because the app already leans on two of them (`display-area.tsx`,
`scene-view.tsx`, `calibration-dialog.tsx` all read `screen.width` and
`devicePixelRatio` to guess whether the browser is zoomed).

| Property | Unit | Changes with OS display scaling? | Changes with browser page zoom? |
|---|---|---|---|
| `screen.width`/`height` | CSS px, whole-screen | Yes (native px ÷ OS scale) | **Browser-dependent — see below** |
| `screen.availWidth`/`availHeight` | CSS px, minus OS chrome | Yes | Same as `width`/`height` |
| `window.devicePixelRatio` | ratio, physical px ÷ CSS px | Yes | **Yes, in Chrome and Firefox** |
| `screen.orientation` | `{type, angle}` | N/A | N/A (no size) |
| `matchMedia('(resolution: Ndppx)')` | dppx, mirrors `devicePixelRatio` | Yes | **Yes, tracks `devicePixelRatio`** |
| UA-CH `Sec-CH-DPR`, `Sec-CH-Viewport-Width/Height` | HTTP request headers | Yes (DPR) | Yes (viewport) | — irrelevant here: they're server-received headers, and this app makes no network requests at all, so they're never observed client-side in the first place. |

`screen.width` is specified as "the width of the [Web-exposed screen
area]" ([CSSOM View draft §screen.width](https://drafts.csswg.org/cssom-view/#dom-screen-width)),
in CSS pixels — but the spec doesn't pin down whether "CSS pixel"
here is evaluated at the *current* page zoom or at 100%, and browsers
diverge:

- **Chrome and Safari** freeze `screen.width`/`height` at the CSS-pixel
  count the physical screen would show at 100% zoom; zooming the page
  does not change it.
- **Firefox (and historically IE/Edge)** recompute it live: as the
  page zooms in, a CSS pixel gets physically bigger, so fewer of them
  fit across the same screen, so `screen.width` *shrinks* with zoom.
  This is deliberate, not a bug: per Mozilla engineer Markus Stange
  on the still-open
  [Bugzilla 1022006](https://bugzilla.mozilla.org/show_bug.cgi?id=1022006),
  "`screen.width * window.devicePixelRatio` always gives the number of
  physical device pixels that the screen has" in Firefox — i.e. that
  product is an *invariant*, by design, across all zoom levels.

**This directly breaks the repo's zoom-detection formula in Firefox.**
`calibration-dialog.tsx:72-74`, `display-area.tsx:802-808`, and
`scene-view.tsx:237` all compute (in one form or another)
`devicePixelRatio * screen.width / resolution.w` and flag "zoomed" when
that deviates from 1 by more than 2%. The `calibration-dialog.tsx`
comment states the assumption explicitly: "screen.width stays in
zoom-independent CSS px while dpr scales with page zoom, so their
product against the native width reads the zoom factor." That's true
in Chrome and Safari (where the trick was presumably built and tested)
— but per Stange's own description of Firefox's behavior, in Firefox
`devicePixelRatio * screen.width` is **constant regardless of zoom
level**, always equal to the native physical pixel count. So in
Firefox this check will never fire: a user zoomed to 150% will see no
warning, and the calibration/physical-scale claims will be silently
wrong. This is worth a `navigator.userAgent`-sniffed caveat or a
different zoom-detection strategy (e.g. `matchMedia` resolution-change
listeners, which do fire in both engines per the `devicePixelRatio`
column above) if Firefox is a supported target — flagging it here
rather than fixing it, per this note's brief.

One more wrinkle for completeness, from an informal but concretely
described test: [Ben Nadel, "How Browser Zoom Affects CSS Media
Queries And Pixel-Density"](https://www.bennadel.com/blog/3811-looking-at-how-browser-zoom-affects-css-media-queries-and-pixel-density.htm)
found `devicePixelRatio` on desktop Safari staying pinned at `1`
regardless of zoom in his test, diverging from both Chrome and
Firefox (which both increase it). This is an informal single-run
observation, not spec-sourced, and may be version- or OS-dependent —
flagged as low-confidence, not a claim to build on.

None of `screen.width`, `devicePixelRatio`, `orientation`, or the
`resolution` media feature carry any physical-size information — they
only ever describe pixel geometry and density, exactly like the
Window Management API's fields. **There is no code path, spec'd or
de facto, that gets a physical measurement out of the browser without
the user supplying one** (which is exactly what the credit-card
calibration flow already does).

## 3. Inference from resolution to physical size

Given only a native pixel resolution, how well can it predict a
diagonal? It splits cleanly into two regimes.

### Regime A: fixed-hardware devices — resolution names the device

Apple, Nintendo, and Valve each ship a small, fixed catalogue of
panels, so a resolution match is close to a device match. (Nintendo/
Valve/phone figures already gathered in
[[handheld-device-dimensions]]; Apple figures below are new for this
note, first-party where cited.)

| Resolution | Device(s) | Diagonal | Confidence |
|---|---|---|---|
| 2532×1170 / 2556×1179 (390–393×844–852 pt @3x) | iPhone 12–17e, 13, 14 | 6.1" | High — near-exclusive at 460 ppi |
| 2622×1206 | iPhone 15 Pro/16 Pro/17 Pro | 6.3" | High |
| 2796×1290 / 2868×1320 | iPhone Plus/Pro Max lines | 6.7"–6.9" | High |
| 1334×750 | iPhone SE 2nd/3rd gen | 4.7" | High |
| 2732×2048 | iPad Pro 12.9" (all gens) | 12.9" | High |
| 2360×1640 | iPad Air / base iPad (recent) | 10.9" | High |
| 1280×720 | Nintendo Switch, Switch OLED, Switch Lite | 6.2"/7.0"/5.5" — **ambiguous within the family** | Medium (pins to "a Switch", not which one) |
| 1920×1080 (handheld) | Nintendo Switch 2 | 7.9" | High, if flagged as a handheld not a monitor |
| 1280×800 | Steam Deck LCD/OLED | 7.0"/7.4" | Medium (two panels share it) |
| 2560×1600 | Legion Go (handheld) *or* 13" MacBook Pro (2016–2020) *or* 13" MacBook Air (M2/M3 default *scaled* mode, not native) | 8.8" handheld or 13.3" laptop | **Low — same resolution, wildly different device classes** |
| 2560×1664 | MacBook Air 13" (M2/M3/M4) | 13.6" | High — Apple-exclusive native panel res |
| 2880×1864 | MacBook Air 15" (M2/M3/M4) | 15.3" | High |
| 3024×1964 | MacBook Pro 14" (M1 Pro/Max–M4) | 14.2" | High |
| 3456×2234 | MacBook Pro 16" (M1 Pro/Max–M4) | 16.2" | High |
| 2880×1800 | MacBook Pro 15" Retina (2012–2019, Intel) | 15.4" | High, but discontinued hardware |
| 4480×2520 | iMac 24" (M1–M4) | 23.5" (marketed 24") | High |
| 5120×2880 | iMac 27"/5K (2014–2020) *or* Studio Display / Studio Display XDR | 27" | High within "it's a 27\" Apple panel," ambiguous *which* product |
| 6016×3384 | Pro Display XDR | 32" | High (discontinued March 2026, still in the field) |

Apple figures: [MacBook Air 13"/15" tech specs](https://www.apple.com/macbook-air/specs/),
[MacBook Pro 14"/16" tech specs](https://www.apple.com/macbook-pro/specs/),
[iMac 24" tech specs](https://support.apple.com/en-us/121556),
[Studio Display XDR tech specs](https://support.apple.com/en-us/126323),
[Pro Display XDR tech specs](https://support.apple.com/en-us/111892).
iPhone/iPad table cross-checked against the aggregator
[iosref.com/res](https://iosref.com/res) (secondary source, values
match Apple's published points×scale-factor convention from the
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
scale-factor model — medium-high confidence, not fetched from a single
authoritative table page).

**Caveat that matters for this app:** none of Regime A helps unless
`getScreenDetails()` (Chromium-only, see §1) or a manual "what device
is this" picker supplies the *native* resolution. `screen.width` alone
is CSS pixels at 100% zoom, already divided by OS scale factor — on a
MacBook Air 13" at the default "Retina" scaled mode, `screen.width`
often reads `1512`, not `2560`, because macOS is serving a scaled
logical resolution. Reconstructing the true native panel resolution
needs `screen.width * devicePixelRatio`, and even then the OS may be
running an intermediate (non-1:1, non-native) HiDPI scale where that
product doesn't land exactly on the panel's real pixel count either.
So Regime A's high-confidence rows are only reachable if the app can
get a trustworthy native resolution in the first place — which is its
own unsolved problem, independent of this table.

### Regime B: general desktop monitors — resolution barely narrows it down

For ordinary Windows/Linux desktop monitors, the same resolution ships
across a wide span of diagonals, because panel size and pixel count
are chosen independently by dozens of vendors. Rough market share (not
size-per-resolution) from [Steam Hardware & Software Survey,
July 2026](https://store.steampowered.com/hwsurvey/resolution/) — a
self-selected PC-gaming sample, directional only, not representative
of all desktop users:

| Resolution | Steam share (Jul 2026) | Common panel sizes shipped | Spread |
|---|---|---|---|
| 1920×1080 | 51.1% | 21.5", 22", 23", 23.8", 24", 27" (rare, low-ppi budget) | **Very wide** — 21.5" to 27"+ all common |
| 2560×1440 | 21.5% | 24" (high-ppi), 27" (by far the modal size), 32" (low-ppi) | Wide — 24"–32" |
| 3840×2160 | 4.9% | 27", 28", 32" (most common), 42–43" (TV-as-monitor) | Wide — 27" to 43"+ |
| 3440×1440 | 3.1% | 34" (near-exclusive), a minority of 35" curved VA panels | **Narrow** — 34" is the de facto standard pairing ([ViewSonic explainer](https://www.viewsonic.com/library/tech/compared/ultrawide-monitor-resolutions-compared/); PPI math cross-checked independently) |
| 1920×1200 | 2.7% | 24" (16:10) almost exclusively | Narrow |
| 1366×768 | 2.5% | 15.6" laptop panels, some 11.6"–14" | Medium — laptop-class only |
| 2560×1080 | 0.7% | 29" ultrawide, near-exclusive | Narrow |

Sources: [Steam Hardware & Software Survey — Resolution](https://store.steampowered.com/hwsurvey/resolution/)
for the share numbers (July 2026 snapshot; Steam's monthly figures
move a point or two but the ranking is stable across 2026). Panel-size
spread is market observation from vendor listings and reviewer
consensus (ViewSonic, Dell, ASUS product pages checked live), not a
formal dataset — treat as directional, not sourced-per-number.

**How badly wrong would a single guess be?** For the two resolutions
that cover ~73% of Steam's sample (1080p and 1440p), the honest
answer is: *badly*. 1080p spans a real diagonal range of roughly
21.5"–27" — guessing the modal size (23.8"/24") for a 27" 1080p budget
panel or a 21.5" one is off by 2–3.5", which is 10–15% relative error,
enough to visibly mis-scale the arc-minute math this app's whole
premise rests on. 1440p is a bit better because 27" is genuinely modal
among 1440p buyers, but 24" and 32" panels at the same resolution are
common enough that a silent guess would still be wrong a meaningful
minority of the time. Only the narrow-spread rows (3440×1440,
1920×1200, 2560×1080) approach the confidence of Regime A.

### Bundling this as static data

If a resolution→size lookup ships, it must ship as a static table in
the bundle (no network calls, per the local-only architecture rule).
Regime A (device-exact matches: Apple laptops/desktops/displays,
Switch family, Steam Deck, common iPhone/iPad) is maybe 40–60 rows,
each a resolution → {device name, diagonal, confidence: high}. That's
well under 5 KB as JSON. A Regime B table (resolution → modal size +
spread + confidence: low/medium) adds another dozen or so common
desktop resolutions — negligible size either way. Size is not the
constraint here; honesty about the confidence field is.

## 4. Recommendation

**No API gives physical size — accept that as fixed, not a gap to
work around.** Neither `getScreenDetails()` nor any of the ordinary
`screen`/`devicePixelRatio`/`matchMedia` surface ever reports mm or
inches, by spec, on any engine. That part of the investigation is
unambiguous and not going to change with a different API choice.

**A defensible first guess exists, but only for a minority of users,
and it must announce its own confidence rather than silently prefill:**

- **Regime A hits (device-exact — Apple hardware, Switch family, Steam
  Deck, common phones/tablets) are worth prefilling with an explicit
  "We think this is a `<Device Name>` — is that right?" confirm.**
  These are high-confidence enough to save real users real typing, but
  a resolution match is still circumstantial (spoofed viewports,
  external monitors on a laptop, browser zoom miscomputing the native
  resolution per §2) — never silent-apply without a visible,
  one-click-to-reject confirmation.
- **Regime B hits (ordinary desktop monitors at 1080p/1440p/4K) are
  too weak to prefill a number at all.** The honest move is either
  to say nothing, or to offer the *modal* size as a clearly-labelled
  starting point for the credit-card calibration flow ("most
  1920×1080 monitors are 24"–27" — drag to match your card") rather
  than a value the user might mistake for a measurement.
- **The narrow-spread desktop cases (3440×1440→34", 1920×1200→24",
  2560×1080→29") sit between the two** — reasonable to prefill with
  the same explicit confirm treatment as Regime A, not the silent
  treatment.

**Physical-ruler calibration (`components/calibration-dialog.tsx`)
must stay the primary, trusted path — resolution inference is a
convenience layer on top of it, never a replacement.** The credit-card
trick is the only step in this whole investigation that produces an
actual physical measurement; everything upstream of it is a labelled
guess at best. Any UI built on this note should frame the guess as
"pre-fills the calibration starting point," not "detects your
screen."

Related: [[handheld-device-dimensions]], [[decision-arcminute-rosetta-stone]],
[[decision-local-only-media]].
