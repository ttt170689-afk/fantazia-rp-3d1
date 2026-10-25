# Asset-only handoff — 2026-10-23

User clarified: sounds and GLB, more than 50 files (around 150); they will build their own Godot project. Supersedes WEB-upload <100-file constraint for this asset-only delivery. No Godot project, browser game changes, Git commit/push or deployment in this turn.

`dropbox/Fantazia-Assets-150.zip`: 150 files / 28,811,817 bytes.
- 128 new offline procedural SFX WAV (mono PCM16 44100 Hz): 32 footsteps (8 surfaces × 4 takes), 12 UI, 16 doors, 12 metro, 12 lab, 8 movement, 8 props, 16 combat/monster, 12 ambience.
- All 11 existing recorded AI voice MP3s, unchanged (4 city + 7 metro).
- All 3 existing music loops, unchanged (stereo PCM16 22050 Hz).
- 4 GLBs: player_super (27 clips), monster_super (12), player_hold (5, animation-only/no mesh), fantazia_city (349 meshes).
- README_RU.txt, DIALOGUES.csv (28 unrecorded NPC lines + 11 recorded subtitle references), MODELS.json, MANIFEST.json.

No new spoken dialogue was synthesized in this turn. CSV explicitly marks all 28 NPC catalogue entries `not_recorded`; subtitle references are not claimed to be verbatim MP3 transcripts. It does not purport to contain every UI/quest string.

City GLB compatibility fixes apply ONLY to the archive copy: 7,788 invalid normals normalized/reconstructed (degenerate fallback +Y), accessor bounds recalculated, 18 textured primitives given explicit zero UVs (same single-point sampling fallback; NOT recovered UV unwrapping). Runtime source remains unchanged. Other three GLBs are byte-for-byte copies. This GLB is the supplied city asset, NOT a full export of the procedural browser scene; metro/sky plaza/lab JS geometry is not included.

Khronos gltf-validator on all 4 final GLBs: zero errors; original player/monster skinned hierarchy warnings retained (27 / 71). No Godot editor import test performed. CRC and all 149 payload SHA256 hashes verified; payload hashes unique. All 131 WAVs checked for valid nonempty PCM, nonzero RMS, no digital clipping. No accounts, server, node_modules, project.godot, scenes or installers in ZIP.

Reproduce with `tools/package-godot-assets.py` and numpy. Optional `--validation` / `--final-validation` take JSON reports from gltf-validator. Staging is ignored under dropbox/; packager uses an explicit manifest so stale staging files never enter ZIP.
