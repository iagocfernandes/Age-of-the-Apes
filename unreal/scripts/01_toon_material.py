"""
Age of the Apes — Phase 1, step 1: Toon (cel) post-process material.

Creates /Game/AOA/Materials/M_PP_Toon, a Post Process material that posterizes
the scene color into flat cel-shading bands, then spawns an unbound Post Process
Volume in the current level and assigns the material to it.

Run from the Unreal editor Cmd box (bottom of the window):
    py "/Users/iagoamorim/Projects/Age of the Apes/unreal/scripts/01_toon_material.py"
"""

import unreal

MAT_PATH = "/Game/AOA/Materials"
MAT_NAME = "M_PP_Toon"
FULL_PATH = MAT_PATH + "/" + MAT_NAME
BANDS = 4.0  # number of luminance bands; lower = more "cartoon"
PPV_LABEL = "AOA_ToonPPV"

mel = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary


def log(msg):
    unreal.log("[AOA] " + msg)


# ---------------------------------------------------------------- material
def build_material():
    if eal.does_asset_exist(FULL_PATH):
        log("Material already exists, deleting to rebuild: " + FULL_PATH)
        eal.delete_asset(FULL_PATH)

    tools = unreal.AssetToolsHelpers.get_asset_tools()
    mat = tools.create_asset(MAT_NAME, MAT_PATH, unreal.Material,
                             unreal.MaterialFactoryNew())
    mat.set_editor_property("material_domain",
                            unreal.MaterialDomain.MD_POST_PROCESS)

    # Scene color input (the fully lit, tonemapped frame)
    scene = mel.create_material_expression(
        mat, unreal.MaterialExpressionSceneTexture, -800, 0)
    scene.set_editor_property(
        "scene_texture_id", unreal.SceneTextureId.PPI_POST_PROCESS_INPUT0)

    bands = mel.create_material_expression(
        mat, unreal.MaterialExpressionConstant, -800, 250)
    bands.set_editor_property("r", BANDS)

    # posterize: floor(color * bands) / bands
    mul = mel.create_material_expression(
        mat, unreal.MaterialExpressionMultiply, -500, 0)
    flr = mel.create_material_expression(
        mat, unreal.MaterialExpressionFloor, -300, 0)
    div = mel.create_material_expression(
        mat, unreal.MaterialExpressionDivide, -120, 0)

    mel.connect_material_expressions(scene, "Color", mul, "A")
    mel.connect_material_expressions(bands, "", mul, "B")
    mel.connect_material_expressions(mul, "", flr, "")
    mel.connect_material_expressions(flr, "", div, "A")
    mel.connect_material_expressions(bands, "", div, "B")
    mel.connect_material_property(
        div, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    mel.recompile_material(mat)
    eal.save_asset(FULL_PATH)
    log("Material built: " + FULL_PATH)
    return mat


# ------------------------------------------------------------ post process
def setup_volume(mat):
    actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    # reuse our volume if it already exists
    ppv = None
    for a in actor_sub.get_all_level_actors():
        if a.get_actor_label() == PPV_LABEL:
            ppv = a
            break
    if ppv is None:
        ppv = actor_sub.spawn_actor_from_class(
            unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
        ppv.set_actor_label(PPV_LABEL)

    ppv.set_editor_property("unbound", True)          # affects whole level
    ppv.set_editor_property("priority", 1.0)

    settings = ppv.get_editor_property("settings")
    blendable = unreal.WeightedBlendable(1.0, mat)
    wb = unreal.WeightedBlendables()
    wb.set_editor_property("array", [blendable])
    settings.set_editor_property("weighted_blendables", wb)
    ppv.set_editor_property("settings", settings)

    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    les.save_current_level()
    log("Post Process Volume ready: " + PPV_LABEL)


# ----------------------------------------------------------------- run
mat = build_material()
setup_volume(mat)
log("DONE — toon cel-shading active. Tweak BANDS in the script to taste.")
unreal.log_warning("[AOA] Toon material applied. If the scene didn't change, "
                   "check the Output Log for errors above.")
