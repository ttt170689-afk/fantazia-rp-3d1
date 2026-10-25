#!/usr/bin/env python3
"""First-open regression on a disposable copy with no editor cache.

Checks the actual editor filesystem/import pipeline, not just game startup.
Also rejects reintroduced GLB recipes, extracted textures and hidden cache dependencies.
"""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--godot', default='godot')
    parser.add_argument('--project', type=Path, default=ROOT / 'godot-pc')
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--test-without-sources', action='store_true')
    parser.add_argument('--latest-world', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='fz-editor04-') as work:
        project = Path(work) / 'project'
        def ignored(folder, names):
            return [n for n in names if n in {'.godot', 'exports', '__pycache__'}
                    or n.endswith('.log')
                    or re.fullmatch(r'(city|player)_\d+\.png(?:\.import)?', n)]
        shutil.copytree(args.project, project, ignore=ignored)
        assert not (project / '.godot').exists()
        result = subprocess.run(
            [args.godot, '--headless', '--editor', '--import', '--path', str(project), '--quit'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=180,
        )
        output = re.sub(r'\x1b\[[0-9;]*m', '', result.stdout)
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text(output)
        print(output)
        assert result.returncode == 0, 'Editor import failed'
        assert 'ERROR:' not in output and 'SCRIPT ERROR' not in output, 'Editor errors'
        assert 'city.glb' not in output and 'player.glb' not in output, 'Unexpected GLB import'
        cache = project / '.godot' / 'imported'
        names = sorted(p.name for p in cache.iterdir() if p.is_file()) if cache.exists() else []
        assert not names, names
        assert not list((project / 'source_models').glob('*.import')), 'Source model was imported'
        assert not list((project / 'assets').glob('*.png')), 'Textures were extracted'
        assert not list((project / 'assets').glob('*.scn.import')), 'Native scene was imported'
        if args.test_without_sources:
            # A disposable copy only. Prove gameplay never falls back to the GLBs.
            shutil.rmtree(project / 'source_models')
            game = subprocess.run(
                [args.godot, '--headless', '--path', str(project), '--fixed-fps', '60',
                 '--quit-after', '40000', '--script', 'tests/launcher03.gd', '--', '--test'],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=180,
            )
            args.log.with_suffix('.runtime.txt').write_text(game.stdout)
            assert game.returncode == 0 and 'LAUNCHER_RESULT checks=94 failures=0' in game.stdout
            assert 'ERROR:' not in game.stdout and 'SCRIPT ERROR' not in game.stdout
            print('NO_GLB_RUNTIME_RESULT checks=94 failures=0')
            if args.latest_world:
                latest = subprocess.run(
                    [args.godot, '--headless', '--path', str(project), '--fixed-fps', '60',
                     '--quit-after', '40000', '--script', 'tests/latest05.gd', '--', '--test'],
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=180)
                args.log.with_suffix('.latest-runtime.txt').write_text(latest.stdout)
                assert latest.returncode == 0 and 'LATEST_RESULT checks=54 failures=0' in latest.stdout
                assert 'ERROR:' not in latest.stdout and 'SCRIPT ERROR' not in latest.stdout
                print('NO_GLB_LATEST_RESULT checks=54 failures=0')
        print(json.dumps({'EDITOR04_RESULT' : 'PASS', 'clean_cache': True,
                          'model_imports': 0, 'cache_entries': names}, indent=2))


if __name__ == '__main__':
    main()
