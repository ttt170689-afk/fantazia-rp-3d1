extends Node3D
signal loading_stage(text: String, ratio: float)
signal boot_completed(success: bool, message: String)
signal main_menu_requested
signal quit_requested
const Kit = preload("res://scripts/kit.gd")
const Assets = preload("res://scripts/assets.gd")
const Player = preload("res://scripts/player.gd")
const Residence = preload("res://scripts/residence.gd")
const Action = preload("res://scripts/interaction.gd")
const Hud = preload("res://scripts/hud.gd")
const Profile = preload("res://scripts/profile.gd")

var boot_managed: bool = false
var safe_boot: bool = false
var cancel_loading: bool = false
var boot_error: String = ""

var testing: bool = "--test" in OS.get_cmdline_user_args()
var player: CharacterBody3D
var residence: Node3D
var hud: CanvasLayer
var city: Node3D
var city_mesh_count: int = 0
var city_collider_count: int = 0
var inside: bool = false
var selected: Node3D
var selection_override: Node3D
var nearby: Array[Node3D] = []
var entrance: Node3D
var city_spawn := Vector3(-27, 0.5, 168)
var city_return := Vector3(-27, 0.5, 176.5)
var state_ready: bool = false
var sensitivity: float = 0.0025
var profile = Profile.new()
var options: Dictionary = Profile.DEFAULTS.duplicate()
var loaded_location: Dictionary = {}
var last_checkpoint: Dictionary = {}
var save_clock: float = 0.0
var checkpoint_clock: float = 0.0
var action_clock: float = 0.0
var focus_marker: Label3D
var sun: DirectionalLight3D


func _ready() -> void:
	# The launcher runs while paused; gameplay must not inherit its ALWAYS mode.
	process_mode = Node.PROCESS_MODE_PAUSABLE
	_bind_inputs()
	if not testing:
		_load_settings()
	_setup_ui()
	hud.visible = not boot_managed
	report_loading("Подготавливаем графику", 0.05)
	await get_tree().process_frame
	_setup_environment()
	if not await Assets.prepare_scene(
		self, "res://assets/city.scn", "Читаем модель города", 0.08, 0.35
	):
		_fail_boot("Не удалось прочитать город. Проверь целостность assets/city.scn.")
		return
	city = Assets.model("res://assets/city.scn")
	if city == null:
		_fail_boot("Не удалось загрузить модель города assets/city.scn.")
		return
	city.name = "OriginalFantaziaCity"
	add_child(city)
	report_loading("Создаём физику города", 0.36)
	await _build_city_collisions_batched(city)
	if cancel_loading:
		_fail_boot("Загрузка отменена.")
		return
	if not await Assets.prepare_scene(
		self, "res://assets/player.scn", "Читаем персонажа", 0.66, 0.76
	):
		_fail_boot("Не удалось прочитать персонажа. Проверь целостность assets/player.scn.")
		return
	report_loading("Собираем подъезд", 0.78)
	await get_tree().process_frame
	Kit.box(self, "SafetyGround", Vector3(1100, 0.2, 1100), Vector3(0, -8.0, 0), Color("526b4f"))
	residence = Residence.new()
	residence.name = "ResidencePrototype"
	add_child(residence)
	residence.position = Vector3(0, -40, 0)
	residence.leave_requested.connect(return_to_city)
	residence.notice.connect(_notice)
	player = Player.new()
	player.name = "Player"
	add_child(player)
	player.controls_enabled = false
	player.camera.current = false
	player.sensitivity = sensitivity
	residence.lift.player = player
	entrance = Action.new()
	entrance.name = "ResidenceEntrance"
	entrance.title = "Войти в подъезд «Рассвет»"
	entrance.radius = 2.7
	add_child(entrance)
	entrance.position = Vector3(-27, 1.5, 178.5)
	entrance.activated.connect(enter_residence)
	Kit.label(self, "ДОМ РАССВЕТ\nE · ПОДЪЕЗД", Vector3(-27, 3.2, 178.5), 32, true)
	if not player.model_loaded:
		_fail_boot("Не удалось загрузить игрового персонажа assets/player.scn.")
		player.controls_enabled = false
		return
	if cancel_loading:
		_fail_boot("Загрузка отменена.")
		return
	report_loading("Проверяем позицию и настройки", 0.92)
	focus_marker = Kit.label(self, "[E]", Vector3.ZERO, 22, true)
	focus_marker.visible = false
	get_window().min_size = Vector2i(960, 720)
	# Wait for the static shapes to reach the physics server before ground probes.
	await get_tree().physics_frame
	await get_tree().physics_frame
	city_spawn.y = _ground_height(city_spawn) + 0.12
	city_return.y = _ground_height(city_return) + 0.12
	player.place(city_spawn, PI)
	state_ready = true
	if safe_boot:
		options.quality = 0
		options.fps_limit = 60
	_apply_options()
	player.controls_enabled = true
	player.camera.current = true
	Assets.release_prepared()
	_restore_location(loaded_location)
	var initial: Vector3 = player.global_position
	last_checkpoint = (
		Profile
		. location(
			{
				"zone": "residence" if inside else "city",
				"position": [initial.x, initial.y, initial.z],
				"yaw": wrapf(player.pivot.rotation.y, -PI, PI),
			}
		)
	)
	hud.play_button.disabled = false
	if not testing:
		get_tree().auto_accept_quit = false
	if testing or boot_managed:
		resume()
	else:
		pause()
		if not profile.warning.is_empty():
			hud.save_report(profile.warning, profile.recovered)

	report_loading("Готово", 1.0)
	boot_completed.emit(true, "")


func _setup_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("5790c5")
	sky_material.sky_horizon_color = Color("d4dfeb")
	sky_material.ground_horizon_color = Color("d4dfeb")
	sky_material.ground_bottom_color = Color("657279")
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("d5dfef")
	environment.ambient_light_energy = 0.65
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.fog_enabled = true
	environment.fog_light_color = Color("cad8e6")
	environment.fog_density = 0.0012
	world_environment.environment = environment
	add_child(world_environment)
	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-48, -28, 0)
	sun.light_energy = 1.1
	sun.shadow_enabled = not safe_boot
	sun.directional_shadow_max_distance = 100.0
	add_child(sun)


func _build_city_mesh_collision(root: Node) -> void:
	if root is MeshInstance3D:
		var mesh_instance := root as MeshInstance3D
		city_mesh_count += 1
		var label := String(root.name).to_lower()
		var decorative := (
			label.contains("sign_")
			or label.contains("water")
			or label.contains("crown_")
			or label.contains("lamp_glow")
		)
		var bounds := mesh_instance.get_aabb()
		if (
			not decorative
			and mesh_instance.mesh != null
			and bounds.size.length() > 0.02
			and bounds.end.y > -20.0
		):
			var shape := mesh_instance.mesh.create_trimesh_shape()
			if shape != null:
				shape.backface_collision = true
				var body := StaticBody3D.new()
				body.name = "CitySurfaceCollision"
				var collision := CollisionShape3D.new()
				collision.shape = shape
				body.add_child(collision)
				root.add_child(body)
				city_collider_count += 1


func _ground_height(at: Vector3) -> float:
	var query := PhysicsRayQueryParameters3D.create(
		Vector3(at.x, 15, at.z), Vector3(at.x, -9, at.z), 1
	)
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	return float(hit.position.y) if not hit.is_empty() else 0.0


func enter_residence() -> void:
	if not state_ready or inside:
		return
	inside = true
	player.place(residence.global_position + Vector3(0, 0.12, 6.8))
	selection_override = null
	_notice("Подъезд: лестница справа, лифт слева. Квартира 201 — на втором этаже.")


func return_to_city() -> void:
	if not state_ready:
		return
	inside = false
	player.place(city_return, 0.0)
	selection_override = null
	_notice("Ты снова в городе. Здесь перенесена модель города, но не все механики веб-версии.")


func _physics_process(delta: float) -> void:
	if not state_ready:
		return
	action_clock = maxf(0, action_clock - delta)
	save_clock += delta
	checkpoint_clock += delta
	if checkpoint_clock >= 1.0:
		checkpoint_clock = 0.0
		var checkpoint := _capture_location()
		if not checkpoint.is_empty():
			last_checkpoint = checkpoint
	if save_clock >= 20.0:
		save_session()
	var at: Vector3 = player.global_position
	if (
		not at.is_finite()
		or at.y < -55.0
		or absf(at.x) > 520.0
		or absf(at.z) > 520.0
		or (not inside and at.y < -5.0)
	):
		return_to_city()
	_update_interactions()
	var zone := "подъезд «Рассвет»" if inside else "город"
	var prompt := "WASD — движение  ·  E — действие  ·  Esc — меню"
	focus_marker.visible = is_instance_valid(selected)
	if selected != null:
		focus_marker.global_position = selected.get_focus() + Vector3.UP * 0.35
		prompt = "[E] " + selected.get_prompt()
		if nearby.size() > 1:
			prompt += "\nTab — выбрать другое действие рядом"
	elif not inside:
		var distance := Vector2(at.x + 27, at.z - 178.5).length()
		prompt = "Подъезд «Рассвет»: %.0f м  ·  Esc — меню" % distance
	hud.update_info(zone, prompt, at, city_mesh_count)


func _update_interactions() -> void:
	nearby.clear()
	var eye: Vector3 = player.global_position + Vector3.UP * 1.25
	for node in get_tree().get_nodes_in_group("interactable"):
		if node.get_prompt().is_empty():
			continue
		var focus: Vector3 = node.get_focus()
		if eye.distance_to(focus) > float(node.radius):
			continue
		var ray := PhysicsRayQueryParameters3D.create(eye, focus, 1, [player.get_rid()])
		var hit := get_world_3d().direct_space_state.intersect_ray(ray)
		if not hit.is_empty() and hit.position.distance_to(focus) > 0.18:
			if hit.collider != node and not node.is_ancestor_of(hit.collider):
				continue
		nearby.append(node)
	nearby.sort_custom(
		func(a: Node3D, b: Node3D) -> bool:
			return eye.distance_squared_to(a.get_focus()) < eye.distance_squared_to(b.get_focus())
	)
	if is_instance_valid(selection_override) and nearby.has(selection_override):
		selected = selection_override
	else:
		selection_override = null
		selected = nearby[0] if not nearby.is_empty() else null


func _unhandled_input(event: InputEvent) -> void:
	if not state_ready:
		return
	if event.is_action_pressed("quick_save"):
		save_session()
		_notice("Сохранение: " + hud.options_panel.save_status.text)
	if event.is_action_pressed("interact"):
		# Recompute at the instant of activation; stale targets cannot be used
		# after teleportation, a closing door, or leaving the interaction radius.
		_update_interactions()
		if action_clock <= 0.0 and is_instance_valid(selected):
			selected.interact()
			action_clock = 0.25
		selection_override = null
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("next_action") and nearby.size() > 1:
		var index := nearby.find(selected)
		selection_override = nearby[(index + 1) % nearby.size()]
		get_viewport().set_input_as_handled()
	if inside and (event.is_action_pressed("floor_one") or event.is_action_pressed("floor_two")):
		if residence.lift._rider_inside():
			residence.lift.request_floor(1 if event.is_action_pressed("floor_two") else 0)
		else:
			_notice("Кнопки 1 / 2 работают внутри кабины. Снаружи используй кнопку вызова [E].")


func pause() -> void:
	if not state_ready:
		return
	options.zoom = player.zoom_target
	_clear_input()
	save_session()
	hud.sync_options(options)
	# Flush the current physics step before pausing GodotPhysics3D callbacks.
	get_tree().set_deferred("paused", true)
	hud.show_menu(true)


func resume() -> void:
	if not state_ready:
		return
	_clear_input()
	save_session()
	get_tree().set_deferred("paused", false)
	hud.show_menu(false)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_quit()
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and state_ready and not testing:
		pause()


func _notice(text: String) -> void:
	if is_instance_valid(hud):
		hud.message(text)


func _load_settings() -> void:
	var data: Dictionary = profile.load_data()
	options = data.settings
	loaded_location = data.location
	# One-time compatibility with prototype 01, without changing its file.
	if not FileAccess.file_exists(profile.path) and not profile.recovered:
		var legacy := ConfigFile.new()
		if legacy.load("user://settings.cfg") == OK:
			options.sensitivity = Profile.number(
				legacy.get_value("controls", "sensitivity"), 0.0025, 0.001, 0.006
			)
	sensitivity = options.sensitivity


func _set_sensitivity(value: float) -> void:
	_set_option("sensitivity", value)


func _bind_inputs() -> void:
	var bindings := {
		"move_forward": [KEY_W, KEY_UP],
		"move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT],
		"move_right": [KEY_D, KEY_RIGHT],
		"run": [KEY_SHIFT],
		"jump": [KEY_SPACE],
		"interact": [KEY_E],
		"pause": [KEY_ESCAPE],
		"flashlight": [KEY_F],
		"dance": [KEY_B],
		"debug_stats": [KEY_F3],
		"next_action": [KEY_TAB],
		"floor_one": [KEY_1],
		"floor_two": [KEY_2],
		"guide": [KEY_F1],
		"quick_save": [KEY_F5]
	}
	for action in bindings:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key in bindings[action]:
			var event := InputEventKey.new()
			event.physical_keycode = key
			if not InputMap.action_has_event(action, event):
				InputMap.action_add_event(action, event)


func _setup_ui() -> void:
	hud = Hud.new()
	hud.name = "PrototypeUI"
	hud.initial_sensitivity = sensitivity
	add_child(hud)
	hud.play_requested.connect(resume)
	hud.pause_requested.connect(pause)
	hud.restart_requested.connect(
		func():
			return_to_city()
			resume()
	)
	hud.option_changed.connect(_set_option)
	hud.save_requested.connect(save_session)
	hud.reset_requested.connect(_reset_options)
	hud.quit_requested.connect(_quit)
	hud.return_to_menu_requested.connect(_request_main_menu)
	hud.play_button.disabled = true
	hud.sync_options(options)


func _clear_input() -> void:
	for action in ["move_forward", "move_back", "move_left", "move_right", "run", "jump"]:
		Input.action_release(action)
	if is_instance_valid(player):
		player.stop_input()


func _set_option(key: String, value: Variant) -> void:
	if not state_ready or not Profile.DEFAULTS.has(key):
		return
	options[key] = value
	options = Profile.settings(options)
	_apply_options()
	hud.save_report("Настройки применены. Сохранение при продолжении или выходе.")


func _reset_options() -> void:
	if not state_ready:
		return
	options = Profile.DEFAULTS.duplicate()
	_apply_options()
	hud.sync_options(options)
	hud.save_report("Настройки сброшены. Позиция и файлы сохранений не удалены.")


func _apply_options() -> void:
	options = Profile.settings(options)
	sensitivity = options.sensitivity
	player.sensitivity = sensitivity
	player.invert_y = options.invert_y
	player.camera.fov = options.fov
	player.zoom_target = options.zoom
	var quality: int = options.quality
	player.camera.far = [400.0, 650.0, 850.0][quality]
	sun.shadow_enabled = quality > 0
	sun.directional_shadow_max_distance = [40.0, 70.0, 100.0][quality]
	get_viewport().msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X][quality]
	# Deterministic headless tests must not be slowed down by a display FPS cap.
	if not testing:
		Engine.max_fps = options.fps_limit


func _capture_location() -> Dictionary:
	if not state_ready or not player.is_on_floor():
		return last_checkpoint.duplicate(true)
	if inside and residence.lift._rider_inside() and residence.lift.phase != "open":
		return last_checkpoint.duplicate(true)
	var at: Vector3 = player.global_position
	var candidate := (
		Profile
		. location(
			{
				"zone": "residence" if inside else "city",
				"position": [at.x, at.y, at.z],
				"yaw": wrapf(player.pivot.rotation.y, -PI, PI),
			}
		)
	)
	if candidate.is_empty() or not _position_safe(at):
		return last_checkpoint.duplicate(true)
	return candidate


func _position_safe(at: Vector3) -> bool:
	if not at.is_finite():
		return false
	var ray := PhysicsRayQueryParameters3D.create(
		at + Vector3.UP * 0.3, at - Vector3.UP * 0.45, 1, [player.get_rid()]
	)
	var hit := get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty() or hit.normal.y < 0.65:
		return false
	var query := PhysicsShapeQueryParameters3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.28
	capsule.height = 1.80
	query.shape = capsule
	query.transform = Transform3D(Basis.IDENTITY, at + Vector3.UP * 0.96)
	query.collision_mask = 1
	query.exclude = [player.get_rid()]
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()


func _restore_location(raw: Dictionary) -> bool:
	var checkpoint := Profile.location(raw)
	if checkpoint.is_empty():
		return false
	var at := Vector3(checkpoint.position[0], checkpoint.position[1], checkpoint.position[2])
	inside = checkpoint.zone == "residence"
	var exact := _position_safe(at)
	if not exact:
		# Lift state and doors are not serialized: never respawn in an empty shaft,
		# a closed door, or unsupported space after layout changes.
		if inside:
			at = residence.global_position + Vector3(0, 0.12, 6.8)
			if checkpoint.position[1] > -38.0:
				at = residence.global_position + Vector3(-1.9, 4.12, 0.0)
		else:
			at = city_spawn
	player.place(at, checkpoint.yaw)
	return exact


func save_session() -> void:
	if not state_ready:
		return
	save_clock = 0.0
	options.zoom = player.zoom_target
	var checkpoint := _capture_location()
	if not checkpoint.is_empty():
		last_checkpoint = checkpoint
	if testing:
		hud.save_report("Тестовый режим: личные сохранения не изменяются.")
		return
	var error: Error = profile.save_data(options, last_checkpoint)
	if error == OK:
		hud.save_report("Сохранено локально. Резервная копия предыдущего сохранения включена.")
	else:
		hud.save_report(
			"Не удалось сохранить (%d). Проверь доступ к папке пользователя." % error, false
		)


func _quit() -> void:
	save_session()
	if boot_managed:
		quit_requested.emit()
	else:
		get_tree().quit()


func _build_city_collisions_batched(root: Node) -> void:
	var meshes: Array[Node] = []
	_collect_city_meshes(root, meshes)
	for i in range(meshes.size()):
		if cancel_loading:
			return
		_build_city_mesh_collision(meshes[i])
		# Yield after a bounded number of meshes, rather than freezing the window
		# while constructing all 226 triangle colliders in a single frame.
		if i % 6 == 0:
			report_loading(
				"Физика города: %d / %d" % [i + 1, meshes.size()],
				lerpf(0.36, 0.65, float(i + 1) / meshes.size())
			)
			await get_tree().process_frame


func _collect_city_meshes(node: Node, result: Array[Node]) -> void:
	if node is MeshInstance3D:
		result.append(node)
	for child in node.get_children():
		_collect_city_meshes(child, result)


func report_loading(text: String, ratio: float) -> void:
	loading_stage.emit(text, ratio)


func _fail_boot(message: String) -> void:
	boot_error = "Загрузка отменена." if cancel_loading else message
	Assets.release_prepared()
	if not boot_managed:
		hud.show_failure(boot_error)
	boot_completed.emit(false, boot_error)


func _request_main_menu() -> void:
	if boot_managed:
		save_session()
		main_menu_requested.emit()
	else:
		_notice("Для главного меню запусти весь проект через F5, не игровую сцену через F6.")


func _exit_tree() -> void:
	Assets.release_prepared()
