"""
Age of the Apes — Phase 1, step 4: dusk mood.

Low warm sun + darker sky ambient + denser warm volumetric fog + bloom/vignette,
to give the "atmospheric N64+" evening look. Each block is guarded so one bad
property name reports without aborting the rest.
"""
import unreal

asys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
actors = {a.get_actor_label(): a for a in asys.get_all_level_actors()}


def get_comp(actor, cls):
    return actor.get_component_by_class(cls)


def section(name, fn):
    try:
        fn()
        print("OK  ", name)
    except Exception as e:
        print("ERR ", name, "->", e)


# --- low warm sun ---
def sun():
    a = actors["DirectionalLight"]
    a.set_actor_rotation(unreal.Rotator(0.0, -8.0, -55.0), False)
    c = get_comp(a, unreal.DirectionalLightComponent)
    c.set_editor_property("intensity", 4.0)
    c.set_light_color(unreal.LinearColor(1.0, 0.55, 0.30))
section("sun (low, warm)", sun)


# --- darker ambient sky ---
def sky():
    a = actors["SkyLight"]
    c = get_comp(a, unreal.SkyLightComponent)
    c.set_editor_property("intensity", 0.5)
    try:
        c.recapture_sky()
    except Exception:
        pass
section("sky light (dimmer)", sky)


# --- denser warm fog ---
def fog():
    a = actors["ExponentialHeightFog"]
    c = get_comp(a, unreal.ExponentialHeightFogComponent)
    c.set_editor_property("fog_density", 0.04)
    c.set_editor_property("fog_height_falloff", 0.2)
    c.set_editor_property("start_distance", 1000.0)
    c.set_editor_property("fog_inscattering_luminance",
                          unreal.LinearColor(0.55, 0.40, 0.35))
    c.set_editor_property("enable_volumetric_fog", True)
section("fog (dense, warm)", fog)


# --- bloom + vignette on the toon volume (preserve its blendable) ---
def grade():
    ppv = actors["AOA_ToonPPV"]
    s = ppv.get_editor_property("settings")
    s.set_editor_property("bloom_method", unreal.BloomMethod.BM_SOG)
    s.set_editor_property("override_bloom_intensity", True)
    s.set_editor_property("bloom_intensity", 1.4)
    s.set_editor_property("override_vignette_intensity", True)
    s.set_editor_property("vignette_intensity", 0.5)
    s.set_editor_property("override_color_saturation", True)
    s.set_editor_property("color_saturation", unreal.Vector4(1.05, 1.05, 1.0, 1.0))
    ppv.set_editor_property("settings", s)
section("bloom + vignette + grade", grade)


unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
print("[AOA] dusk mood applied")
