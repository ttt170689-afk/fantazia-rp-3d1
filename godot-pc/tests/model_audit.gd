extends RefCounted
## Compare image bytes and texture-slot bindings before/after native serialization.


static func snapshot(root: Node) -> Dictionary:
	var info := {"meshes": 0, "texture_bindings": []}
	_walk(root, ".", info, {})
	info.texture_bindings.sort()
	return info


static func _walk(node: Node, path: String, info: Dictionary, seen: Dictionary) -> void:
	if node is MeshInstance3D and node.mesh != null:
		info.meshes += 1
		for surface in range(node.mesh.get_surface_count()):
			var material = node.get_active_material(surface)
			if not material is BaseMaterial3D:
				continue
			for slot in range(BaseMaterial3D.TEXTURE_MAX):
				var texture: Texture2D = material.get_texture(slot)
				if texture == null:
					continue
				var id := texture.get_instance_id()
				if not seen.has(id):
					var image := texture.get_image()
					var signature := "EMPTY"
					if image != null and not image.is_empty():
						var hash := HashingContext.new()
						hash.start(HashingContext.HASH_SHA256)
						hash.update(image.get_data())
						signature = (
							"%dx%d:%d:%s:%s"
							% [
								image.get_width(),
								image.get_height(),
								image.get_format(),
								str(image.has_mipmaps()),
								hash.finish().hex_encode()
							]
						)
					seen[id] = signature
				info.texture_bindings.append("%s:%d:%d:%s" % [path, surface, slot, seen[id]])
	for child in node.get_children():
		_walk(child, path + "/" + child.name, info, seen)
