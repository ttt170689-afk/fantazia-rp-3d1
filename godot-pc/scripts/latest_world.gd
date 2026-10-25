extends "res://scripts/world.gd"
## Current browser-world geometry. Native actions are implemented separately from JS.
const Metro = preload("res://scripts/metro05.gd")
var spawn_id := "sky"
var metro: Node3D
var directory: Dictionary = {}
var travel_busy := false
var spawn_points := {
	"sky": Vector3(0, 360.2, -1390),
	"center": Vector3(131, 0.2, -30),
	"factory": Vector3(330, 0.2, 35),
	"park": Vector3(230, 0.2, 210),
	"port": Vector3(-225, 0.2, 225),
	"business": Vector3(245, 0.2, -220),
	"sea": Vector3(5890, 2.2, 12),
}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	profile.path = "user://world05-profile.json"
	directory = JSON.parse_string(FileAccess.get_file_as_string("res://assets/world-v28.json"))
	_bind_inputs()
	if not testing:
		_load_settings()
	_setup_ui()
	hud.visible = not boot_managed
	hud.options_panel.route_status.text = (
		"МАРШРУТ v28\nСпавны выбираются в главном меню.\n"
		+ "Метро: вход M → спуск пешком → платформа → открытые двери вагона.\n"
		+ "Сначала зайди полностью, затем жди отправления.\n"
		+ "На набережной E ведёт в морской район.\n"
		+ "На небесной площади E у лестницы ведёт в город.\n"
		+ "Интерактивные интерьеры v28 ещё не перенесены."
	)
	_setup_environment()
	city = Node3D.new()
	city.name = "LatestBrowserWorld"
	add_child(city)
	for name in ["city", "sky", "sea"]:
		var path: String = "res://assets/" + name + "_v28.scn"
		if not await Assets.prepare_scene(self, path, "Карта v28: " + name, 0.08, 0.3):
			_fail_boot("Не удалось прочитать готовую карту " + name)
			return
		var model := Assets.model(path)
		if model == null:
			_fail_boot("Повреждена карта " + name)
			return
		city.add_child(model)
		await _build_city_collisions_batched(model)
		if cancel_loading:
			_fail_boot("Загрузка отменена.")
			return
	_build_ground_with_metro_openings()
	if not await Assets.prepare_scene(self, Assets.PLAYER, "Персонаж", 0.75, 0.8):
		_fail_boot("Не удалось прочитать персонажа")
		return
	player = Player.new()
	add_child(player)
	player.controls_enabled = false
	player.camera.current = false
	metro = Metro.new()
	metro.stations = directory.stations
	metro.player = player
	add_child(metro)
	# The admin-only stage stays closed to the ordinary offline player.
	(
		Kit
		. box(
			self,
			"StageAccessBoundary",
			Vector3(14, 3, 10),
			Vector3(0, 361.5, -1417),
			Color(0, 0, 0, 0),
			true
		)
		. get_child(0)
		. hide()
	)
	_action_at("Спуск в город", Vector3(18, 358.5, -1381), func(): travel("center"), 5)
	_action_at("Спуск в город", Vector3(0, 360.2, -1376), func(): travel("center"), 4)
	_action_at("Морской район", Vector3(-225, 0.2, 230), func(): travel("sea"), 4)
	_action_at("Вернуться на набережную", Vector3(5890, 2.2, 12), func(): travel("port"), 4)
	_action_at("Небесная площадь", Vector3(134, 0.2, -30), func(): travel("sky"), 3)
	focus_marker = Kit.label(self, "[E]", Vector3.ZERO, 22, true)
	await get_tree().physics_frame
	await get_tree().physics_frame
	state_ready = true
	if safe_boot:
		options.quality = 0
		options.fps_limit = 60
	_apply_options()
	city_spawn = spawn_points.center
	travel(spawn_id if spawn_id in spawn_points else "sky")
	if spawn_id == "continue" and not loaded_location.is_empty():
		_restore_location(loaded_location)
	player.controls_enabled = true
	player.camera.current = true
	Assets.release_prepared()
	resume()
	report_loading("Карта и метро готовы", 1)
	boot_completed.emit(true, "")


func _action_at(title: String, point: Vector3, callback: Callable, radius: float) -> void:
	var action = Action.new()
	action.title = title
	action.radius = radius
	add_child(action)
	action.position = point
	action.activated.connect(callback)
	Kit.label(self, title + " · E", point + Vector3.UP * 2, 25, true)


func travel(id: String) -> void:
	if not state_ready or id not in spawn_points:
		return
	var point: Vector3 = spawn_points[id]
	var ray := PhysicsRayQueryParameters3D.create(
		point + Vector3.UP * 3, point - Vector3.UP * 3, 1, [player.get_rid()]
	)
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if not hit.is_empty():
		point.y = hit.position.y + 0.12
	player.place(point, PI)
	last_checkpoint = {}
	selection_override = null
	_notice("Локация: " + id + ". Метро: спуск пешком через павильон M.")


func _build_city_mesh_collision(node: Node) -> void:
	if node is MeshInstance3D:
		var bounds: AABB = node.global_transform * node.get_aabb()
		# Keep spherical scenery, but clear native stair approaches (notably Port's boulder).
		if (
			bounds.size.y > 2
			and bounds.size.y < 25
			and absf(bounds.size.x - bounds.size.y) < 0.1
			and absf(bounds.size.z - bounds.size.y) < 0.1
			and bounds.get_center().y < 20
		):
			for station in directory.stations:
				if bounds.intersects(
					AABB(Vector3(station.x - 3, -9, station.z - 4), Vector3(6, 14, 33))
				):
					node.global_position.x -= bounds.size.x + 6
					bounds = node.global_transform * node.get_aabb()
		# Cut a real opening in the large street-level terrain, not a teleport trigger.
		if (
			bounds.size.x > 800
			and bounds.size.z > 800
			and bounds.size.y < 0.2
			and absf(bounds.get_center().y) < 1
		):
			node.hide()
			return
		# No floor/paving over a station stairwell.
		if bounds.size.y < 0.25 and absf(bounds.get_center().y) < 0.5:
			for s in directory.stations:
				if bounds.intersects(
					AABB(Vector3(s.x - 2.8, -0.6, s.z + 1), Vector3(5.6, 1.2, 28))
				):
					node.hide()
					return
	super._build_city_mesh_collision(node)


func _build_ground_with_metro_openings() -> void:
	var xs: Array = [-600.0, 600.0]
	var zs: Array = [-600.0, 600.0]
	for s in directory.stations:
		xs.append(float(s.x) - 2.8)
		xs.append(float(s.x) + 2.8)
		zs.append(float(s.z) + 1)
		zs.append(float(s.z) + 29)
	xs.sort()
	zs.sort()
	for i in range(xs.size() - 1):
		for j in range(zs.size() - 1):
			var x: float = (xs[i] + xs[i + 1]) / 2
			var z: float = (zs[j] + zs[j + 1]) / 2
			var hole := false
			for s in directory.stations:
				if absf(x - s.x) < 2.8 and z > s.z + 1 and z < s.z + 29:
					hole = true
			if not hole:
				Kit.box(
					self,
					"Terrain",
					Vector3(xs[i + 1] - xs[i], 0.2, zs[j + 1] - zs[j]),
					Vector3(x, -0.12, z),
					Color("527947")
				)


func _physics_process(delta: float) -> void:
	if not state_ready:
		return
	action_clock = maxf(0, action_clock - delta)
	save_clock += delta
	if save_clock > 20:
		save_session()
	var p := player.global_position
	if not p.is_finite() or p.y < -20 or p.y > 600 or p.x < -650 or p.x > 6500 or absf(p.z) > 1600:
		travel("center")
	_update_interactions()
	focus_marker.visible = is_instance_valid(selected)
	var prompt := "WASD — ходьба · E — действие · Esc — меню"
	if selected != null:
		focus_marker.global_position = selected.get_focus() + Vector3.UP * 0.35
		prompt = "[E] " + selected.get_prompt()
	var zone := "Город v28"
	if p.y > 300:
		zone = "Небесная площадь"
	elif p.x > 4000:
		zone = "Морской район"
	elif p.y < -3:
		zone = "Метро · " + metro.stations[metro.index].name
	hud.update_info(zone, prompt, p, city_mesh_count)


func return_to_city() -> void:
	travel("center")


func _capture_location() -> Dictionary:
	if not state_ready or not player.is_on_floor() or metro.rider_inside():
		return last_checkpoint.duplicate(true)
	var p := player.global_position
	return Profile.location(
		{"zone": "v28", "position": [p.x, p.y, p.z], "yaw": wrapf(player.pivot.rotation.y, -PI, PI)}
	)


func _restore_location(raw: Dictionary) -> bool:
	var clean := Profile.location(raw)
	if clean.is_empty() or clean.zone != "v28":
		return false
	var p := Vector3(clean.position[0], clean.position[1], clean.position[2])
	if not _position_safe(p):
		return false
	player.place(p, clean.yaw)
	return true
