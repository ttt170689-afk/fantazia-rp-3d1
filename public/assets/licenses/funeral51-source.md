# Funeral cast 51 — provenance, license and editable source

These five models are **derived MakeHuman characters**, not scans of five real
people and not the gameplay avatar. They replace the head-only Lee Perry-Smith
assembly in the normal funeral path. The old scan and its attribution are retained
for compatibility, but the new cast does not fetch or use it.

## License

The generated `assets/models/funeral51/*.glb` files are distributed under
**GNU AGPL v3 or later**. They incorporate the older MakeHuman clothing/hair data
and converted skin/garment textures whose distributed license is AGPLv3. We do
**not** assume that the newer core's CC0 release retroactively relicenses these
older clothing/texture repositories. The underlying core mesh, morph targets,
eye mesh/texture, skeleton and weights retain their CC0 notice.

- Full AGPL text: [funeral51-license.txt](funeral51-license.txt).
- Core CC0 text: [funeral51-core-CC0.txt](funeral51-core-CC0.txt).
- Editable data, preserved headers and texture files:
  [funeral51-source.tar.gz](funeral51-source.tar.gz).
- Exact input paths and SHA-256 digests:
  [funeral51-inputs.json](funeral51-inputs.json).
- Conversion source: `tools/build-funeral51.py` in this repository (AGPL-3.0-or-later).
- Animation/loader source is delivered unminified at `assets/fz-humans31.js`.

The asset license does not change the licensing of unrelated game assets or code.

## Upstream snapshots

| Input | Repository and immutable revision | Notices retained |
|---|---|---|
| hm08 mesh, adult/elderly morphs, default skeleton/weights, high-poly eyes | https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482 | CC0; Data Collection AB, Joel Palmius, Jonas Hauquier; morphs originally Manuel Bastioni |
| male/female elegant suits, shoes01/shoes03, short01/short03/bob02/ponytail01 and their fitting data | https://github.com/dmaugis/makehuman-py3-assets/tree/2f4033a364a7e97479e17ed630ccb999395730c6 | AGPLv3; Data Collection AB, Joel Palmius, Jonas Hauquier |
| 512px skin, garment, hair and shoe texture conversions | https://github.com/makehuman-js/makehuman-data/tree/e5d1a42cb469025a6d2b3ecea3e0252e6feccc1f | repository inherits MakeHuman AGPLv3-derived license; MakeHuman contributors; conversion project by wassname |

See individual source headers for full original notices. Only data is imported;
the MakeHuman application/proxy implementation is not included or executed.

## Changes made for FANTAZIA

- Five distinct adult/older morph combinations and heights (1.66–1.86 m).
- Fitted complete suits, shoes, hair, eyes and exposed skin; hidden body/helper
  surfaces omitted rather than rendered through garments.
- Darkened/desaturated mourning garments and shoes; grey hair for older profiles.
- Triangulation, seam-safe smooth normals, normalized four-weight skinning and a
  163-bone hierarchy with translation-only bind frames for authored animation.
- UV conversion and embedded 512px PNG textures; alpha-tested hair/corneal shells.
- No external texture/CDN dependencies in the final GLBs.

## Rebuild

From the game repository root, with Python 3:

```sh
python3 -m venv .venv
.venv/bin/pip install numpy==2.4.6 Pillow==13.0.0
mkdir -p .cache/mh51
# Inspect the archive before unpacking if obtained from another distributor.
tar -xzf public/assets/licenses/funeral51-source.tar.gz -C .cache/mh51
.venv/bin/python tools/build-funeral51.py --source .cache/mh51
npm run test:funeral
npm run test:funeral:browser
```

No Blender, MakeHuman executable, credentials or download from a third-party
asset host is required for the rebuild. The builder only reads the archive's
`core/`, `assets/` and `js/` data and writes the five dressed GLBs and manifest.
