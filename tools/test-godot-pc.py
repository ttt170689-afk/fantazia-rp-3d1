#!/usr/bin/env python3
"""Run the native Godot physics/input regression suite; no GUI claim is implied."""
import argparse
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--godot", default="godot", help="Path to a Godot 4.5.1+ executable")
    parser.add_argument("--project", type=Path, default=ROOT / "godot-pc")
    parser.add_argument("--log", type=Path)
    parser.add_argument("--bootstrap-template-cache", action="store_true",
                        help="For a source-built non-editor test engine only: initialize an empty global class registry")
    args = parser.parse_args()
    if args.bootstrap_template_cache:
        # A template-only engine cannot generate the editor's global class registry.
        # This project uses explicit preloads, not class_name declarations.
        for script in args.project.rglob("*.gd"):
            if ".godot" not in script.parts and re.search(r"^class_name\s", script.read_text(), re.M):
                raise SystemExit("Cannot bootstrap an empty registry when named classes exist")
        cache = args.project / ".godot/global_script_class_cache.cfg"
        if not cache.exists():
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text("list=[]\n")
    command = [args.godot, "--headless", "--path", str(args.project.resolve()),
               "--fixed-fps", "60", "--quit-after", "40000", "--script",
               "tests/test_prototype.gd", "--", "--test"]
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, timeout=180, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"Native test could not complete: {exc}", file=sys.stderr)
        return 1
    print(result.stdout, end="")
    if args.log:
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text(result.stdout)
    match = re.search(r"PROTOTYPE_RESULT checks=(\d+) failures=(\d+)", result.stdout)
    passed = (result.returncode == 0 and match is not None and int(match.group(1)) >= 138
              and int(match.group(2)) == 0 and "SCRIPT ERROR" not in result.stdout
              and "ERROR:" not in result.stdout)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
