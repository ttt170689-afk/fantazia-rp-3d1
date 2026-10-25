#!/usr/bin/env python3
"""Run all native 04 gates and bind their results to the tested source bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def source_snapshot(project):
    suffixes = {'.gd', '.uid', '.tscn', '.tres', '.scn', '.godot', '.cfg', '.glb', '.svg', '.cmd'}
    result = {}
    for path in sorted(project.rglob('*')):
        relative = path.relative_to(project)
        if any(part in {'.godot', 'exports', '__pycache__'} for part in relative.parts):
            continue
        if path.is_file() and (path.suffix in suffixes or path.name == '.gdignore'
                               or relative.as_posix() in {'assets/baked-manifest.json', 'assets/provenance.json'}):
            result[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--godot', default='godot')
    parser.add_argument('--project', type=Path, default=ROOT / 'godot-pc')
    args = parser.parse_args()
    project = args.project.resolve()
    records = {}
    for script, marker, count, filename in [
        ('test_prototype.gd', 'PROTOTYPE_RESULT', 138, 'RESULTS.txt'),
        ('launcher03.gd', 'LAUNCHER_RESULT', 94, 'LAUNCHER-RESULTS.txt'),
        ('native04.gd', 'NATIVE_RESULT', 27, 'NATIVE-RESULTS.txt'),
    ]:
        result = subprocess.run(
            [args.godot, '--headless', '--path', str(project), '--fixed-fps', '60',
             '--quit-after', '40000', '--script', 'tests/' + script, '--', '--test'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=180,
        )
        (project / 'tests' / filename).write_text(result.stdout)
        print(result.stdout, end='')
        match = re.search(rf'{marker} checks=(\d+) failures=(\d+)', result.stdout)
        assert result.returncode == 0 and match and int(match[1]) >= count and int(match[2]) == 0
        assert 'ERROR:' not in result.stdout and 'SCRIPT ERROR' not in result.stdout
        records[script] = {'checks': int(match[1]), 'failures': 0,
                           'warnings': [s for s in result.stdout.splitlines() if 'WARNING:' in s]}
    # Uses another fresh disposable copy, with no cache; then tests without raw GLBs.
    subprocess.run([
        sys.executable, str(ROOT / 'tools/test-godot-editor.py'), '--godot', args.godot,
        '--project', str(project), '--log', str(project / 'tests/EDITOR-IMPORT.txt'),
        '--test-without-sources',
    ], check=True, timeout=380)
    engine = subprocess.check_output([args.godot, '--version'], text=True).strip()
    stamp = {'version': '0.4.0', 'engine': engine, 'tests': records,
             'editor_clean_copy': True, 'automatic_imports': 0,
             'runtime_without_glbs': True, 'files': source_snapshot(project)}
    (project / 'tests/VERIFIED-04.json').write_text(json.dumps(stamp, indent=2) + '\n')
    print('RELEASE04_RESULT PASS')


if __name__ == '__main__':
    main()
