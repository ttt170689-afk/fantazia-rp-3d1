extends SceneTree
## Native-only resource regression. No source GLB is imported or parsed here.
const Launcher = preload("res://scripts/main_menu.gd")
const Audit = preload("res://tests/model_audit.gd")
const Assets = preload("res://scripts/assets.gd")
var checks: int = 0
var failures: int = 0


func _initialize() -> void:
	_run.call_deferred()


func check(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("PASS native04: ", label)
	else:
		failures += 1
		push_error("FAIL native04: " + label)


func _run() -> void:
	check(
		FileAccess.file_exists("res://source_models/.gdignore"),
		"GLB folder excluded from editor scan"
	)
	check(not FileAccess.file_exists(Assets.CITY + ".import"), "city requires no import recipe")
	check(not FileAccess.file_exists(Assets.PLAYER + ".import"), "avatar requires no import recipe")
	check(Launcher.preflight().is_empty(), "shipped scenes match their size and SHA-256")
	var manifest: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://assets/baked-manifest.json")
	)
	for path in [Assets.CITY, Assets.PLAYER]:
		check(ResourceLoader.get_dependencies(path).is_empty(), "no external dependencies: " + path)
		var scene := load(path) as PackedScene
		check(scene != null, "native PackedScene loads: " + path)
		var node := scene.instantiate()
		check(node is Node3D, "native root is 3D: " + path)
		var info := {"meshes": 0, "textures": {}, "pixels": 0, "bad_textures": 0}
		inspect_meshes(node, info)
		var actual := Audit.snapshot(node)
		var expected: Dictionary = manifest.models[path].source_audit
		check(
			(
				actual.meshes == int(expected.meshes)
				and actual.texture_bindings == expected.texture_bindings
			),
			"all texture-slot pixel hashes match the source GLB: " + path
		)
		check(info.meshes >= (300 if path == Assets.CITY else 1), "geometry retained: " + path)
		check(info.bad_textures == 0, "no empty embedded images: " + path)
		if path == Assets.CITY:
			check(info.textures.size() > 0, "city textures bundled rather than external PNGs")
			check(info.pixels > 1000000, "real pixel data retained, not placeholders")
		else:
			var animator := Assets.animation_player(node)
			check(animator != null, "avatar AnimationPlayer retained")
			check(animator.get_animation_list().size() >= 27, "27 avatar animation clips retained")
		print("NATIVE_MODEL ", path, " meshes=", info.meshes, " textures=", info.textures.size())
		node.free()
		scene = null
		await process_frame
	await _test_integrity()
	print("NATIVE_RESULT checks=%d failures=%d" % [checks, failures])
	quit(0 if failures == 0 else 1)


func inspect_meshes(node: Node, info: Dictionary) -> void:
	if node is MeshInstance3D and node.mesh != null:
		info.meshes += 1
		for surface in range(node.mesh.get_surface_count()):
			var material = node.get_active_material(surface)
			if material is BaseMaterial3D and material.albedo_texture != null:
				var texture: Texture2D = material.albedo_texture
				if info.textures.has(texture.get_instance_id()):
					continue
				info.textures[texture.get_instance_id()] = true
				var image := texture.get_image()
				if image == null or image.is_empty():
					info.bad_textures += 1
				else:
					info.pixels += image.get_width() * image.get_height()
	for child in node.get_children():
		inspect_meshes(child, info)


func _test_integrity() -> void:
	var path := "user://fz-native-test-%d.scn" % Time.get_ticks_usec()
	var manifest_path := path + ".json"
	var node := Node3D.new()
	var scene := PackedScene.new()
	check(scene.pack(node) == OK, "integrity fixture packed")
	node.free()
	check(ResourceSaver.save(scene, path, ResourceSaver.FLAG_COMPRESS) == OK, "fixture saved")
	var file := FileAccess.open(path, FileAccess.READ)
	var length := file.get_length()
	file.close()
	var manifest := {"models": {path: {"bytes": length, "sha256": FileAccess.get_sha256(path)}}}
	file = FileAccess.open(manifest_path, FileAccess.WRITE)
	file.store_string(JSON.stringify(manifest))
	file.close()
	check(Launcher.preflight([path], manifest_path).is_empty(), "valid native fixture accepted")
	file = FileAccess.open(path, FileAccess.READ_WRITE)
	file.seek(length - 1)
	var value := file.get_8()
	file.seek(length - 1)
	file.store_8(value ^ 1)
	file.close()
	check(
		Launcher.preflight([path], manifest_path).contains("SHA-256"),
		"same-size corruption rejected"
	)
	file = FileAccess.open(path, FileAccess.READ_WRITE)
	file.seek_end()
	file.store_8(0)
	file.close()
	check(Launcher.preflight([path], manifest_path).contains("размер"), "size corruption rejected")
	check(DirAccess.remove_absolute(path) == OK, "native fixture removed")
	check(DirAccess.remove_absolute(manifest_path) == OK, "fixture manifest removed")
	await process_frame
