---
name: clawd-animation
description: Starter kit for hand-painted 2D cartoon videos (MP4) starring Clawd or any character, made with p5.js + p5.brush and rendered headlessly — from JohnHeibel/ClaudeAnimationBase. Use whenever the user asks for a cartoon, character animation, animated short, music video, or a hand-drawn/watercolour style video, especially one with a mascot or character acting out a story.
---

# Clawd animation kit

Bundled copy of [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) (MIT, see `kit/LICENSE`) in `kit/`: a p5.brush engine, the Clawd character (5 views, 31 emotions, hats, emotes, dances), a brush-wipe/iris transition set and a headless renderer that writes contact sheets, frame strips, crops and MP4.

For flat motion graphics, 3D, shaders or UI animations (not a painted character cartoon), use `opus-video-prompts` instead.

## Workflow

1. **Set up a working copy** in the user's project (default `animation/`, unless they name another folder):
   ```bash
   cp -r <this skill dir>/kit animation && cd animation && npm install
   ```
   Requires Node.js, Chrome/Chromium and ffmpeg. Add `animation/node_modules` and `animation/out` to ignores if the project's `.gitignore` doesn't cover them (the kit's own `.gitignore` does inside the folder).
2. **Read `animation/ANIMATION_GUIDE.md` in full** before drawing anything, and look at `docs/emotions.jpg` and `docs/views.jpg`. Follow its rules: handmade, alive, one piece, no text, transitions at every seam, an event in every shot, timing for the viewer.
3. **Storyboard first** in `STORYBOARD.md` (format in the guide) and show it to the user before writing scene code, unless they asked you to go straight through.
4. **Build** one scene file in `src/scenes/`, swap it for `demo.js` in `studio.html`, set `duration`/`bpm` in `src/config.js`. Don't reuse the demo's story.
5. **Review loop:** render sheets, strips and crops with `node render.mjs ...` and actually look at the images (Read tool), fix, repeat.
6. **Render:** `node render.mjs --clip --out=out/video.mp4` and give the user the file.

## Environment notes

- No GPU (cloud containers, CI): add `--soft-gl`; watercolour `fill`s get slow, measured ~30–50 s/frame for the demo in a cloud session (≈2–3 h for 11 s at 24 fps), so for full renders without a GPU replace watercolour `fill`s with `wash`, lower `--fps`, or render on a machine with a GPU.
- Chrome not auto-found: `--chrome=<path>` or `CHROME_PATH`. In Claude Code cloud sessions use `/opt/pw-browsers/chromium-*/chrome-linux64/chrome`.
- Headless Linux with an NVIDIA GPU: `--gpu-angle=gl-egl` or `vulkan` (check with `node gpu_probe.mjs <chrome>`).
- The user's request decides **what** the video is; the guide decides **how**. If they ask for something the guide forbids (text, 3D), do what they ask.
