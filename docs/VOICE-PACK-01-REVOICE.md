# Dialogue pack 01 — replacement voices, 2026-10-23

User rejected character voices voice-02 and voice-03. Fresh auditions (index 1, conversational) selected masculine voice-04 and feminine voice-05. All ten clips were re-generated successfully with the selected new voices; scripts rewritten with more restrained conversational wording. Existing announcer voice-01 is unchanged.

Source: resources/voice-pack-01-revoice/catalog.json and audio/*.mp3. Same dialogue IDs and MP3 basenames as pack01; replacements, not ten additional NPC lines. Eight source NPC adaptations + two optional scenes; 20 of the original 28 NPC catalogue lines still unrecorded. No Godot/browser integration or gameplay changes.

Deliverables:
- dropbox/Fantazia-Voice-Pack-01-NEW-VOICES.zip: 13 files, 879,983 bytes.
- dropbox/Fantazia-Assets-NEW-VOICES.zip: 162 files, 29,695,969 bytes; 21 total voice files (11 original announcer + 10 replacements), prior models/music/SFX unchanged.

Cumulative pack built from the original 150-file asset pack, NOT layered over the rejected-character pack. Character rows checked to reference only voice-04/voice-05; audio bytes checked against new source files. Old character MP3s not included. Historical source files and old Dropbox archives were not deleted.

All ten MP3s decoded with miniaudio: nonzero finite signal, duration >2 seconds; all differ from rejected recordings. Total MP3 metadata duration 145.04 seconds. ZIP CRC and every manifest SHA256 verified. Emotion labels remain creative direction, not a measured guarantee of performance.

Reproduce: PYTHONPATH=/home/user/asset-tools python tools/package-voice-pack.py --revoice (mutagen dependency). Default mode still builds the historical pack01. No commit/push/deploy.
