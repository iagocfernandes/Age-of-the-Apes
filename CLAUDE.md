# Age of the Apes — project instructions

Zelda-like action-adventure (exploration + Z-targeting combat + branching quests) with stylized **"a notch above N64"** toon graphics, built in **Unreal Engine 5.7**.

The original **Three.js prototype** (`index3d.html`, `js/*.js`) is the **design spec** — its systems (Z-targeting combat, factions, reputation, branching main quest with 2 endings) are to be re-implemented in UE5, not shipped.

Full plan and progress log: **`PRODUCTION_PLAN.md`**.

## How the user works with me
- The user (Iago, replies in **Portuguese-BR**) delegates coordination: **drive autonomously, only ask for what only he can do** — GUI-only editor actions, restarting the editor, direction-changing decisions, external accounts/browser (AI asset tools), spending money, and **visual judgment via screenshots** (I can't reliably self-capture).
- Tooling budget: **free tier only**.

## Driving the live Unreal editor (no GUI clicks)
A file-watcher auto-runs on editor launch (`unreal/AgeOfTheApes/Content/Python/init_unreal.py`) and polls `Saved/aoa_cmd.py`. To run Python in the open editor from the shell:

```
python3 "unreal/scripts/_send.py" unreal/scripts/<name>.py     # run a file
python3 "unreal/scripts/_send.py" -c "import unreal; print(...)"  # run a statement
```

It prints the editor's captured **stdout** (use `print()`, not `unreal.log()`) plus `OK`/`FAIL`+traceback. Requires the editor open with the AgeOfTheApes project.

### Gotchas (learned the hard way)
- `connect_material_expressions` fails **silently** on wrong pin names; a material that won't compile is **silently skipped** by the renderer (scene looks normal). Lerp inputs must match dimensions (float4 vs float3 = compile fail).
- Verify property/pin names against the generated stub: `unreal/AgeOfTheApes/Intermediate/PythonStub/unreal.py` (e.g. SkyLight uses `intensity`, fog uses `enable_volumetric_fog`).
- Multicast remote-exec (`_run.py`) does NOT work on this Mac (loopback multicast) — always use the watcher (`_send.py`).
- Editor screenshot-to-file (HighResShot / take_high_res_screenshot) did NOT produce files in editor-only mode — ask the user for screenshots.
- The Mac is a near-full 256 GB drive — watch disk space.

## Current state (2026-06-14)
- **Phase 0 ✅** project + Git LFS; macOS blockers fixed (Metal Toolchain installed, ~33 GB freed).
- **Phase 1 ✅ (toon look signed off):** `M_PP_Toon` post-process outline (`unreal/scripts/03_toon_clean.py`) + dusk lighting/fog/bloom (`unreal/scripts/04_dusk_mood.py`) via the `AOA_ToonPPV` volume. GLB import validated.
- **Next:** Phase 2 (AI asset pipeline — needs user's browser/AI-3D accounts) and Phase 3 (gameplay port from the JS spec).

## Conventions
- All our UE content lives under `Content/AOA/` (Characters/Environments/Materials/Props/Blueprints/UI).
- New automation goes in `unreal/scripts/` as numbered, re-runnable scripts.
- Imported GLBs need Blender prep (origin-to-bottom, scale) — pivot/scale issues on import are expected, not bugs.
- `.gitignore`/`.gitattributes` already keep UE cache out of git and route binaries to LFS. Commit only when the user asks.
