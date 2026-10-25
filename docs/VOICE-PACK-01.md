# Expressive dialogue asset pack 01 — 2026-10-23

User asked for more expressive voiceover for everything and dialogues, continuing the asset-only Godot handoff. Two new character voices auditioned and selected in this turn: masculine `voice-02`, feminine `voice-03`. Existing announcer `voice-01` retained in the cumulative pack.

Generated 10 separate successful MP3s under `resources/voice-pack-01/audio/`; full generation text, intended emotional direction and original NPC IDs are in `catalog.json`. Eight expanded source NPC lines (merchant 01/03, worker 02/05, shopper 02, tourist 01/04, default 04) plus two original optional scene lines (lab warning, relieved exit). Scenes are assets, not implemented gameplay. No speech markup/emotion API used: intention conveyed by wording, punctuation, pauses and character voice selection; no claim of guaranteed acting quality.

All 10 MP3s successfully decoded with miniaudio, finite/nonzero signal; RMS ~0.100–0.110. Total MP3 metadata duration 138.92 seconds (~2:19). No new browser/Godot code integration, no new SFX or GLBs and no commit/push/deploy.

Deliverables:
- `dropbox/Fantazia-Voice-Pack-01.zip`: 13 files, 1,047,986 bytes — 10 MP3, DIALOGUES.csv, README_RU.txt, MANIFEST.json.
- `dropbox/Fantazia-Assets-Voice01.zip`: 162 files, 29,863,113 bytes — cumulative previous 150-file resources plus 10 new MP3 and 2 pack metadata files; root dialogue table/readme/manifest updated. All previous GLBs/music/SFX/voices preserved byte-for-byte.

Cumulative dialogue table: 41 rows, 21 audio references (all verified), 20 source NPC lines still marked `not_recorded`. Expanded scripts are not represented as verbatim original dialogue: original_text retained, voice_status=recorded_expanded. Two scene lines explicitly marked recorded_new_scene. Previously recorded subtitles remain subtitle references, not asserted verbatim transcripts.

ZIP CRC and every manifest SHA256 verified. Source packager: `tools/package-voice-pack.py` (mutagen metadata dependency). Prior `Fantazia-Assets-150.zip` remains unchanged. Entire game dialogue is NOT yet fully voiced; 10-generation-per-turn limit reached.
