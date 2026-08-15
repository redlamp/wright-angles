# Wright Angles

A tool to triangulate vision.

Wright Angles shows UX designers and game developers how their content
actually looks across devices — a Switch 2 held at 40cm, a 65″ TV at
3 meters, your monitor at arm's length — all simulated at accurate
relative scale on the screen in front of you. Arc minutes (the angle a
thing subtends at your eye) are the common currency that makes the
comparison honest; the same math set the font sizes for Disco Elysium:
The Final Cut on console and handheld.

**Live sample:** https://redlamp.github.io/wright-angles/

## Highlights

- **Device Manager** — calibrate the display you're sitting at, then add
  test devices from presets (Switch family, Steam Deck, phones, monitors,
  TVs) or custom specs; per-device distance, key color, and visibility.
- **2D overlay** — your reference image at every device's true relative
  size, outlined in each device's color.
- **3D view** — the same comparison in space: viewer, sight line, and
  screens at their real distances.
- **Strictly local media** — images are stored in your browser
  (IndexedDB), never uploaded anywhere. No backend, no tracking. Safe for
  unannounced work.

## Development

Bun + Next.js 16 + Tailwind v4 + shadcn + react-three-fiber.

```bash
bun install
bun run dev    # http://localhost:7841
bun test       # math library tests
```

Project knowledge lives in `wiki/` (an Obsidian vault) and `docs/PRD.md`.

## License

MIT — see [LICENSE](LICENSE).
