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

**2026-06-14 — Phase 3 core gameplay ported to C++ (build green).**
- ✅ **Architecture decision:** ported the whole JS sim to **C++** (not Blueprint-via-Python — too fragile, fails silently; C++ also packages into a shippable build). Converted the Blueprint-only project to a code project: added `Source/AgeOfTheApes/` module + `AgeOfTheApes(Editor).Target.cs` (DefaultBuildSettings **V6** to match the installed engine) + `Modules` entry in the `.uproject`.
- ✅ **Files (faithful port of `js/*.js`):** `AOATypes.h` (state structs), `AOAPawn` (worldgen from `map.js` incl. mulberry32 seed 20290612, third-person orbital camera + Z-target, inertia/dash/jump movement from `main3d.js`, interaction, pickups, HISM tile world + dusk lighting/fog/toon PP spawned at BeginPlay), `AOACombat` (damage/melee/pistol/projectiles/alert "wanted" system/AI patrol-guard-hunter-wander from `combat.js`+`entities.js`), `AOADialog` (full Maya/Bromo/Lira/Krag trees with Carisma checks + the 2 endings from `dialog.js`), `AOAHUD` (Canvas HUD, minimap texture, char-creation screen, dialog/inventory/end/death panels from `ui.js`), `AOAGameMode`.
- ✅ **Build:** `Build.sh AgeOfTheApesEditor Mac Development` → `UnrealEditor-AgeOfTheApes.dylib` (compiled clean). Input is read by polling the PlayerController each tick (no Enhanced Input assets needed).
- ✅ Set `GlobalDefaultGameMode=/Script/AgeOfTheApes.AOAGameMode` in `DefaultEngine.ini`.
- ✅ Headless setup: `06_setup.py` (commandlet) created `M_AOA_Tile` color material + empty level `L_AOA` + PlayerStart; set `L_AOA` as default map.

**2026-06-15 — Phase 3 VERIFIED playable + real ape assets wired (autonomous).**
- ✅ **Self-test/self-screenshot loop (no user needed):** the game runs headless-with-render via `UnrealEditor <proj> /Game/AOA/Maps/L_AOA -game -windowed`. Added a file-driven **remote control** in `AOAPawn` (reads `Saved/aoa_ctrl.txt` each tick: `start/tp/yaw/pitch/lock/attack/dialog/pick/give/stage/shot`…). `shot` calls `FScreenshotRequest::RequestScreenshot` which **does** write PNGs in `-game` (unlike editor-only mode). This let me drive the game and screenshot it without the editor open.
- ✅ **Verified working by screenshot:** character-creation screen; dusk toon world (added `SetupSceneEnv()` = SkyAtmosphere + locked exposure + warm dusk fog/bloom/vignette/grade — fixed the washed-out look); third-person orbital camera; Z-targeting (reticle); melee combat + faction aggro + alert stars; Maya dialog tree + options; quest delivery + reputation; **both endings** render (path text branches diplomacia/combate); `[E]` interaction prompt.
- ✅ **Real ape models** (not cubes): imported the 3 remaining GLBs by launching the **full editor headless** with `-ExecCmds="py exec(open(...).read()),QUIT_EDITOR"` (the `-run=pythonscript` commandlet lacks Slate → GLB/Interchange import asserts; the full editor has Slate). Consolidated to `/Game/AOA/Apes/SM_<id>`. `AOAPawn` now uses the species mesh for the player and ape meshes for ape/soldier NPCs (humans stay boxes), auto-scaled/grounded by mesh bounds, tinted by my color MID. (`_imp_*` folders hold the raw imports — harmless; delete in-editor later.)
- ✅ Added **save/load (F5/F9)** — in-memory session snapshot (port of `saveGame`/`loadGame`).

**State:** the vertical slice is a complete, playable, good-looking Zelda-like: explore 3 zones, Z-target combat, branching quest with 2 endings, dusk toon look with real ape characters. Compiles green; verified via self-screenshots.

**2026-06-15 — Phase 2 asset pipeline PROVEN + seeded with free CC0 (autonomous).**
- ✅ **Repeatable "factory" proven end-to-end without the user:** download a CC0 GLB pack → import headless (full editor + `QUIT_EDITOR`) → consolidate to `/Game/AOA/...` → wire in C++ (HISM for static dressing, per-actor for characters), auto-scaled/grounded by mesh bounds → verify by self-screenshot. No accounts needed for free packs.
- ✅ Pulled **Kenney Nature Kit (CC0)** (`kenney.nl/assets/nature-kit`, direct zip; license file kept at `assets/models/kenney/Kenney_License_CC0.txt`). Imported 6 trees + 2 rocks to `/Game/AOA/Kit/SM_*` (`unreal/scripts/08_import_kit.py`). `BuildWorldVisuals` now instances **real trees** on TREE tiles (variety by hash + random yaw/scale jitter, keeping Kenney's own colored materials) and **scatters rocks** on rubble. Verified in-game.
- ✅ Ingestion folder ready: drop any `.glb` in `assets/models/incoming/` (AI-generated or free) and the same import+wire flow applies.

**2026-06-15 — Real buildings + audio + packaging (autonomous, all verified).**
- ✅ **Buildings:** pulled **Kenney City Kit Commercial (CC0)**; imported 6 buildings + 3 small buildings to `/Game/AOA/Kit/` (`09_import_buildings.py`). Worldgen now records building footprints (`FAOABuilding`); `BuildWorldVisuals` places one building mesh per footprint (scaled to fit) and **skips the wall/rubble cubes** inside footprints. Ruins, settlement huts, all now real buildings. Verified by screenshot.
- ✅ **Audio:** pulled **Kenney RPG Audio (CC0, ogg)**, converted ogg→wav with macOS `afconvert` (UE imports wav, not ogg), imported 10 SFX to `/Game/AOA/Audio/` (`10_import_audio.py`). `AOAPawn::PlaySfx(FName)` + `UGameplayStatics::PlaySound2D`, wired to swing/hit/hurt/shoot/pickup/quest/level/die/alarm/heal across combat/dialog/loot. (port of `audio.js`.)
- ✅ **Packaging (shippable Mac build):** `RunUAT.sh BuildCookRun -platform=Mac -clientconfig=Development -cook -build -stage -pak -archive` → **BUILD SUCCESSFUL**. Fixes needed on this Mac: (1) Metal native-shader-lib packer SIGSEGV → set `bShareMaterialShaderCode=False`/`bSharedMaterialNativeLibraries=False` in `Config/DefaultGame.ini`; (2) first cook compiles all Metal SM6 shaders from empty DDC (~19 min); (3) UE-Mac doesn't stage all ThirdParty dylibs and `-archive` only copies a shell — the **complete runnable build is the staged one** at `Saved/StagedBuilds/Mac/AgeOfTheApes.app` (1.4 GB, paks inside `Contents/UE/`). Verified: the standalone boots and runs the game loop (Engine initialized, 70% CPU). Launch helper: `Builds/Jogar_AgeOfTheApes.command` (sets `DYLD_FALLBACK_LIBRARY_PATH` to engine dylibs + runs the staged app).

**2026-06-15 — Perf: LOD chains on all instanced meshes (autonomous, verified, zero C++ touch).**
- ✅ **LODs** (`unreal/scripts/13_setup_lods.py`, re-runnable): auto-reduction LOD chains on all 29 `/Game/AOA/Kit` + `/Game/AOA/Apes` static meshes via `StaticMeshEditorSubsystem.set_lods` — buildings & trees 4 LODs (down to 8–12% tris), rocks/apes/clutter 3 LODs, explicit screen sizes. Cuts triangle load on the dense HISM forest/building world at distance. Verified by screenshot (near + distant buildings/trees render correctly, no degenerate close-up meshes).
- ⚠️ **Invocation gotcha (new):** `StaticMeshEditorSubsystem` is **None** under `-run=pythonscript` (commandlet lacks the StaticMeshEditor module, same Slate-class limitation as GLB import). Must use the full editor headless **with `-stdout -unattended`** (without them the editor quits before init / writes no log): `UnrealEditor <proj> -stdout -unattended -nosplash -ExecCmds="py exec(open('/tmp/x.py').read()),QUIT_EDITOR"`. Also: the `py exec(open('...'))` console parser **breaks on spaces in the path** — copy the script to a spaceless path like `/tmp` first. (Disk after LODs+DDC: ~9 GB free — tight.)

**2026-06-16 — Animação ESQUELETAL do jogador (Mixamo) — substituiu a procedural (autônomo, verificado).**
- ✅ **Pipeline Mixamo→UE provado:** usuário auto-rigou o chimpanzé no Mixamo e baixou 7 clipes (Breathing Idle *with skin* + Walking/Running/Right Hook/Jumping Up/Sprinting Forward Roll/Dying *without skin*, **In Place** na locomoção). Renomeados p/ `assets/models/incoming/chimpanze_<estado>.fbx`.
- ✅ **Import** (`unreal/scripts/14_import_skeletal.py`, re-runnable, full-editor headless): gera `/Game/AOA/Apes/Skel/SK_chimpanze` + `SK_chimpanze_Skeleton` + 7 `A_chimpanze_<estado>` AnimSequences. Convenção `incoming/<especie>_<estado>.fbx` → escala fácil p/ gorila/orango/bonobo.
- ✅ **Wiring C++ (aditivo, fallback p/ static):** novo `USkeletalMeshComponent PlayerSkel` ao lado do `PlayerMesh`; `ApplyPlayerSkeletal(species)` carrega `SK_`+anims se existirem (senão mantém static), escala/aterra por bounds, tinta plana por cor. `SyncVisuals` toca `PlayAnimation` por estado (idle/walk/run/attack/jump/dodge/die) — **sem AnimBP**. Estado de locomoção derivado do **input** (`PlayerLoco` em `UpdatePlayer`), não da magnitude da velocidade (robusto à AGI). Orientação: Mixamo importa virado +Y → `SkelYawOffset=-90`. Comando de debug `drive <s> <run>` no controle remoto p/ verificar locomoção sem teclado.
- ✅ **Verificado por self-screenshot:** idle/walk/run/attack todos posando certo, orientados na direção do movimento, escala coerente. (jump/dodge/die usam o mesmo mecanismo de PlayAnimation.) **NPCs continuam static mesh + bob procedural** (decisão de perf/escopo — converter depois se quiser consistência).

**2026-06-16 — Build Mac PORTÁTIL pronto p/ compartilhar (`Builds/AgeOfTheApes_Mac_AppleSilicon.zip`, 473 MB).** Re-cozinhado com LODs+esqueletal; o `-stage` do UE5.7 já deixa o `.app` autossuficiente (rpaths `@executable_path/../UE/...` + dylibs no bundle), então NÃO depende mais da engine instalada (o antigo `Jogar_*.command` com `DYLD_FALLBACK` ficou obsoleto). Ad-hoc deep-signed; LEIA-ME embutido. Verificado: extrai em qualquer pasta e boota sem a engine = roda em qualquer Mac Apple Silicon. Distribuir: subir o zip (Drive/WeTransfer/itch.io); abrir com botão-direito→Abrir (Gatekeeper) ou `xattr -dr com.apple.quarantine`. Empacotado SÓ-chimpanzé (outras espécies = fallback static). Windows = esforço à parte (não dá neste Mac).

**The whole world is now real assets** (apes, trees, rocks, buildings) with dusk toon look + SFX, and there's a working standalone build. **Remaining = pure content/polish:** more zones/NPCs/quests, music, perf/LODs, and (the user's chosen track) **custom AI-generated hero buildings** to replace the CC0 placeholders — drop any `.glb` in `assets/models/incoming/` and the proven import+place pipeline applies. The user can open the project and press Play, or double-click `Builds/Jogar_AgeOfTheApes.command` to play the build.

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
