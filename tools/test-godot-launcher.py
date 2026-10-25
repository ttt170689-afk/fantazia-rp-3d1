#!/usr/bin/env python3
"""Test the actual 2D entry scene, cancellation, and repeat launch/return lifecycle."""
import argparse
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--godot', default='godot')
    parser.add_argument('--project', type=Path, default=ROOT / 'godot-pc')
    parser.add_argument('--log', type=Path)
    args = parser.parse_args()
    command = [args.godot, '--headless', '--path', str(args.project.resolve()),
               '--fixed-fps', '60', '--quit-after', '40000', '--script',
               'tests/launcher03.gd', '--', '--test']
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, timeout=180, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(exc, file=sys.stderr)
        return 1
    print(result.stdout, end='')
    if args.log:
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text(result.stdout)
    match = re.search(r'LAUNCHER_RESULT checks=(\d+) failures=(\d+)', result.stdout)
    return 0 if (result.returncode == 0 and match and int(match[1]) >= 94
                 and int(match[2]) == 0 and 'ERROR:' not in result.stdout
                 and 'SCRIPT ERROR' not in result.stdout) else 1


if __name__ == '__main__':
    sys.exit(main())
