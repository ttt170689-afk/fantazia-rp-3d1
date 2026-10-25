extends "res://tests/native04.gd"
## Verify native sectors against the captured GLB pixel/geometry audit.


func _run() -> void:
	var manifest: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://assets/baked-manifest.json")
	)
	for sector in ["city", "sky", "sea"]:
		var path: String = "res://assets/" + sector + "_v28.scn"
		check(ResourceLoader.get_dependencies(path).is_empty(), "embedded sector: " + sector)
		var packed := load(path) as PackedScene
		check(packed != null, "native scene loads: " + sector)
		var model := packed.instantiate()
		var actual := Audit.snapshot(model)
		var expected: Dictionary = manifest.models[path].source_audit
		check(actual.meshes == int(expected.meshes), "all captured meshes: " + sector)
		check(actual.texture_bindings == expected.texture_bindings, "pixel hashes: " + sector)
		var info := {"meshes": 0, "textures": {}, "pixels": 0, "bad_textures": 0}
		inspect_meshes(model, info)
		check(info.meshes > (2000 if sector == "city" else 100), "populated sector: " + sector)
		check(info.bad_textures == 0, "no empty images: " + sector)
		check(info.pixels > 0, "embedded texture pixels present: " + sector)
		print(
			"LATEST_NATIVE_MODEL ",
			sector,
			" meshes=",
			info.meshes,
			" unique_albedo=",
			info.textures.size(),
			" texture_bindings=",
			actual.texture_bindings.size()
		)
		model.free()
		packed = null
		await process_frame
	print("LATEST_ASSETS_RESULT checks=%d failures=%d" % [checks, failures])
	quit(0 if failures == 0 else 1)
