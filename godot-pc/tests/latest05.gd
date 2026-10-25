extends SceneTree
var menu
var checks := 0
var failures := 0


func _initialize() -> void:
	run.call_deferred()


func check(ok: bool, title: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		push_error("FAIL latest05: " + title)
	else:
		print("PASS latest05: ", title)


func ticks(n: int) -> void:
	for i in range(n):
		await process_frame
		OS.delay_msec(1)


func run() -> void:
	menu = load("res://scenes/main_menu.tscn").instantiate()
	menu.testing = true
	root.add_child(menu)
	current_scene = menu
	await ticks(5)
	menu.show_destinations()
	check(menu.page == "destinations", "map selector opens without a world")
	menu.close_panel()
	menu.selected_spawn = "sky"
	menu.launch()
	for i in range(20000):
		await ticks(1)
		if not menu.busy:
			break
	if menu.world == null or not menu.world.state_ready:
		check(false, "latest world ready: " + menu.last_error)
		quit(1)
		return
	var w = menu.world
	await ticks(90)
	check(w.city_mesh_count > 2000, "actual current web scene, not the legacy 320-mesh GLB")
	check(w.directory.buildings.size() == 322, "322 source buildings catalogued")
	check(w.player.global_position.y > 350, "sky spawn retained at source coordinates")
	check(w.player.is_on_floor(), "sky spawn grounded")
	check(w.metro.stations.size() == 5, "five original stations")
	for id in w.spawn_points:
		w.travel(id)
		await ticks(90)
		check(w.player.is_on_floor(), "grounded spawn: " + id)
		check(w.player.global_position.distance_to(w.spawn_points[id]) < 8, "spawn position: " + id)
	# Walk down actual station ramp with the real character motor.
	var s = w.directory.stations[0]
	w.player.place(Vector3(s.x, 0.2, s.z + 0.5), PI)
	await ticks(20)
	Input.action_press("move_forward")
	await ticks(400)
	Input.action_release("move_forward")
	await ticks(15)
	check(
		w.player.global_position.y < -7 and w.player.global_position.y > -9,
		"walk from city to underground platform"
	)
	for station in w.directory.stations:
		w.player.place(Vector3(station.x, 0.2, station.z + 0.5), PI)
		await ticks(15)
		Input.action_press("move_forward")
		await ticks(400)
		Input.action_release("move_forward")
		await ticks(15)
		check(
			w.player.global_position.y < -7 and w.player.is_on_floor(),
			"walk down: " + station.name + str(w.player.global_position)
		)
		w.player.place(Vector3(station.x, -7.8, station.z + 28.5), 0)
		await ticks(15)
		Input.action_press("move_forward")
		await ticks(410)
		Input.action_release("move_forward")
		await ticks(15)
		check(
			w.player.global_position.y > -0.4 and w.player.is_on_floor(),
			"walk back to street: " + station.name + str(w.player.global_position)
		)
	w.player.place(Vector3(s.x + 20, -8.8, s.z + 46), 0)
	await ticks(15)
	Input.action_press("move_forward")
	await ticks(140)
	Input.action_release("move_forward")
	await ticks(15)
	check(
		w.player.is_on_floor() and w.player.global_position.y > -8.2,
		"walk from track pit back to platform"
	)
	# A saved checkpoint is region-aware and survives a fresh profile read.
	w.travel("sea")
	await ticks(45)
	var checkpoint = w._capture_location()
	check(checkpoint.get("zone") == "v28", "latest checkpoint uses its own zone")
	var storage = w.Profile.new()
	storage.path = "user://latest05-test-%d.json" % Time.get_ticks_usec()
	check(storage.save_data(w.options, checkpoint) == OK, "latest checkpoint written")
	var saved = storage.load_data().location
	w.travel("center")
	check(w._restore_location(saved), "latest checkpoint accepted")
	await ticks(20)
	check(w.player.global_position.x > 5800, "saved sea spawn restored, not city fallback")
	DirAccess.remove_absolute(storage.path)
	# Board via the open middle doorway, without E or a seat.
	w.metro.phase = "open"
	w.metro.elapsed = 0
	w.metro.index = 0
	w.metro.train.position = w.metro.stop_position(0)
	w.metro.door_open = 1
	w.player.place(w.metro.train.to_global(Vector3(0, 0.15, 2)), PI)
	w.metro.phase = "closing"
	await ticks(150)
	check(
		w.metro.paused_for_threshold and w.metro.phase == "closing",
		"occupied doorway prevents departure"
	)
	w.metro.phase = "open"
	w.metro.elapsed = 0
	w.player.place(w.metro.train.to_global(Vector3(0, 0.15, 5)), PI)
	await ticks(20)
	Input.action_press("move_forward")
	await ticks(65)
	Input.action_release("move_forward")
	await ticks(15)
	check(w.metro.rider_inside(), "walk through train doorway")
	w.metro.phase = "closing"
	w.metro.elapsed = 0
	await ticks(140)
	check(w.metro.phase == "travel", "doors close before departure")
	w.pause()
	await ticks(4)
	var before: Vector3 = w.metro.train.position
	await ticks(25)
	check(w.metro.train.position == before, "pause freezes moving train")
	w.resume()
	await ticks(900)
	check(w.metro.index == 1, "train reaches next source station")
	check(w.metro.rider_inside(), "standing passenger carried to destination")
	check(w.player.is_on_floor(), "passenger remains on actual floor")
	for expected in [2, 3, 4, 0]:
		w.metro.phase = "closing"
		w.metro.elapsed = 0
		for frame in range(1600):
			await ticks(1)
			if w.metro.index == expected and w.metro.phase == "open":
				break
		await ticks(3)
		check(
			w.metro.index == expected and w.metro.phase == "open",
			(
				"full loop arrival: "
				+ str(expected)
				+ " actual="
				+ str(w.metro.index)
				+ "/"
				+ w.metro.phase
				+ "/"
				+ str(w.metro.elapsed)
			)
		)
		check(
			w.metro.rider_inside() and w.player.is_on_floor(),
			"full loop standing rider: " + str(expected)
		)
	w.player.pivot.rotation.y = 0
	Input.action_press("move_forward")
	await ticks(65)
	Input.action_release("move_forward")
	await ticks(20)
	check(not w.metro.rider_inside() and w.player.is_on_floor(), "walk out of train onto platform")
	check(w.player.global_position.z < w.metro.train.position.z - 2.5, "exit crosses real doorway")
	menu.return_to_menu()
	await ticks(8)
	check(
		menu.world == null and get_nodes_in_group("player").is_empty(),
		"latest world released on return"
	)
	w = null
	menu.queue_free()
	await ticks(8)
	print("LATEST_RESULT checks=%d failures=%d" % [checks, failures])
	quit(0 if failures == 0 else 1)
