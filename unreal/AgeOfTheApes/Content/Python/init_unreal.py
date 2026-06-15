"""
AOA command watcher.

Runs inside the Unreal editor. Polls a command file every editor tick; when it
changes, executes its Python contents on the game thread and writes captured
output + status to a result file. This lets the assistant drive the live editor
through plain files (no multicast / remote-execution needed).

Auto-starts on editor launch (init_unreal.py is run automatically when the
Python plugin is enabled). To start it in an already-open editor without
restarting, run this file once from the Cmd box:
    py "/Users/iagoamorim/Projects/Age of the Apes/unreal/AgeOfTheApes/Content/Python/init_unreal.py"

Protocol (paths under the project's Saved/ folder):
    aoa_cmd.py       <- assistant writes Python here; bump mtime to trigger
    aoa_result.txt   -> editor writes "OK\\n"/"FAIL\\n" + stdout (+ traceback)
"""
import os
import io
import contextlib
import traceback

import unreal

_PROJ_SAVED = unreal.Paths.convert_relative_path_to_full(
    unreal.Paths.project_saved_dir())
_CMD = os.path.join(_PROJ_SAVED, "aoa_cmd.py")
_RES = os.path.join(_PROJ_SAVED, "aoa_result.txt")

_STATE = {"mtime": None, "handle": None}


def _run_cmd():
    code = open(_CMD, "r").read()
    buf = io.StringIO()
    ok = True
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            exec(compile(code, _CMD, "exec"),
                 {"unreal": unreal, "__name__": "__main__"})
    except Exception:
        ok = False
        buf.write("\n---TRACEBACK---\n" + traceback.format_exc())
    with open(_RES, "w") as f:
        f.write(("OK\n" if ok else "FAIL\n") + buf.getvalue())


def _tick(_delta):
    try:
        if not os.path.exists(_CMD):
            return
        m = os.path.getmtime(_CMD)
        if m == _STATE["mtime"]:
            return
        _STATE["mtime"] = m
        _run_cmd()
    except Exception:
        try:
            with open(_RES, "w") as f:
                f.write("FAIL\n---WATCHER TRACEBACK---\n"
                        + traceback.format_exc())
        except Exception:
            pass


def start():
    if _STATE["handle"] is not None:
        unreal.log("[AOA] watcher already running")
        return
    # ignore any pre-existing command so we don't re-run stale work on boot
    if os.path.exists(_CMD):
        _STATE["mtime"] = os.path.getmtime(_CMD)
    _STATE["handle"] = unreal.register_slate_post_tick_callback(_tick)
    unreal.log("[AOA] watcher started; cmd=" + _CMD)


start()
