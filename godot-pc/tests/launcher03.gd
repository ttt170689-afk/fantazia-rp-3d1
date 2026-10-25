extends SceneTree
const Launcher = preload("res://scripts/main_menu.gd")
const LaunchLog = preload("res://scripts/launch_log.gd")
const Visuals = preload("res://scripts/ui_theme.gd")
var menu
var checks: int = 0
var failures: Array[String] = []


func _initialize() -> void:
	_run.call_deferred()


func check(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("PASS launcher03: ", label)
	else:
		failures.append(label)
		push_error("FAIL launcher03: " + label)


func ticks(count: int) -> void:
	for i in range(count):
		await process_frame
		OS.delay_msec(1)


func wait_for_launch() -> void:
	for i in range(8000):
		await ticks(1)
		if not menu.busy:
			return
	check(false, "launch completes within bounded wait")


func count_3d(node: Node) -> int:
	var result := 1 if node is Node3D else 0
	for child in node.get_children():
		result += count_3d(child)
	return result


func count_textured(node: Node) -> int:
	var result := 0
	if node is MeshInstance3D and node.mesh != null:
		for surface in range(node.mesh.get_surface_count()):
			var material = node.get_active_material(surface)
			if material is BaseMaterial3D and material.albedo_texture != null:
				if material.albedo_texture.get_width() > 0:
					result += 1
	for child in node.get_children():
		result += count_textured(child)
	return result


func _run() -> void:
	menu = load("res://scenes/main_menu.tscn").instantiate()
	menu.testing = true
	root.add_child(menu)
	current_scene = menu
	await ticks(12)
	check(Launcher.supported_engine(), "current Godot version supported")
	check(count_3d(menu) == 0, "main menu starts with zero 3D nodes")
	check(get_nodes_in_group("player").is_empty(), "no player created before Play")
	check(
		get_nodes_in_group("interactable").is_empty(), "no city interactions allocated before Play"
	)
	check(not ResourceLoader.has_cached("res://assets/city.scn"), "native city not loaded by menu")
	check(menu.world == null and not menu.busy, "no hidden game instance")
	check(menu.get_node("%MenuView").visible, "main menu visible on boot")
	check(not menu.get_node("%Overlay").visible, "no startup modal blocks menu")
	check(menu.get_node("%SafeMode").button_pressed, "safe graphics default enabled")
	check(menu.get_node("%Play").has_focus(), "keyboard focus starts on Play")
	check(
		Visuals.shared().get_color("font_color", "Label") == Visuals.TEXT,
		"native theme uses the web lobby text palette"
	)
	check(menu.get_node("%Play").theme_type_variation == "PrimaryButton", "primary action styled")
	check(Launcher.preflight().is_empty(), "native model headers and checksums valid")
	var alias = load("res://scenes/main.tscn").instantiate()
	check(
		not alias is Node3D and count_3d(alias) == 0, "legacy main scene also starts with the menu"
	)
	alias.free()
	await test_panels()
	test_preflight_failures()
	test_breadcrumbs()
	# Cancellation during actual incremental loading, not an artificial fake world.
	menu.get_node("%Play").pressed.emit()
	check(menu.busy and menu.page == "loading", "Play starts a loading page")
	await ticks(4)
	menu.cancel_loading()
	await wait_for_launch()
	await ticks(6)
	check(not menu.busy and menu.world == null, "cancel releases the in-progress world")
	check(count_3d(menu) == 0, "cancel leaves no 3D nodes")
	check(menu.last_error.contains("отменена"), "cancel has an explanatory message")
	check(menu.get_node("%Back").visible, "cancel offers a path back to menu")
	menu.close_panel()
	await ticks(4)
	check(menu.page == "main", "Back returns from error to main menu")
	# Cancel again after geometry construction has started, using the real Esc path.
	menu.get_node("%Play").pressed.emit()
	var saw_colliders := false
	for i in range(8000):
		await ticks(1)
		if is_instance_valid(menu.world) and menu.world.city_collider_count > 0:
			saw_colliders = true
			break
		if not menu.busy:
			break
	check(saw_colliders and menu.busy, "collision batches yield before the world is ready")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	Input.parse_input_event(escape)
	await ticks(2)
	check(menu.cancel_requested, "Escape reaches launcher instead of hidden game HUD")
	escape.pressed = false
	Input.parse_input_event(escape)
	await wait_for_launch()
	await ticks(6)
	check(menu.world == null and count_3d(menu) == 0, "mid-physics cancellation frees geometry")
	check(menu.last_error.contains("отменена"), "mid-physics cancellation reports correctly")
	menu.close_panel()
	await ticks(4)
	# Two full starts and returns exercise ownership and state cleanup.
	for cycle in range(2):
		menu.get_node("%Play").pressed.emit()
		await wait_for_launch()
		await ticks(40)
		if not is_instance_valid(menu.world):
			check(false, "world instance available after Play: " + menu.last_error)
			quit(1)
			return
		check(menu.world.state_ready and menu.page == "game", "game reaches ready state %d" % cycle)
		check(not menu.get_node("%MenuView").visible, "main menu hides only after successful load")
		check(not menu.get_node("%Overlay").visible, "loading overlay released")
		check(menu.world.hud.visible, "game HUD visible after load")
		check(menu.world.player.camera.current, "gameplay camera activated at readiness")
		check(menu.world.city_mesh_count >= 300, "real city imported")
		check(
			count_textured(menu.world.city) > 100, "city retains actual imported texture resources"
		)
		check(menu.world.city_collider_count > 100, "city collision construction completed")
		check(get_nodes_in_group("player").size() == 1, "exactly one player after restart")
		check(not menu.world.sun.shadow_enabled, "safe mode disables sun shadows")
		check(root.msaa_3d == Viewport.MSAA_DISABLED, "safe mode disables MSAA")
		check(menu.world.options.quality == 0, "safe preset reflected in saved settings")
		check(menu.world.player.is_on_floor(), "player safely grounded after managed boot")
		check(menu.launch_log.state == "running", "running state recorded")
		menu.world.pause()
		await ticks(4)
		check(paused and not menu.world.can_process(), "managed world does not inherit ALWAYS mode")
		var clock: float = menu.world.save_clock
		var animation_time: float = menu.world.player.animator.current_animation_position
		await ticks(20)
		check(menu.world.save_clock == clock, "managed world clock freezes during pause")
		check(
			menu.world.player.animator.current_animation_position == animation_time,
			"managed character animation freezes during pause"
		)
		check(menu.world.hud.can_process(), "pause controls remain active")
		menu.world.hud.return_to_menu_requested.emit()
		await ticks(8)
		check(menu.world == null and count_3d(menu) == 0, "return frees all 3D nodes %d" % cycle)
		check(get_nodes_in_group("player").is_empty(), "no player left in main menu")
		check(get_nodes_in_group("interactable").is_empty(), "no stale interactions after return")
		check(
			menu.get_node("%MenuView").visible and not paused, "main menu usable after paused game"
		)
		check(menu.launch_log.state == "clean", "return records a clean stop")
	# A visible failure page can be dismissed; buttons remain connected.
	menu._finish_failure("Тест: отсутствует ресурс")
	await ticks(4)
	check(menu.page == "error" and menu.get_node("%Overlay").visible, "failure is a visible page")
	check(
		not menu.get_node("%Play").disabled, "recoverable failure does not permanently disable Play"
	)
	menu.close_panel()
	await ticks(4)
	check(menu.page == "main" and count_3d(menu) == 0, "failure returns to a lightweight menu")
	print("LAUNCHER_RESULT checks=%d failures=%d" % [checks, failures.size()])
	menu.queue_free()
	await process_frame
	await process_frame
	quit(0 if failures.is_empty() else 1)


func test_panels() -> void:
	menu.get_node("%Settings").pressed.emit()
	await ticks(4)
	check(
		menu.page == "settings" and menu.settings_panel != null,
		"Settings button opens real controls"
	)
	menu.settings_panel.widgets.fov.value = 83
	check(menu.options.fov == 83, "pre-game settings receive UI changes")
	menu.settings_panel.save_requested.emit()
	check(
		menu.settings_panel.save_status.text.contains("сохранены"),
		"front settings save path responds"
	)
	menu.close_panel()
	await ticks(3)
	menu.get_node("%Controls").pressed.emit()
	check(menu.page == "controls", "Controls button opens route")
	menu.close_panel()
	menu.get_node("%News").pressed.emit()
	check(menu.page == "news", "migration status button opens honest scope")
	menu.close_panel()
	menu.get_node("%Diagnostics").pressed.emit()
	check(menu.page == "diagnostics", "diagnostics button opens help")
	menu.export_diagnostics()
	check(menu.launch_log.report().contains("Godot:"), "diagnostics include engine version")
	check(
		not menu.launch_log.report().contains(OS.get_user_data_dir()),
		"report excludes user directory"
	)
	menu.close_panel()
	await ticks(4)
	check(count_3d(menu) == 0, "all front panels work without a 3D world")
	check(not menu.launch_log.enabled, "tests never write the real crash marker")


func test_preflight_failures() -> void:
	var path := "user://fz-header-test-%d.scn" % Time.get_ticks_usec()
	check(not Launcher.preflight([path]).is_empty(), "missing file yields a readable error")
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_32(0x46546c67)
	file.close()
	check(
		Launcher.preflight([path]).contains("заголовок"),
		"short native resource rejected before parser"
	)
	file = FileAccess.open(path, FileAccess.WRITE)
	file.store_32(0x46546c67)
	file.store_32(2)
	file.store_32(1000)
	file.store_buffer(PackedByteArray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
	file.close()
	check(
		Launcher.preflight([path]).contains("Повреждён"),
		"GLB signature rejected by native-only preflight"
	)
	check(DirAccess.remove_absolute(path) == OK, "preflight fixture removed")


func test_breadcrumbs() -> void:
	var log = LaunchLog.new()
	log.path = "user://fz-launch-test-%d.json" % Time.get_ticks_usec()
	check(not log.previous_interrupted(), "missing marker is not treated as a crash")
	log.mark("loading", "Физика города: 12 / 320")
	var fresh = LaunchLog.new()
	fresh.path = log.path
	check(fresh.previous_interrupted(), "unfinished load detected on next launch")
	check(fresh.stage.contains("12 / 320"), "last completed stage preserved")
	log.mark("running", "Город готов")
	check(fresh.previous_interrupted(), "unclean gameplay stop detected")
	log.mark("clean", "Выход")
	check(not fresh.previous_interrupted(), "intentional quit is not reported as a crash")
	log.mark("failed", "Импорт", "Ресурс не найден")
	check(
		not fresh.previous_interrupted() and fresh.last_error == "Ресурс не найден",
		"handled failure retains diagnostic details"
	)
	check(DirAccess.remove_absolute(log.path) == OK, "marker fixture removed")
