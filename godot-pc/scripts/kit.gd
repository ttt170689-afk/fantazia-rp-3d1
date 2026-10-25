extends RefCounted
## Geometry helpers shared by the small native interior, not a JS wrapper.
static var materials: Dictionary = {}


static func material(color: Color, metallic: float = 0.0) -> StandardMaterial3D:
	var key := color.to_html() + ":" + str(metallic)
	if materials.has(key):
		return materials[key]
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = 0.78
	result.metallic = metallic
	materials[key] = result
	return result


static func box(
	parent: Node3D, label: String, size: Vector3, at: Vector3, color: Color, solid: bool = true
) -> Node3D:
	var root: Node3D = StaticBody3D.new() if solid else Node3D.new()
	root.name = label
	parent.add_child(root)
	root.position = at
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	mesh.material_override = material(color)
	root.add_child(mesh)
	if solid:
		var collision := CollisionShape3D.new()
		var bounds := BoxShape3D.new()
		bounds.size = size
		collision.shape = bounds
		root.add_child(collision)
	return root


static func collider(parent: Node3D, size: Vector3, at: Vector3) -> CollisionShape3D:
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	parent.add_child(collision)
	collision.position = at
	return collision


static func label(
	parent: Node3D, text: String, at: Vector3, font_size: int = 36, billboard: bool = false
) -> Label3D:
	var result := Label3D.new()
	result.text = text
	result.font_size = font_size
	result.pixel_size = 0.012
	result.outline_size = 6
	result.modulate = Color("edf3ff")
	result.outline_modulate = Color("18202f")
	if billboard:
		result.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	parent.add_child(result)
	result.position = at
	return result


static func light(parent: Node3D, at: Vector3, energy: float = 1.0) -> OmniLight3D:
	var result := OmniLight3D.new()
	result.light_color = Color("fff0d9")
	result.light_energy = energy
	result.omni_range = 13.0
	result.shadow_enabled = false
	parent.add_child(result)
	result.position = at
	return result
