#!/usr/bin/env python3
"""
Remote runner: sends a Python script (or statement) to the running Unreal editor
via Unreal's Python Remote Execution, prints the editor's output back here.

This lets the assistant apply changes to the live editor without the user pasting
commands each time. Requires:
  - PythonScriptPlugin + Remote Execution enabled (DefaultEngine.ini)
  - The AgeOfTheApes editor open

Usage:
  python3 _run.py path/to/script.py        # execute a file in the editor
  python3 _run.py -c "import unreal; unreal.log('hi')"   # execute a statement
"""
import os
import sys
import time

ENGINE_PY = ("/Users/Shared/UnrealEngine/UE_5.7/Engine/Plugins/Experimental/"
             "PythonScriptPlugin/Content/Python")
sys.path.append(ENGINE_PY)

import remote_execution as remote  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("usage: _run.py <script.py> | -c <statement>")
        return 2

    if sys.argv[1] == "-c":
        mode = remote.MODE_EXEC_STATEMENT
        command = sys.argv[2]
    else:
        mode = remote.MODE_EXEC_FILE
        command = os.path.abspath(sys.argv[1])
        if not os.path.exists(command):
            print("file not found:", command)
            return 2

    # The editor binds remote-exec multicast to loopback (127.0.0.1:6766), so the
    # client must use the same interface or discovery packets never meet.
    config = remote.RemoteExecutionConfig()
    config.multicast_bind_address = "127.0.0.1"
    rexec = remote.RemoteExecution(config)
    rexec.start()

    # wait for the editor node to announce itself
    node = None
    for _ in range(40):
        nodes = rexec.remote_nodes
        if nodes:
            node = nodes[0]
            break
        time.sleep(0.25)
    if not node:
        rexec.stop()
        print("ERROR: no Unreal editor node found. Is the editor open with "
              "Remote Execution enabled (restart after enabling)?")
        return 1

    rexec.open_command_connection(node["node_id"])
    try:
        res = rexec.run_command(command, unattended=True, exec_mode=mode,
                                raise_on_failure=False)
    finally:
        rexec.close_command_connection()
        rexec.stop()

    for line in res.get("output") or []:
        print(line.get("output", "").rstrip())
    if not res.get("success"):
        print("---- COMMAND FAILED ----")
        print(res.get("result", ""))
        return 1
    print("---- OK ----")
    return 0


if __name__ == "__main__":
    sys.exit(main())
