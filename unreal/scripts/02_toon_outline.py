"""
Age of the Apes — Phase 1, step 2: Toon material with OUTLINES.

Rebuilds /Game/AOA/Materials/M_PP_Toon adding a normal-based edge-detection
outline on top of the cel-shading posterize, then re-assigns it to the
AOA_ToonPPV post-process volume.

Normal-based edges are resolution/scale independent: we sample the scene
world-normal at 4 neighbours, and where the normal changes sharply (silhouettes
and creases) we paint a dark contour line.

Run from the Unreal editor Cmd box:
    py "/Users/iagoamorim/Projects/Age of the Apes/unreal/scripts/02_toon_outline.py"

Tweakables below: BANDS (cartoon strength), OUTLINE_THICKNESS, OUTLINE_GAIN
(higher = more/thicker lines), OUTLINE_COLOR.
"""

import unreal

MAT_PATH = "/Game/AOA/Materials"
MAT_NAME = "M_PP_Toon"
FULL_PATH = MAT_PATH + "/" + MAT_NAME
PPV_LABEL = "AOA_ToonPPV"

BANDS = 5.0
OUTLINE_THICKNESS = 1.0     # in pixels
OUTLINE_GAIN = 3.0          # higher = lines appear for smaller normal changes
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

    # ---------- cel-shade posterize: floor(sceneColor * BANDS) / BANDS ----
    scene = expr(mat, unreal.MaterialExpressionSceneTexture, -1500, -200)
    scene.set_editor_property("scene_texture_id",
                              unreal.SceneTextureId.PPI_POST_PROCESS_INPUT0)
    bands = expr(mat, unreal.MaterialExpressionConstant, -1500, 0)
    bands.set_editor_property("r", BANDS)
    mul = expr(mat, unreal.MaterialExpressionMultiply, -1250, -150)
    flr = expr(mat, unreal.MaterialExpressionFloor, -1050, -150)
    div = expr(mat, unreal.MaterialExpressionDivide, -850, -150)
    mel.connect_material_expressions(scene, "Color", mul, "A")
    mel.connect_material_expressions(bands, "", mul, "B")
    mel.connect_material_expressions(mul, "", flr, "")
    mel.connect_material_expressions(flr, "", div, "A")
    mel.connect_material_expressions(bands, "", div, "B")
    poster = div

    # ---------- outline: sum of squared world-normal diffs at 4 neighbours
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
        # offset(px) * texelSize * thickness
        m1 = expr(mat, unreal.MaterialExpressionMultiply, -1050, y)
        mel.connect_material_expressions(c2, "", m1, "A")
        mel.connect_material_expressions(center, "InvSize", m1, "B")
        m2 = expr(mat, unreal.MaterialExpressionMultiply, -900, y)
        mel.connect_material_expressions(m1, "", m2, "A")
        mel.connect_material_expressions(thick, "", m2, "B")
        # neighbour UV
        add = expr(mat, unreal.MaterialExpressionAdd, -750, y)
        mel.connect_material_expressions(screen_uv, "ViewportUV", add, "A")
        mel.connect_material_expressions(m2, "", add, "B")
        # sample neighbour normal
        nb = expr(mat, unreal.MaterialExpressionSceneTexture, -600, y)
        nb.set_editor_property("scene_texture_id",
                              unreal.SceneTextureId.PPI_WORLD_NORMAL)
        mel.connect_material_expressions(add, "", nb, "UV")
        # diff vs center, squared length
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

    # edge mask = saturate(accum * gain)
    gain = expr(mat, unreal.MaterialExpressionConstant, 60, 350)
    gain.set_editor_property("r", OUTLINE_GAIN)
    emul = expr(mat, unreal.MaterialExpressionMultiply, 220, 350)
    mel.connect_material_expressions(accum, "", emul, "A")
    mel.connect_material_expressions(gain, "", emul, "B")
    clamp = expr(mat, unreal.MaterialExpressionClamp, 380, 350)
    clamp.set_editor_property("min_default", 0.0)
    clamp.set_editor_property("max_default", 1.0)
    mel.connect_material_expressions(emul, "", clamp, "")

    # final = lerp(posterColor, outlineColor, edgeMask)
    # NB: poster is float4 (RGBA scene color), so the outline color must also be
    # float4 (Constant4Vector) or the Lerp fails to compile and the material is
    # silently skipped by the renderer.
    black = expr(mat, unreal.MaterialExpressionConstant4Vector, 380, 150)
    black.set_editor_property(
        "constant",
        unreal.LinearColor(OUTLINE_COLOR[0], OUTLINE_COLOR[1],
                           OUTLINE_COLOR[2], 1.0))
    lerp = expr(mat, unreal.MaterialExpressionLinearInterpolate, 560, 0)
    mel.connect_material_expressions(poster, "", lerp, "A")
    mel.connect_material_expressions(black, "", lerp, "B")
    mel.connect_material_expressions(clamp, "", lerp, "Alpha")

    mel.connect_material_property(lerp, "",
                                 unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(mat)
    eal.save_asset(FULL_PATH)
    log("Material rebuilt with outline.")
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
log("DONE — cel shading + outline. Tune OUTLINE_GAIN / _THICKNESS / BANDS.")
