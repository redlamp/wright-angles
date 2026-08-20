---
tags: [domain/display-math, status/draft, origin/playtest]
---

# Plan: Display Setup Wizard

**Date:** 2026-08-20 · **Status:** draft — awaiting Taylor's review
(tracked as a GitHub issue). Raised by playtest feedback and shaped by
[[screen-auto-detection]].

## The problem

A first-time user is asked for a diagonal and a distance before the tool
will tell them anything. A playtester stalled exactly there: the monitor's
diagonal isn't reported by any OS, and a desk rarely has a ruler long
enough for either number. The fields look mandatory and authoritative, so
not knowing them reads as "this tool isn't for me" — churn before the
value has been seen.

Two facts frame every option below:

- [[screen-auto-detection]] settles that **no browser API returns physical
  size**. `getScreenDetails()` is Chromium-only, permission-gated, and
  returns pixels and screen arrangement — never millimetres. Resolution
  predicts diagonal well for Apple hardware, the Switch family, Steam Deck
  and iPhone/iPad, and badly for ordinary monitors (1080p spans roughly
  21.5″–27″). So auto-detection is a convenience layer, never the source
  of truth.
- Taylor's standing objection to onboarding: eight panels of feature tour
  before you can make the thing you came to make. Whatever ships must not
  become that.

## The shape

**The wizard is the calibration path, not a tour.** It teaches nothing
about features. It answers one question — what screen are you at, and how
far away — and then gets out of the way. Every step is skippable, it is
resumable from Settings, and it never blocks the app behind itself.

### Step 1 — "Is this you?"

Fingerprint the resolution against a static device table. On a near-exact
match, ask rather than assume: *"This looks like a 14″ MacBook Pro — is
that right?"* Confirm fills diagonal, aspect and a sensible default
distance in one click, and the wizard can end here for a large slice of
users.

On no match — the ordinary-monitor case — say nothing numeric. A wrong
silent guess is worse than an empty field, because arc-minute output looks
just as confident either way. Offer the presets already in step 1 and fall
through.

### Step 2 — Size

Primary: the bank-card calibration ([#3]). It is the only path that
actually measures, it needs no tools anyone lacks, and the playtester
confirmed unprompted that it is the kind of thing that helps a newcomer
grasp the concept.

Secondary: "I think the display is:" quick-picks, for people who will not
measure. Honest about being an estimate.

The escape hatch has to be labelled in the user's words — "I don't know my
screen size" — not in ours ("calibrate").

### Step 3 — Distance

The weakest link, and the one with no good automatic answer yet
([#4]). Ranked by what we can ship:

1. A plausible default from the chosen stance, pre-filled so nobody is
   blocked. Desk, couch and standing already carry defaults.
2. A relatable reference to sanity-check it against — an arm's length is
   roughly 60–70 cm for most adults, which is most of the way to a desk
   monitor's distance.
3. Measure it properly, offered but never demanded.

Webcam ranging and the card-at-arm's-length trick stay in [#4]; neither is
a dependency of this plan.

### Step 4 — The payoff, not a summary

End in the 2D view on the seeded image **with its text detections already
present** (see issue #2). The playtester's own sequence was upload →
calibrate → 2D view, and the reason given was to focus attention on "is my text
too small in that context". A wizard that ends on a congratulations panel
wastes the one moment the user is still paying attention.

## What this deliberately does not do

- **No gating.** The playtester suggested forbidding all other interaction
  until the sequence completes. That collides with Taylor's objection, and
  gating punishes the returning user to help the new one. The better lever
  is a default state that is already meaningful: seeded media, detections
  present, a calibrated-enough screen, so someone who skips everything
  still lands somewhere that shows the point.
- **No feature tour.** Fit modes, offsets, the report and the OCR pipeline
  are not mentioned. Taylor's "tutorial pass" is a separate exercise once
  the panels settle.
- **No confident guessing.** Anything inferred is confirmed, and anything
  unconfirmed is visibly an estimate.

## Open questions for review

1. Does step 1's fingerprint confirm earn its complexity, given it helps
   Apple and handheld users and does nothing for a 1080p desktop?
2. Should the wizard reappear for a user whose zoom or resolution changed,
   or is that a quieter nudge?
3. How far does "default state is already meaningful" go — does This
   Device ship pre-populated with the modal monitor rather than empty?
4. Is distance allowed to stay a typed number for now, with [#4] the real
   fix later?
