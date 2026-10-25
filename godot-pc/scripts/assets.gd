extends RefCounted
## Native scenes are baked once by the maintainer, NOT imported on the user's PC.
## All geometry, materials, images and animations are bundled in these resources.
const CITY := "res://assets/city.scn"
const PLAYER := "res://assets/player.scn"
const MODELS := [
	CITY,
	PLAYER,
	"res://assets/city_v28.scn",
	"res://assets/sky_v28.scn",
	"res://assets/sea_v28.scn"
]
static var prepared: Dictionary = {}


static func model(path: String) -> Node3D:
	if path not in MODELS:
		return null
	var packed: PackedScene = prepared.get(path)
	if packed == null:
		packed = ResourceLoader.load(path, "PackedScene") as PackedScene
	return packed.instantiate() as Node3D if packed != null else null


static func animation_player(root: Node) -> AnimationPlayer:
	if root is AnimationPlayer:
		return root as AnimationPlayer
	for child in root.get_children():
		var found := animation_player(child)
		if found != null:
			return found
	return null


static func loop_animations(player: AnimationPlayer) -> void:
	if player == null:
		return
	for clip in player.get_animation_list():
		if "Loop" in clip:
			player.get_animation(clip).loop_mode = Animation.LOOP_LINEAR


static func prepare_scene(
	owner: Node, path: String, title: String, start: float, end: float
) -> bool:
	owner.report_loading(title, start)
	await owner.get_tree().process_frame
	if owner.cancel_loading:
		return false
	if path not in MODELS or not ResourceLoader.exists(path, "PackedScene"):
		return false
	var error := ResourceLoader.load_threaded_request(path, "PackedScene")
	if error != OK:
		return false
	var last_progress: float = -1.0
	while true:
		var fraction: Array = []
		var status := ResourceLoader.load_threaded_get_status(path, fraction)
		if status == ResourceLoader.THREAD_LOAD_LOADED:
			var packed := ResourceLoader.load_threaded_get(path) as PackedScene
			if owner.cancel_loading or packed == null:
				return false
			prepared[path] = packed
			owner.report_loading(title, end)
			return true
		if status != ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			# Collect even a failed request so its native load token is released.
			ResourceLoader.load_threaded_get(path)
			return false
		var value: float = float(fraction[0]) if not fraction.is_empty() else 0.0
		if value - last_progress > 0.05:
			owner.report_loading(title, lerpf(start, end, clampf(value, 0, 1)))
			last_progress = value
		# Cooperative cancellation never destroys a node used by a worker. We
		# collect the completed resource, then release it instead of instancing it.
		await owner.get_tree().process_frame
	return false


static func release_prepared() -> void:
	prepared.clear()
