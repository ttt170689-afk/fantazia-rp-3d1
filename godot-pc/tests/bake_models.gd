extends SceneTree
## Maintainer-only conversion. Never invoked by the menu, editor tools or plugins.
## Source GLBs are behind .gdignore; ship self-contained native scenes instead.
const Audit = preload("res://tests/model_audit.gd")
const SOURCE_DIR := "res://source_models/"
const OUTPUT_DIR := "res://assets/"


func _initialize() -> void:
	_bake.call_deferred()


func _bake() -> void:
	var manifest := {"version": 1, "engine": Engine.get_version_info().string, "models": {}}
	for name in ["city", "player", "city_v28", "sky_v28", "sea_v28"]:
		var source: String = SOURCE_DIR + name + ".glb"
		var target: String = OUTPUT_DIR + name + ".scn"
		var document := GLTFDocument.new()
		var state := GLTFState.new()
		# No extraction to PNG, no importer, no generated .import or .ctex paths.
		state.handle_binary_image = GLTFState.HANDLE_BINARY_EMBED_AS_UNCOMPRESSED
		var error := document.append_from_file(source, state)
		if error != OK:
			push_error("Baking failed: %s (%d)" % [source, error])
			quit(1)
			return
		var node := document.generate_scene(state)
		if node == null:
			push_error("GLTF scene generation failed: " + source)
			quit(1)
			return
		var source_audit := Audit.snapshot(node)
		_own_descendants(node, node)
		var scene := PackedScene.new()
		error = scene.pack(node)
		if error == OK:
			error = ResourceSaver.save(
				scene, target, ResourceSaver.FLAG_COMPRESS | ResourceSaver.FLAG_BUNDLE_RESOURCES
			)
		node.free()
		if error != OK:
			push_error("Native scene save failed: %s (%d)" % [target, error])
			quit(1)
			return
		var dependencies := ResourceLoader.get_dependencies(target)
		if not dependencies.is_empty():
			push_error("Native scene is not self-contained: " + str(dependencies))
			quit(1)
			return
		var file := FileAccess.open(target, FileAccess.READ)
		manifest.models[target] = {
			"bytes": file.get_length(),
			"sha256": FileAccess.get_sha256(target),
			"source_sha256": FileAccess.get_sha256(source),
			"external_dependencies": dependencies.size(),
			"source_audit": source_audit,
		}
		file.close()
		print(
			"BAKED ",
			name,
			" bytes=",
			manifest.models[target].bytes,
			" texture_bindings=",
			source_audit.texture_bindings.size()
		)
		await process_frame
	var output := FileAccess.open(OUTPUT_DIR + "baked-manifest.json", FileAccess.WRITE)
	if output == null:
		push_error("Cannot save baked manifest")
		quit(1)
		return
	output.store_string(JSON.stringify(manifest, "\t") + "\n")
	output.close()
	print("BAKE_RESULT models=5 failures=0")
	quit()


func _own_descendants(node: Node, root_node: Node) -> void:
	for child in node.get_children():
		child.owner = root_node
		_own_descendants(child, root_node)
