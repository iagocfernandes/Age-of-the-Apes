# Age of the Apes — Production Plan

**Goal:** A Zelda-like action-adventure (exploration + Z-targeting combat + quests) with stylized graphics a notch above Nintendo 64, built in **Unreal Engine 5** using an **AI-driven, free-tier asset pipeline**.

**Status today:** A complete, playtested gameplay prototype exists in Three.js/JS
(`index3d.html`, `js/render3d.js`, `js/main3d.js`, plus shared sim in `state/map/entities/combat/dialog/quests`).
This prototype is **the design spec** — we are not shipping it, we are re-implementing its proven systems in UE5.

---

## Progress log

**2026-06-14 — Phase 0 & Phase 1 DONE.**
- ✅ UE 5.7 installed; project created at `unreal/AgeOfTheApes/` (Blueprint, Third Person template).
- ✅ Git LFS + `.gitignore` working (cache ignored, assets LFS-tracked).
- ✅ Fixed macOS blockers: installed Metal Toolchain (`xcodebuild -downloadComponent MetalToolchain`); freed ~33 GB disk (removed CivilizationVII + tutorial project) — disk was 99% full.
- ✅ GLB import pipeline validated (`assets/models/chimpanzee.glb` → `Content/AOA/chimpanzee`). NB: imported GLBs need Blender prep (origin-to-bottom, scale) — pivot/scale issues are expected.
- ✅ **Toon look (Phase 1 gate signed off):** post-process material `M_PP_Toon` = clean normal-based outline over natural colors (`unreal/scripts/03_toon_clean.py`); dusk mood = low warm sun + dim sky + dense volumetric fog + bloom/vignette (`unreal/scripts/04_dusk_mood.py`). Applied via `AOA_ToonPPV` post-process volume.
- ✅ **Automation channel:** enabled PythonScriptPlugin + a file-watcher (`Content/Python/init_unreal.py`) so the assistant drives the live editor by writing `Saved/aoa_cmd.py` and reading `Saved/aoa_result.txt` via `unreal/scripts/_send.py` (multicast remote-exec didn't work on this macOS — loopback issue).

**Deferred polish (revisit with real assets, not placeholder geometry):** stronger cel banding (luminance-based, not per-channel posterize which caused hue blotches); per-material toon ramp.

**Next:** Phase 2 (asset pipeline proof — needs the user's browser/AI-tool accounts) and Phase 3 (gameplay port from the JS spec). Editor screenshots-to-file didn't work in editor-only mode (needs PIE); rely on user screenshots for visual judgment.

---

## Guiding decisions

| Decision | Choice | Consequence |
|---|---|---|
| Engine | **Unreal Engine 5** (use 5.5+ for native glTF/GLB import; 5.7 makes drag-drop trivial) | Gameplay rebuilt in Blueprints/C++ |
| Art budget | **Free / credits-only** | Slower batches, watermark/credit caps, lean on free packs |
| Look target | **Stylized toon, "N64+"** | Cel shading + outlines + emission + fog do most of the heavy lifting |
| First milestone | **Toon-shaded vertical slice** | Prove the *look* before producing content |

### Free toolchain
- **3D gen (credits-only):** Meshy, Tripo3D, Hunyuan3D, Rodin free tiers. *(Warp3D from the video is NCsoft, invite-based — optional.)* Rotate across them to stretch free credits.
- **Rigging:** Mixamo (free auto-rig + animation clips: Idle, Walk, Run, Attack, Jump, Dodge).
- **DCC / cleanup:** Blender (free) — origins, merge verts, scale, shading, emission/PBR map painting.
- **Texturing (Substance alt):** Blender texture paint + free packs (Freestyle, ambientCG, Poly Haven); ArmorPaint/Materialize if needed.
- **Fallback content:** Quaternius, Kenney, KayKit, Poly Pizza (your current apes are from here).
- **Toon shading in UE:** free post-process toon material or a free FAB/Gumroad toon plugin; emission via material; Exponential Height Fog + post-process volume.

---

## Phase 0 — Foundation (setup)
**Outcome:** UE5 project runs the Third Person template with your repo under version control.
- [ ] Install UE5 (5.5+), enable glTF/Interchange import plugins.
- [ ] Create project from **Third Person** template inside this repo (`/unreal/` subfolder); add UE `.gitignore`.
- [ ] Decide Git LFS for binary assets (`.uasset`, `.glb`, textures).
- [ ] Drop in one placeholder ape GLB (`assets/models/chimpanzee.glb`) to confirm import works.

## Phase 1 — Toon-shaded vertical slice ★ FIRST MILESTONE
**Outcome:** A small scene you can walk around that *already looks like the game* — cel shading, outlines, emissive windows, fog. No real content yet; this locks the art direction.
- [ ] Install/build toon (cel) shader; apply to character + a few primitives.
- [ ] Add outline pass (post-process material or inverted-hull).
- [ ] Set up Post-Process Volume: color grade, bloom (for emission), Exponential Height Fog.
- [ ] Author one **emission material** and prove the "lit windows at dusk" effect from the video.
- [ ] Lighting: directional (sun/moon) + a couple of point/spot lights for mood.
- [ ] **Deliverable:** screenshot + walkable build that reads as "N64+ stylized." Sign off the look here.

## Phase 2 — Asset pipeline proof
**Outcome:** One full asset traverses the whole free pipeline into UE, end to end.
- [ ] ChatGPT → concept image + moodboard for a single hero building.
- [ ] Generate it (Meshy/Tripo/Rodin), remesh to a sane poly budget (~10–25k), bake PBR.
- [ ] Blender cleanup checklist: **set origin to bottom, merge verts, apply scale, fix shading (weighted normals), paint emission map.**
- [ ] Export GLB → import to UE → assign toon material + emission → set collision (complex-as-simple where needed).
- [ ] **Deliverable:** documented, repeatable step list (the "factory" you'll reuse). Note time + credits per asset to forecast the content phase.

## Phase 3 — Core gameplay re-implementation (port the spec)
**Outcome:** The Three.js systems reborn in UE5. Use the JS files as the literal behavior reference.
- [ ] **Character + camera:** third-person orbital cam with wall collision (ref `render3d.js` camera).
- [ ] **Movement:** inertia/accel, free-look turn-to-direction, dodge impulse with cooldown (ref `main3d.js`, `combat.js`).
- [ ] **Z-targeting:** lock-on nearest in front, strafe, framing both actors, hit-stop on impact (ref README "Combate estilo Zelda").
- [ ] **Animation:** wire Mixamo clips to an AnimBP (Idle/Walk/Run/Attack/Jump/Dodge) — replaces procedural anim.
- [ ] **Combat:** damage, weapons (iron pipe / pistol), projectiles, alert level (ref `combat.js`, `state.js`).
- [ ] **Dialog + quests + factions:** branching dialog with Charisma checks, reputation, the "Arca de Dados" main quest with two endings (ref `dialog.js`, `quests.js`, `state.js`).
- [ ] **Deliverable:** feature parity with the JS prototype, now in UE.

## Phase 4 — World building (the video's workflow)
**Outcome:** The first real explorable zone, assembled with the AI pipeline.
- [ ] Block out layout in Blender (islands/terrain, paths, fence-by-path, bridges) — easier placement per the video.
- [ ] Batch-generate props/houses/trees through the Phase-2 factory.
- [ ] Paint trails/grass texture on large terrain pieces (Blender paint + free brushes).
- [ ] Import composition to UE; toon material on everything; set collisions; dress with props.
- [ ] Scene lighting + fog + emission pass; add a cloud/skybox GLB for atmosphere.
- [ ] **Deliverable:** one polished, walkable zone with a working quest loop = the **playable vertical slice**.

## Phase 5 — Content scale-up & polish
- [ ] Expand to the 3 zones from the design (human ruins / neutral trade post / ape forest).
- [ ] Remaining NPCs, quests, loot, save/load, audio.
- [ ] Performance pass (poly budgets, LODs, draw calls), UI/HUD, menus.
- [ ] Build/packaging + playtest loop.

---

## Critical risks & how we manage them
1. **Gameplay rebuild cost (biggest risk).** Mitigated by treating the JS prototype as a finished spec — no design discovery needed, just translation.
2. **Free-credit exhaustion.** Rotate generators; reserve AI gen for hero assets; fill the rest with free packs.
3. **The look is the whole pitch.** That's why toon shading is Phase 1 — if the slice doesn't read as "N64+," nothing downstream matters.
4. **GLB import friction by UE version.** Prefer 5.5+; keep a Blender→FBX fallback path.

## Suggested cadence
Phases are sequential for 1–2 people. Don't start Phase 4 content production until Phase 1 (look) **and** Phase 2 (pipeline) are signed off — that's what kept the video team to ~1 day per playable scene.
```
P0 setup → P1 LOOK (gate) → P2 PIPELINE (gate) → P3 gameplay → P4 vertical slice → P5 scale
```
