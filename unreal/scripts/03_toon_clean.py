"""
Age of the Apes — Phase 1, step 3: CLEAN toon (outline only, no posterize).

The full-frame posterize looked bad (sky banding + per-channel hue blotches on
the floor), so this version drops it and keeps a clean, thresholded outline over
the natural scene colors. The threshold suppresses small normal variations (the
floor's tile normal map) so lines appear only on real silhouettes and creases.

Rebuilds /Game/AOA/Materials/M_PP_Toon and re-assigns it to AOA_ToonPPV.

Run from the Unreal editor Cmd box:
    py "/Users/iagoamorim/Projects/Age of the Apes/unreal/scripts/03_toon_clean.py"

Tweakables:
    OUTLINE_THRESHOLD  raise to remove MORE small lines (floor noise)
    OUTLINE_GAIN       higher = harder/darker lines once past the threshold
    OUTLINE_THICKNESS  line width in pixels
"""

import unreal

MAT_PATH = "/Game/AOA/Materials"
MAT_NAME = "M_PP_Toon"
FULL_PATH = MAT_PATH + "/" + MAT_NAME
PPV_LABEL = "AOA_ToonPPV"

OUTLINE_THICKNESS = 1.2
OUTLINE_THRESHOLD = 0.22    # normal-diff below this = ignored (kills floor noise)
OUTLINE_GAIN = 13.0
OUTLINE_COLOR = (0.02, 0.02, 0.03)

mel = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary


def log(m):
    unreal.log("[AOA] " + m)


def expr(mat, cls, x, y):
    return mel.create_material_expression(mat, cls, x, y)


def build():
    if eal.does_asset_exist(FULL_PATH):
        eal.delete_asset(FULL_PATH)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset(MAT_NAME, MAT_PATH, unreal.Material,
                             unreal.MaterialFactoryNew())
    mat.set_editor_property("material_domain",
                            unreal.MaterialDomain.MD_POST_PROCESS)

    # natural scene color (unchanged) -> this is what shows everywhere but edges
    scene = expr(mat, unreal.MaterialExpressionSceneTexture, -1500, -200)
    scene.set_editor_property("scene_texture_id",
                              unreal.SceneTextureId.PPI_POST_PROCESS_INPUT0)

    # ----- normal-based edge detection (4 neighbours) -----
    screen_uv = expr(mat, unreal.MaterialExpressionScreenPosition, -1500, 400)
    center = expr(mat, unreal.MaterialExpressionSceneTexture, -1500, 600)
    center.set_editor_property("scene_texture_id",
                               unreal.SceneTextureId.PPI_WORLD_NORMAL)
    thick = expr(mat, unreal.MaterialExpressionConstant, -1500, 800)
    thick.set_editor_property("r", OUTLINE_THICKNESS)

    offsets = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    accum = None
    y = 350
    for ox, oy in offsets:
        c2 = expr(mat, unreal.MaterialExpressionConstant2Vector, -1250, y)
        c2.set_editor_property("r", float(ox))
        c2.set_editor_property("g", float(oy))
        m1 = expr(mat, unreal.MaterialExpressionMultiply, -1050, y)
        mel.connect_material_expressions(c2, "", m1, "A")
        mel.connect_material_expressions(center, "InvSize", m1, "B")
        m2 = expr(mat, unreal.MaterialExpressionMultiply, -900, y)
        mel.connect_material_expressions(m1, "", m2, "A")
        mel.connect_material_expressions(thick, "", m2, "B")
        add = expr(mat, unreal.MaterialExpressionAdd, -750, y)
        mel.connect_material_expressions(screen_uv, "ViewportUV", add, "A")
        mel.connect_material_expressions(m2, "", add, "B")
        nb = expr(mat, unreal.MaterialExpressionSceneTexture, -600, y)
        nb.set_editor_property("scene_texture_id",
                               unreal.SceneTextureId.PPI_WORLD_NORMAL)
        mel.connect_material_expressions(add, "", nb, "UV")
        sub = expr(mat, unreal.MaterialExpressionSubtract, -420, y)
        mel.connect_material_expressions(nb, "Color", sub, "A")
        mel.connect_material_expressions(center, "Color", sub, "B")
        dot = expr(mat, unreal.MaterialExpressionDotProduct, -260, y)
        mel.connect_material_expressions(sub, "", dot, "A")
        mel.connect_material_expressions(sub, "", dot, "B")
        if accum is None:
            accum = dot
        else:
            a = expr(mat, unreal.MaterialExpressionAdd, -100, y)
            mel.connect_material_expressions(accum, "", a, "A")
            mel.connect_material_expressions(dot, "", a, "B")
            accum = a
        y += 120

    # edge = saturate((accum - threshold) * gain)
    thr = expr(mat, unreal.MaterialExpressionConstant, 60, 250)
    thr.set_editor_property("r", OUTLINE_THRESHOLD)
    sub_t = expr(mat, unreal.MaterialExpressionSubtract, 220, 320)
    mel.connect_material_expressions(accum, "", sub_t, "A")
    mel.connect_material_expressions(thr, "", sub_t, "B")
    gain = expr(mat, unreal.MaterialExpressionConstant, 60, 420)
    gain.set_editor_property("r", OUTLINE_GAIN)
    emul = expr(mat, unreal.MaterialExpressionMultiply, 380, 350)
    mel.connect_material_expressions(sub_t, "", emul, "A")
    mel.connect_material_expressions(gain, "", emul, "B")
    clamp = expr(mat, unreal.MaterialExpressionClamp, 540, 350)
    clamp.set_editor_property("min_default", 0.0)
    clamp.set_editor_property("max_default", 1.0)
    mel.connect_material_expressions(emul, "", clamp, "")

    # final = lerp(sceneColor, outlineColor, edgeMask)  (both float4)
    black = expr(mat, unreal.MaterialExpressionConstant4Vector, 540, 150)
    black.set_editor_property(
        "constant",
        unreal.LinearColor(OUTLINE_COLOR[0], OUTLINE_COLOR[1],
                           OUTLINE_COLOR[2], 1.0))
    lerp = expr(mat, unreal.MaterialExpressionLinearInterpolate, 760, 0)
    mel.connect_material_expressions(scene, "Color", lerp, "A")
    mel.connect_material_expressions(black, "", lerp, "B")
    mel.connect_material_expressions(clamp, "", lerp, "Alpha")
    mel.connect_material_property(lerp, "",
                                 unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    mel.recompile_material(mat)
    eal.save_asset(FULL_PATH)
    log("Clean outline material built.")
    return mat


def reassign(mat):
    actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    ppv = None
    for a in actor_sub.get_all_level_actors():
        if a.get_actor_label() == PPV_LABEL:
            ppv = a
            break
    if ppv is None:
        ppv = actor_sub.spawn_actor_from_class(
            unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
        ppv.set_actor_label(PPV_LABEL)
        ppv.set_editor_property("unbound", True)
        ppv.set_editor_property("priority", 1.0)
    settings = ppv.get_editor_property("settings")
    wb = unreal.WeightedBlendables()
    wb.set_editor_property("array", [unreal.WeightedBlendable(1.0, mat)])
    settings.set_editor_property("weighted_blendables", wb)
    ppv.set_editor_property("settings", settings)
    unreal.get_editor_subsystem(
        unreal.LevelEditorSubsystem).save_current_level()
    log("Re-assigned to " + PPV_LABEL)


mat = build()
reassign(mat)
log("DONE — clean outline over natural colors. Tune OUTLINE_THRESHOLD/GAIN.")
