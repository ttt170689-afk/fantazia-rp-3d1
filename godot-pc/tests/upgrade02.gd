extends RefCounted
const Profile = preload("res://scripts/profile.gd")
const Assets = preload("res://scripts/assets.gd")
const Kit = preload("res://scripts/kit.gd")
const Action = preload("res://scripts/interaction.gd")
var runner
var world


func run(test_runner, test_world) -> void:
	runner = test_runner
	world = test_world
	_test_validation()
	_test_files()
	await _test_settings()
	await _test_recovery()
	await _test_actions()
	await _test_lift()
	await _test_light()


func check(value: bool, label: String) -> void:
	runner._check(value, "02: " + label)


func _test_validation() -> void:
	var clean := Profile.settings(
		{
			"sensitivity": INF,
			"fov": "bad",
			"zoom": -99,
			"quality": 8,
			"fps_limit": 7,
			"invert_y": "false",
			"unknown": 123
		}
	)
	check(clean.sensitivity == 0.0025, "nonfinite sensitivity replaced")
	check(clean.fov == 70, "wrong FOV type replaced")
	check(clean.zoom == 2.2 and clean.quality == 2, "numeric settings clamped")
	check(clean.fps_limit == 60 and not clean.invert_y, "FPS and bool whitelist")
	check(not clean.has("unknown"), "unknown settings discarded")
	check(Profile.settings(null) == Profile.DEFAULTS, "missing settings use defaults")
	check(Profile.location({}).is_empty(), "empty location rejected")
	check(
		Profile.location({"zone": "server", "position": [0, 0, 0]}).is_empty(),
		"unknown zone rejected"
	)
	check(
		Profile.location({"zone": "city", "position": [INF, 0, 0]}).is_empty(),
		"nonfinite location rejected"
	)
	check(
		Profile.location({"zone": "city", "position": [0, "0", 0]}).is_empty(),
		"string coordinates rejected"
	)
	check(
		Profile.location({"zone": "city", "position": [0, 0]}).is_empty(),
		"partial position rejected"
	)
	check(
		Profile.location({"zone": "city", "position": [600, 0, 0]}).is_empty(),
		"out-of-city location rejected"
	)
	check(
		Profile.location({"zone": "residence", "position": [0, 0, 0]}).is_empty(),
		"interior vertical bounds checked"
	)
	check(
		not Profile.location({"zone": "city", "position": [-27, 0.2, 168]}).is_empty(),
		"city checkpoint accepted"
	)
	check(
		not Profile.location({"zone": "residence", "position": [0, -39.9, 6.8]}).is_empty(),
		"lobby checkpoint accepted"
	)
	check(Assets.model("user://not-a-model.glb") == null, "asset loader rejects external paths")
	var first_material := Kit.material(Color.WHITE)
	var reused_material := Kit.material(Color.WHITE)
	check(first_material == reused_material, "helper materials reused")


func _test_files() -> void:
	var profile = Profile.new()
	profile.path = "user://fz-upgrade-test-%d.json" % Time.get_ticks_usec()
	var checkpoint := {"zone": "city", "position": [-27, 0.2, 168], "yaw": 1.0}
	check(profile.load_data().location.is_empty(), "missing profile is harmless")
	check(profile.save_data({"fov": 80}, checkpoint) == OK, "first atomic save succeeds")
	check(profile.load_data().settings.fov == 80, "settings round trip")
	check(profile.load_data().location.position[0] == -27, "location round trip")
	check(profile.save_data({"fov": 90}, checkpoint) == OK, "second save succeeds")
	check(FileAccess.file_exists(profile.path + ".bak"), "previous version retained")
	_write(profile.path, "{broken json")
	var backup: Dictionary = profile.load_data()
	check(profile.recovered and backup.settings.fov == 80, "corrupt primary restores backup")
	check(profile.save_data({"fov": 75}, checkpoint) == OK, "save after recovery succeeds")
	check(
		FileAccess.file_exists(profile.path + ".damaged"),
		"corrupt primary preserved for inspection"
	)
	check(
		profile._read(profile.path + ".bak").settings.fov == 80,
		"good backup not replaced with corrupt data"
	)
	_write(profile.path, JSON.stringify({"version": 999, "settings": {}}))
	check(
		profile.load_data().settings.fov == 80 and profile.recovered,
		"future schema uses compatible backup"
	)
	_write(profile.path + ".bak", " ".repeat(Profile.MAX_BYTES + 1))
	check(profile.load_data().location.is_empty(), "oversized backup safely rejected")
	check(not profile.warning.is_empty(), "bad save produces recovery notice")
	for suffix in ["", ".bak", ".tmp", ".damaged"]:
		if FileAccess.file_exists(profile.path + suffix):
			check(
				DirAccess.remove_absolute(profile.path + suffix) == OK,
				"temporary test file removed " + suffix
			)
	profile.path = "user://fz-missing-dir-%d/profile.json" % Time.get_ticks_usec()
	check(profile.save_data({}, {}) != OK, "write failure returned, not reported as success")


func _write(path: String, text: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		check(false, "fixture write failed")
		return
	file.store_string(text)
	file.close()


func _test_settings() -> void:
	world.hud.options_panel.widgets.fov.value = 85
	check(world.player.camera.fov == 85, "FOV applies to real camera")
	world._set_option("invert_y", true)
	world.player.pivot.rotation.x = 0
	world.player.look(Vector2(0, 20))
	check(world.player.pivot.rotation.x > 0, "inverted mouse moves in opposite direction")
	world._set_option("invert_y", false)
	world.player.pivot.rotation.x = 0
	world.player.look(Vector2(0, 20))
	check(world.player.pivot.rotation.x < 0, "normal mouse direction retained")
	var before: Vector3 = world.player.pivot.rotation
	world.player.look(Vector2(INF, 0))
	check(world.player.pivot.rotation == before, "invalid mouse input ignored")
	world._set_option("zoom", 2.2)
	var previous: float = world.player.spring.spring_length
	await runner._frames(2)
	check(
		world.player.spring.spring_length < previous and world.player.spring.spring_length > 2.2,
		"camera zoom interpolates instead of snapping"
	)
	await runner._frames(40)
	check(is_equal_approx(world.player.spring.spring_length, 2.2), "camera reaches requested zoom")
	world._set_option("quality", 0)
	check(
		not world.sun.shadow_enabled and world.player.camera.far == 400,
		"low quality applies real render settings"
	)
	world._set_option("quality", 2)
	check(
		world.sun.shadow_enabled and world.player.camera.far == 850,
		"high quality restores settings"
	)
	world._set_option("fov", NAN)
	check(world.player.camera.fov == 70, "invalid UI input sanitized")
	world._reset_options()
	check(world.options == Profile.DEFAULTS, "settings reset without deleting game data")
	check(world.hud.options_panel.widgets.fov.value == 70, "settings UI synchronized silently")
	world.return_to_city()
	await runner._frames(30)
	Input.action_press("move_forward")
	await runner._frames(10)
	world.pause()
	check(not Input.is_action_pressed("move_forward"), "pause clears held input")
	check(
		world.player.velocity.x == 0 and world.player.velocity.z == 0,
		"pause clears horizontal inertia"
	)
	check(
		world.player.jump_buffer == 0 and world.player.coyote_time == 0, "pause clears jump buffers"
	)
	world.resume()
	var stopped: Vector3 = world.player.global_position
	await runner._frames(20)
	check(
		stopped.distance_to(world.player.global_position) < 0.1,
		"resume does not continue stale movement"
	)
	await runner._action("guide")
	check(runner.paused and world.hud.tabs.current_tab == 1, "F1 opens settings and route")
	world.hud.tabs.current_tab = 0
	await runner._frames(2)
	world.resume()
	await runner._frames(2)
	world.hud.save_report("Ожидание проверки F5")
	await runner._action("quick_save")
	check(
		world.hud.options_panel.save_status.text.contains("Тестовый"),
		"test mode never writes personal profile"
	)


func _test_recovery() -> void:
	world.return_to_city()
	await runner._frames(30)
	var snapshot: Dictionary = world._capture_location()
	check(not snapshot.is_empty(), "grounded position can be saved")
	world.player.place(world.city_spawn)
	await runner._frames(10)
	check(world._restore_location(snapshot), "supported checkpoint restores exactly")
	await runner._frames(20)
	check(
		world.player.global_position.distance_to(world.city_return) < 0.3,
		"restored city position matches save"
	)
	check(
		not world._restore_location({"zone": "city", "position": [450, 80, 450]}),
		"unsupported position falls back"
	)
	check(
		world.player.global_position.distance_to(world.city_spawn) < 0.1,
		"unsafe city save recovers at spawn"
	)
	check(
		not world._restore_location({"zone": "residence", "position": [-5, -35.99, 4]}),
		"empty lift shaft not accepted"
	)
	check(
		world.inside and absf(world.player.global_position.x + 1.9) < 0.1,
		"empty shaft recovers in safe upper hallway"
	)
	check(
		not world._restore_location({"zone": "residence", "position": [2, -35.99, -6]}),
		"saved position inside wall rejected"
	)
	await runner._frames(30)
	check(world.player.is_on_floor(), "recovered interior position has solid floor")
	var snapshot_before: Dictionary = world.last_checkpoint.duplicate(true)
	world.player.place(world.player.global_position + Vector3.UP * 2)
	await runner._frames(2)
	check(
		world._capture_location() == snapshot_before, "airborne save retains last safe checkpoint"
	)


func _test_actions() -> void:
	world.return_to_city()
	await runner._frames(30)
	world._update_interactions()
	world.selected = world.entrance
	world.player.place(Vector3(0, 1, 40))
	var press := InputEventAction.new()
	press.action = "interact"
	press.pressed = true
	world._unhandled_input(press)
	check(not world.inside, "stale interaction revalidated before activation")
	var action := Action.new()
	world.add_child(action)
	var calls: Array[int] = [0]
	action.activated.connect(func(): calls[0] += 1)
	action.interact()
	action.interact()
	check(calls[0] == 1, "generic action ignores rapid duplicates")
	await runner._frames(20)
	action.interact()
	check(calls[0] == 2, "action available after cooldown")
	action.enabled = false
	check(action.get_prompt().is_empty(), "disabled actions hidden")
	action.queue_free()
	world.enter_residence()
	var door = world.residence.apartment_door
	world.player.place(world.residence.global_position + Vector3(0, 0.1, 6))
	await runner._frames(30)
	if door.opened:
		door.interact()
		await runner._frames(80)
	door.interact()
	var target: float = door.target_turn
	door.interact()
	check(door.target_turn == target, "door ignores rapid double-toggle")
	await runner._frames(80)
	check(
		door.get_focus().distance_to(door.leaf.to_global(Vector3(0.85, 1.15, 0))) < 0.01,
		"interaction focus follows moving door"
	)
	# Put the capsule in the *next* closing pose of the leaf.
	var next_pose := Basis(Vector3.UP, door.turn - 0.02) * Vector3(0.8, 0, 0)
	world.player.place(door.to_global(next_pose))
	door.interact()
	var before: float = door.turn
	door._physics_process(1.0 / 60.0)
	check(door.obstructed and door.turn == before, "door stops before crushing player")
	check(door.get_prompt().contains("Освободи"), "door explains obstruction")
	world.player.place(world.residence.global_position + Vector3(0, 0.1, 6))
	await runner._frames(90)
	check(is_zero_approx(door.turn), "door finishes after obstruction removed")


func _test_lift() -> void:
	var lift = world.residence.lift
	world.player.place(world.residence.global_position + Vector3(0, 0.1, 6))
	await runner._frames(30)
	lift.request_floor(1)
	await runner._frames(80)
	lift.request_floor(0)
	lift.request_floor(0)
	check(lift.pending_floor == 0, "busy lift keeps one bounded return request")
	check(lift.status_text().contains("ЭТАЖ 2"), "live lift direction displayed")
	for i in range(250):
		await runner._frames(1)
		if lift.phase == "open":
			break
	check(
		lift.height == 4.0 and lift.boarding_time > 1.0, "queued trip leaves time for disembarking"
	)
	await runner._frames(400)
	check(
		lift.height == 0 and lift.phase == "open" and lift.pending_floor == -1,
		"queued return finishes and clears queue"
	)
	lift.request_floor(1)
	await runner._frames(5)
	world.player.place(lift.global_position + Vector3(0, 0.1, 1.45))
	await runner._frames(20)
	check(lift.height == 0 and lift.phase != "moving", "late threshold obstruction reopens doors")
	await runner._frames(180)
	check(lift.phase == "open" and lift.height == 0, "lift waits while threshold remains occupied")
	world.player.place(lift.global_position + Vector3(0, 0.1, 0))
	await runner._frames(270)
	check(lift.height == 4 and lift.phase == "open", "queued trip resumes after threshold cleared")
	check(absf(world.player.global_position.y + 36) < 0.25, "resumed lift safely carries rider")
	check(
		lift.indicators.size() == 2 and lift.indicators[0].text == lift.status_text(),
		"both landing indicators match actual lift state"
	)


func _test_light() -> void:
	var house = world.residence
	var previous: bool = house.apartment_lit
	world.player.place(house.global_position + Vector3(-0.7, 4.1, -4.7))
	await runner._frames(30)
	check(world.nearby.has(house.light_switch), "light switch reachable from inside apartment")
	world.selection_override = house.light_switch
	await runner._frames(2)
	await runner._action("interact")
	check(house.apartment_light.visible != previous, "apartment switch controls real light")
	check(house.light_switch.title.contains("Включить"), "switch prompt reflects off state")
	await runner._frames(20)
	house.light_switch.interact()
	check(house.apartment_light.visible == previous, "apartment light restored")
	world._reset_options()
	world.return_to_city()
