# Phase 1 — Toon-shaded vertical slice (click-by-click)

**Goal of this milestone:** a small walkable scene that *already reads as "N64+ stylized"* —
cel shading + outlines + emissive windows + fog. No real content. This is a **gate**: sign off
the look here before producing any assets (Phase 2+).

Everything below uses **free** tools only. Do the steps in order; each ends with a visible check.

---

## 0. Prep the test scene (5 min)
1. New Level → **Open World** is overkill; use **Basic** (or the Third Person map).
2. Drop a floor plane, 3–4 cubes/cylinders, and the `chimpanzee` static mesh as stand-ins.
3. Make sure the Third Person character (`BP_ThirdPersonCharacter`) walks around. This is your test bed.

## 1. Toon (cel) shading — pick ONE path

### Path A — Post-process toon (recommended, no per-material work)
Cel-bands the whole screen in one pass; fastest way to see the look.
1. **Project Settings → Rendering → Postprocessing → Custom Depth-Stencil Pass = `Enabled with Stencil`** (needed later for outlines).
2. Create material `M_PP_Toon`, set **Material Domain = Post Process**.
3. Sample `SceneTexture: PostProcessInput0` (the lit scene color).
4. Quantize luminance into bands: compute luma `dot(color, float3(0.299,0.587,0.114))` → multiply by N (e.g. 3) → `floor` → divide by N → recombine with hue. (A simple "posterize" of the value channel reads as cel shading.)
5. Place a **Post Process Volume**, set **Infinite Extent (Unbound) = true**, add `M_PP_Toon` under **Post Process Materials**.
6. ✅ **Check:** the scene now shows hard light bands instead of smooth gradients.

### Path B — Per-material toon (more control, more work)
For a hand-tuned cel ramp per object:
1. Create master `M_Toon`. In a custom lighting setup, take `N·L`, plug through a **stepped ramp**
   (Curve Atlas or `ceil`/`floor` math) to get 2–3 flat shadow bands, then × BaseColor.
2. Make Material Instances per asset later. Slower to set up; use only if Path A isn't stylized enough.

> Free plugin alternative: search **FAB** for a free "toon/cel shader" if you'd rather not build the material. The post-process path above needs nothing extra.

## 2. Outlines (the other half of the toon look)
Inverted-hull is the most reliable free method:
1. In `M_Toon` (or a dedicated `M_Outline`), enable **Two Sided**, set **Shading Model = Unlit**,
   Emissive = black (outline color).
2. Under the **World Position Offset** pin, push verts along their **vertex normal** by a small
   amount (e.g. 1–3 units): `VertexNormalWS * OutlineThickness`.
3. Apply as a **second material slot** that renders back-faces only → silhouette outline.
   *(Alternative: a post-process edge-detect on Custom Depth/Normals — heavier, but no per-mesh slot.)*
4. ✅ **Check:** characters/props now have a dark contour line.

## 3. Emission — the "lit windows at dusk" effect (from the video)
1. On a test cube's material, add an **Emissive Color** input (a warm color × intensity 2–5).
2. Later this is driven by a painted **emission map** from Blender (Phase 2); for now a flat
   emissive proves the pipeline.
3. Enable **Bloom** (default in post-process) so emission glows.
4. ✅ **Check:** the emissive faces glow against a darker scene.

## 4. Lighting & atmosphere (dusk mood)
1. **Directional Light** = low-angle sun/moon, slightly warm or cool; lower intensity for evening.
2. **Sky Atmosphere** + **SkyLight** for ambient fill (keep ambient low so emission/toon bands pop).
3. **Exponential Height Fog** — the video's "best post-process ever": add density + a colored
   inscattering for that mysterious haze.
4. Add 1–2 **Point/Spot Lights** for local pools of light (the video adds spotlights per island).
5. ✅ **Check:** scene reads as evening, foggy, with glowing windows.

## 5. Post-process grade (tie it together)
In the Post Process Volume:
1. **Color Grading:** slight desaturation + a cool/teal shadow tint or warm highlights (taste).
2. **Bloom:** tune so emission glows without blowing out.
3. Optional: subtle **vignette**.
4. ✅ **Check:** the whole frame feels like one cohesive stylized image.

---

## Milestone sign-off
- [ ] Walkable build, character moves.
- [ ] Cel banding visible (Path A or B).
- [ ] Outlines on characters/props.
- [ ] Emissive surfaces glow with bloom.
- [ ] Fog + dusk lighting set the mood.
- [ ] One screenshot saved to `unreal/docs/screenshots/` as the **art-direction reference**.

When all boxes are checked, the look is locked → proceed to **Phase 2 (asset pipeline proof)**
in [PRODUCTION_PLAN.md](../../PRODUCTION_PLAN.md).
