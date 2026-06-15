#!/usr/bin/env python3
"""
Send Python to the running editor via the AOA file watcher (init_unreal.py).

Writes the code to <project>/Saved/aoa_cmd.py, waits for the watcher to execute
it and update aoa_result.txt, then prints the result.

Usage:
  python3 _send.py path/to/script.py
  python3 _send.py -c "import unreal; unreal.log('hi')"
"""
import os
import sys
import time

SAVED = ("/Users/iagoamorim/Projects/Age of the Apes/unreal/AgeOfTheApes/Saved")
CMD = os.path.join(SAVED, "aoa_cmd.py")
RES = os.path.join(SAVED, "aoa_result.txt")
TIMEOUT = 60.0


def main():
    if len(sys.argv) < 2:
        print("usage: _send.py <script.py> | -c <statement>")
        return 2
    if sys.argv[1] == "-c":
        code = sys.argv[2]
    else:
        with open(sys.argv[1]) as f:
            code = f.read()

    before = os.path.getmtime(RES) if os.path.exists(RES) else 0
    with open(CMD, "w") as f:
        f.write(code)
    os.utime(CMD, None)  # ensure mtime bump

    deadline = time.time() + TIMEOUT
    while time.time() < deadline:
        if os.path.exists(RES) and os.path.getmtime(RES) > before:
            time.sleep(0.05)
            print(open(RES).read().rstrip())
            return 0
        time.sleep(0.2)
    print("ERROR: timed out waiting for editor. Is the watcher running and the "
          "editor in focus/ticking?")
    return 1


if __name__ == "__main__":
    sys.exit(main())
