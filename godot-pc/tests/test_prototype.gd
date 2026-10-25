extends SceneTree
const Upgrade02 = preload("res://tests/upgrade02.gd")
## Run with: godot --headless --path . --fixed-fps 60 --script tests/test_prototype.gd -- --test
var world
var failures: Array[String] = []
var checks: int = 0


func _initialize() -> void:
	_run.call_deferred()


func _check(condition: bool, label: String) -> void:
	checks += 1
	if condition:
		print("PASS ", label)
	else:
		failures.append(label)
		push_error("FAIL " + label)


func _frames(count: int) -> void:
	for i in range(count):
		await physics_frame


func _action(name: String) -> void:
	var event := InputEventAction.new()
	event.action = name
	event.pressed = true
	Input.parse_input_event(event)
	await _frames(2)
	event = InputEventAction.new()
	event.action = name
	event.pressed = false
	Input.parse_input_event(event)
	await _frames(2)


func _walk_to(target: Vector3, budget: int = 350) -> bool:
	Input.action_press("move_forward")
	var arrived := false
	for i in range(budget):
		var difference: Vector3 = target - world.player.global_position
		difference.y = 0
		if difference.length() < 0.22:
			arrived = true
			break
		world.player.pivot.rotation.y = atan2(-difference.x, -difference.z)
		await physics_frame
	Input.action_release("move_forward")
	await _frames(12)
	return arrived


func _run() -> void:
	world = load("res://scenes/world.tscn").instantiate()
	world.testing = true
	root.add_child(world)
	current_scene = world
	for i in range(8000):
		if world.state_ready or not world.boot_error.is_empty():
			break
		await process_frame
		OS.delay_msec(1)
	if not world.state_ready:
		_check(false, "world failed to initialize: " + world.boot_error)
		quit(1)
		return
	await _frames(90)
	_check(world.state_ready, "world finishes initialization")
	_check(world.city_mesh_count >= 300, "original GLB city meshes, not a replacement map")
	_check(world.city_collider_count > 100, "triangle colliders on actual city surfaces")
	_check(world.player.model_loaded, "original gameplay avatar loads")
	_check(world.residence.concierge_loaded, "concierge uses gameplay GLB")
	_check(world.player.animator != null, "GLB animation player exists")
	if world.player.animator != null:
		_check(world.player.animator.get_animation_list().size() >= 27, "27 source animation clips")
		_check(world.player.animator.has_animation("ANIM_Walk_Loop"), "walking animation imported")
	_check(world.player.is_on_floor(), "city spawn has a real walkable floor")
	_check(world.player.global_position.y > -1, "city spawn remains above terrain")
	_check(
		world.player.animator.current_animation == "ANIM_Idle_Loop", "imported idle actually plays"
	)
	await _action("dance")
	await _frames(4)
	_check(world.player.animator.current_animation == "ANIM_Dance_Loop", "B plays imported dance")
	await _action("dance")
	var resting_y: float = world.player.global_position.y
	await _action("jump")
	await _frames(10)
	_check(world.player.global_position.y > resting_y + 0.4, "Space triggers a physical jump")
	await _frames(60)
	_check(world.player.is_on_floor(), "jump returns to the city floor")
	var before: Vector3 = world.player.global_position
	Input.action_press("move_forward")
	await _frames(40)
	_check(world.player.animator.current_animation == "ANIM_Walk_Loop", "W plays imported walk")
	Input.action_release("move_forward")
	await _frames(12)
	var walk_distance: float = before.distance_to(world.player.global_position)
	_check(walk_distance > 2.0, "W moves the character in the city")
	world.player.place(world.city_spawn, PI)
	await _frames(30)
	before = world.player.global_position
	Input.action_press("run")
	Input.action_press("move_forward")
	await _frames(40)
	_check(world.player.animator.current_animation == "ANIM_Run_Loop", "Shift plays imported run")
	Input.action_release("move_forward")
	Input.action_release("run")
	await _frames(12)
	_check(
		before.distance_to(world.player.global_position) > walk_distance * 1.3, "Shift runs faster"
	)
	world.player.place(world.city_return, PI)
	await _frames(30)
	_check(world.nearby.has(world.entrance), "home entrance reachable from actual city pavement")
	world.selection_override = world.entrance
	await _frames(2)
	await _action("interact")
	_check(world.inside, "E enters the connected residence")
	await _frames(30)
	var origin: Vector3 = world.residence.global_position
	_check(world.player.is_on_floor(), "lobby floor supports the player")
	# Climb continuously: inspect every physics tick, not just the destination.
	world.player.place(origin + world.residence.stair_bottom)
	await _frames(30)
	Input.action_press("move_forward")
	var previous_y: float = world.player.global_position.y
	var greatest_step: float = 0.0
	for i in range(240):
		await physics_frame
		greatest_step = maxf(greatest_step, absf(world.player.global_position.y - previous_y))
		previous_y = world.player.global_position.y
		if world.player.global_position.z <= -7.2:
			break
	Input.action_release("move_forward")
	await _frames(15)
	_check(world.player.global_position.y - origin.y > 3.85, "physical stairs reach floor two")
	_check(greatest_step < 0.3, "stairs climb continuously without teleportation")
	_check(world.player.is_on_floor(), "top landing supports the character")
	_check(await _walk_to(origin + Vector3(3.0, 4.1, -7.3)), "stairs connect to upper corridor")
	_check(
		await _walk_to(origin + Vector3(3.0, 4.1, 0.0)),
		"upper corridor is not blocked by apartment wall"
	)
	_check(await _walk_to(origin + Vector3(-1.9, 4.1, -0.7)), "upper hall reaches apartment door")
	world.residence.apartment_door.interact()
	await _frames(75)
	_check(world.residence.apartment_door.turn > 1.7, "apartment door physically rotates open")
	_check(
		await _walk_to(origin + Vector3(-1.9, 4.1, -4.6)), "open apartment doorway is traversable"
	)
	_check(
		absf(world.player.global_position.y - (origin.y + 4.0)) < 0.25,
		"furnished apartment has a proper floor"
	)
	# Stair descent is a separate route from the lift.
	world.player.place(origin + world.residence.stair_top, PI)
	await _frames(30)
	_check(await _walk_to(origin + Vector3(5.15, 0.1, 7.0)), "stairs descend back to the lobby")
	_check(
		absf(world.player.global_position.y - origin.y) < 0.25, "stair descent ends at floor one"
	)
	var lift = world.residence.lift
	world.player.place(lift.global_position + Vector3(0, 0.1, 1.45))
	await _frames(20)
	lift.request_floor(1)
	_check(lift.phase == "open", "occupied threshold blocks departure")
	world.player.place(lift.global_position + Vector3(0, 0.15, 0))
	await _frames(30)
	_check(lift._rider_inside(), "character can stand in the actual lift cabin")
	await _action("floor_two")
	_check(lift.phase == "closing", "key 2 requests the upper floor")
	await _frames(75)
	_check(lift.height > 0.1 and lift.height < 3.9, "lift really moves between floors")
	world.pause()
	# Pause commits at the engine boundary, after pending physics queries flush.
	await _frames(2)
	var paused_height: float = lift.height
	await _frames(30)
	_check(is_equal_approx(lift.height, paused_height), "pause freezes lift physics")
	_check(world.hud.menu.visible, "pause menu is shown")
	var menu_rect: Rect2 = world.hud.menu.get_global_rect()
	var viewport_rect: Rect2 = world.get_viewport().get_visible_rect()
	_check(viewport_rect.encloses(menu_rect), "native menu fits the PC viewport")
	world.resume()
	await _frames(230)
	_check(
		lift.phase == "open" and is_equal_approx(lift.height, 4.0),
		"lift arrives and opens on floor two"
	)
	_check(
		absf(world.player.global_position.y - (origin.y + 4)) < 0.25,
		"lift carries its passenger without falling or double motion"
	)
	_check(is_equal_approx(lift.gates[0].position.x, 0.0), "empty lower shaft stays guarded")
	_check(lift.gates[1].position.x < -2.8, "upper landing gate opens only at arrival")
	_check(
		await _walk_to(origin + Vector3(-5, 4.1, 6.7)), "passenger can physically exit on floor two"
	)
	world.player.place(lift.global_position + Vector3(0, 4.15, 0))
	await _frames(30)
	await _action("floor_one")
	await _frames(250)
	_check(lift.phase == "open" and is_equal_approx(lift.height, 0.0), "lift returns to floor one")
	_check(absf(world.player.global_position.y - origin.y) < 0.25, "passenger returns with cabin")
	# A closed entry door must stop movement; opening it restores the exit path.
	world.player.place(origin + Vector3(0, 0.1, 7.2), PI)
	await _frames(30)
	Input.action_press("move_forward")
	await _frames(50)
	Input.action_release("move_forward")
	_check(world.player.global_position.z < 8.8, "closed door blocks the capsule")
	world.player.place(origin + Vector3(0, 0.1, 6.5), PI)
	await _frames(20)
	world.residence.entry_door.interact()
	await _frames(75)
	_check(world.residence.entry_door.turn > 1.7, "entry door opens after clearing swing area")
	_check(await _walk_to(origin + Vector3(0, 0.1, 10.2)), "open entry door can be walked through")
	await _action("interact")
	_check(not world.inside, "exit interaction returns to city")
	await _frames(30)
	_check(world.player.is_on_floor(), "return from interior lands safely")
	await _action("flashlight")
	_check(world.player.flashlight.visible, "F toggles native flashlight")
	world.player.place(Vector3(0, -70, 0))
	await _frames(30)
	_check(world.player.global_position.y > -1, "out-of-bounds recovery returns to city")
	_check(
		world.player.spring.shape is SphereShape3D, "third-person camera uses volumetric collision"
	)
	world.enter_residence()
	world.player.place(origin + Vector3(-1.9, 4.1, -7.2), PI)
	await _frames(30)
	_check(world.player.spring.get_hit_length() < 4.0, "camera arm retracts against interior wall")
	for key in ["move_forward", "move_back", "move_left", "move_right", "run"]:
		Input.action_release(key)
	print(
		(
			"MODEL_COUNTS city_meshes=%d city_colliders=%d animations=%d"
			% [
				world.city_mesh_count,
				world.city_collider_count,
				world.player.animator.get_animation_list().size()
			]
		)
	)
	var upgrade = Upgrade02.new()
	await upgrade.run(self, world)
	print("PROTOTYPE_RESULT checks=%d failures=%d" % [checks, failures.size()])
	get_tree_cleanup()
	await process_frame
	await process_frame
	quit(0 if failures.is_empty() else 1)


func get_tree_cleanup() -> void:
	paused = false
	if is_instance_valid(world):
		world.queue_free()
