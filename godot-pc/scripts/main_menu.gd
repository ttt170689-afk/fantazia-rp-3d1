extends Node
## Entry scene: only native 2D UI exists until the player explicitly presses Play.
const Visuals = preload("res://scripts/ui_theme.gd")
const Profile = preload("res://scripts/profile.gd")
const Options = preload("res://scripts/options_panel.gd")
const LaunchLog = preload("res://scripts/launch_log.gd")
const GAME_SCENE: String = "res://scenes/world.tscn"

var selected_spawn := "sky"
var testing: bool = "--test" in OS.get_cmdline_user_args()
var profile = Profile.new()
var launch_log = LaunchLog.new()
var options: Dictionary = Profile.DEFAULTS.duplicate()
var checkpoint: Dictionary = {}
var world: Node3D
var busy: bool = false
var quitting: bool = false
var cancel_requested: bool = false
var load_started: int = 0
var stalled: bool = false
var progress: ProgressBar
var stage_label: Label
var cancel_button: Button
var settings_panel: VBoxContainer
var page: String = "main"
var last_error: String = ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_window().min_size = Vector2i(960, 720)
	if not testing:
		get_tree().auto_accept_quit = false
	launch_log.enabled = not testing
	%MenuView.theme = Visuals.shared()
	%Overlay.theme = Visuals.shared()
	Visuals.primary(%Play)
	%Play.pressed.connect(launch)
	%Settings.pressed.connect(show_settings)
	%Controls.pressed.connect(show_controls)
	%News.pressed.connect(show_news)
	%Diagnostics.pressed.connect(show_diagnostics)
	%Quit.pressed.connect(quit_application)
	%Back.pressed.connect(close_panel)
	selected_spawn = "legacy" if testing else "sky"
	profile.path = "user://prototype-profile.json" if testing else "user://world05-profile.json"
	%Destinations.pressed.connect(show_destinations)
	_reload_profile()
	if not testing and not checkpoint.is_empty():
		selected_spawn = "continue"
	if launch_log.previous_interrupted():
		%SafeMode.button_pressed = true
		%Notice.text = (
			"Прошлый запуск не завершился штатно.\nЭтап: "
			+ launch_log.stage
			+ "\nОставь безопасный запуск включённым."
		)
	if not supported_engine():
		%Play.disabled = true
		%Notice.text = (
			"Нужен Godot 4.5.1 или новее (4.x), Standard.\nТекущая версия: "
			+ str(Engine.get_version_info().get("string", "?"))
		)
	%Play.grab_focus()


static func supported_engine() -> bool:
	var version := Engine.get_version_info()
	return (
		int(version.major) == 4
		and (int(version.minor) > 5 or (int(version.minor) == 5 and int(version.patch) >= 1))
	)


func _reload_profile() -> void:
	if not testing:
		var data: Dictionary = profile.load_data()
		options = data.settings
		# Match the world's prototype-01 migration before a menu save creates JSON.
		if not FileAccess.file_exists(profile.path) and not profile.recovered:
			var legacy := ConfigFile.new()
			if legacy.load("user://settings.cfg") == OK:
				options.sensitivity = Profile.number(
					legacy.get_value("controls", "sensitivity"), 0.0025, 0.001, 0.006
				)
		checkpoint = data.location
	%Play.text = "ПРОДОЛЖИТЬ  →" if not checkpoint.is_empty() else "ИГРАТЬ  →"


func _begin_panel(title: String, id: String) -> void:
	page = id
	for child in %PanelContent.get_children():
		%PanelContent.remove_child(child)
		child.queue_free()
	settings_panel = null
	%PanelTitle.text = title
	%Overlay.show()
	%Back.show()
	%Back.disabled = false
	%Back.grab_focus()


func _text(text: String, color: Color = Visuals.MUTED) -> Label:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("font_color", color)
	%PanelContent.add_child(label)
	return label


func _button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 48
	button.pressed.connect(action)
	%PanelContent.add_child(button)
	return button


func close_panel() -> void:
	if busy:
		cancel_loading()
		return
	if page == "settings":
		_save_front_settings()
	%Overlay.hide()
	page = "main"
	%Play.grab_focus()


func show_settings() -> void:
	if busy:
		return
	_begin_panel("НАСТРОЙКИ", "settings")
	settings_panel = Options.new()
	%PanelContent.add_child(settings_panel)
	settings_panel.sync(options)
	settings_panel.option_changed.connect(
		func(key: String, value: Variant):
			if Profile.DEFAULTS.has(key):
				options[key] = value
				options = Profile.settings(options)
				settings_panel.report("Сохранится при закрытии панели или нажатии «Сохранить».")
	)
	settings_panel.save_requested.connect(_save_front_settings)
	settings_panel.reset_requested.connect(
		func():
			options = Profile.DEFAULTS.duplicate()
			settings_panel.sync(options)
			_save_front_settings()
	)


func _save_front_settings() -> void:
	var result: Error = OK if testing else profile.save_data(options, checkpoint)
	if is_instance_valid(settings_panel):
		settings_panel.report(
			(
				"Настройки сохранены."
				if result == OK
				else "Не удалось сохранить настройки: %d" % result
			),
			result == OK
		)


func show_controls() -> void:
	if busy:
		return
	_begin_panel("УПРАВЛЕНИЕ И МАРШРУТ", "controls")
	_text(
		(
			"WASD / стрелки — ходьба     Shift — бег     Space — прыжок\n"
			+ "Мышь — камера     Колёсико — расстояние     E — действие\n"
			+ "Tab — другое действие рядом     F — свет     B — танец\n"
			+ "1 / 2 в кабине — этаж     Esc — пауза\nF1 — настройки и маршрут     F5 в игре — сохранение"
		)
	)
	_text("МАРШРУТ", Visuals.VIOLET)
	_text(
		(
			"v28: выбери спавн в главном меню. Метро: вход M → спуск пешком → открытые двери.\n"
			+ "В вагон заходи полностью. Проезд по пяти станциям, выход после открытия дверей.\n"
			+ "Карта 04 доступна отдельно: там сохранены подъезд, квартира и лифт."
		)
	)
	_text("В меню паузы есть возврат ко входу в дом и отдельный выход в главное меню.")


func show_news() -> void:
	if busy:
		return
	_begin_panel("ЧТО ПЕРЕНЕСЕНО", "news")
	_text("GODOT PC 05 · ПОСЛЕДНЯЯ КАРТА ВЕБ-ВЕРСИИ", Visuals.VIOLET)
	_text(
		(
			"Геометрия города v28, небесной площади и морского района "
			+ "перенесена из реальной браузерной сцены. Выбери точку входа в меню."
		)
	)
	_text(
		(
			"Метро: пять спусков, платформы, поезд с дверями и перевозкой пассажира. "
			+ "Вход и посадка пешком, без телепорта в вагон."
		)
	)
	_text(
		(
			"Ещё не перенесены все интерьеры, торговля, онлайн, задания, морские рейсы, "
			+ "кинофильмы и оригинальные 3D-заставки. Здание не означает готовую механику."
		)
	)


func show_diagnostics() -> void:
	if busy:
		return
	_begin_panel("ПОМОЩЬ ПРИ ВЫЛЕТЕ", "diagnostics")
	_text(
		(
			"1. Оставь безопасный запуск включённым.\n"
			+ "2. Распакуй версию 05 в новую папку и открой project.godot в обычном режиме.\n"
			+ "3. Запускай весь проект F5, не отдельную игровую сцену F6.\n"
			+ "4. Импорта GLB в версии 05 нет. Если редактор всё равно вылетает, "
			+ "пришли журнал и версию Godot."
		)
	)
	_text(launch_log.report())
	_button("СОХРАНИТЬ / СКОПИРОВАТЬ ДИАГНОСТИКУ", export_diagnostics)
	_text(
		(
			"Отчёт остаётся на компьютере. Автоматической отправки нет. "
			+ "Лог драйвера/Godot может содержать больше сведений, чем этот краткий отчёт."
		)
	)


func export_diagnostics() -> void:
	var result: Error = launch_log.export_report()
	if not testing and DisplayServer.has_feature(DisplayServer.FEATURE_CLIPBOARD):
		DisplayServer.clipboard_set(launch_log.report())
	_text(
		(
			"Отчёт: user://diagnostics.txt. Текст скопирован, если буфер обмена доступен."
			if result == OK
			else "Не удалось сохранить отчёт: %d" % result
		)
	)


func launch() -> void:
	if busy or is_instance_valid(world) or not supported_engine():
		return
	busy = true
	cancel_requested = false
	stalled = false
	last_error = ""
	load_started = Time.get_ticks_msec()
	launch_log.mark("loading", "Проверка файлов")
	_begin_panel("ЗАГРУЗКА FANTAZIA", "loading")
	%Back.hide()
	stage_label = _text("Проверяем локальные файлы…", Visuals.TEXT)
	progress = ProgressBar.new()
	progress.custom_minimum_size.y = 14
	progress.show_percentage = false
	%PanelContent.add_child(progress)
	_text(
		(
			"Город загружается только после нажатия «ИГРАТЬ».\n"
			+ "Готовые модели читаются без GLTF-импортера."
		)
	)
	cancel_button = _button("ОТМЕНИТЬ ЗАГРУЗКУ", cancel_loading)
	_button("СОХРАНИТЬ ДИАГНОСТИКУ", export_diagnostics)
	_button("ВЫЙТИ", quit_application)
	await get_tree().process_frame
	if cancel_requested:
		_finish_failure("Загрузка отменена.")
		return
	var paths: Array[String] = ["res://assets/city.scn", "res://assets/player.scn"]
	if selected_spawn != "legacy":
		paths = [
			"res://assets/city_v28.scn",
			"res://assets/sky_v28.scn",
			"res://assets/sea_v28.scn",
			"res://assets/player.scn"
		]
	var problem := preflight(paths)
	if not problem.is_empty():
		_finish_failure(problem)
		return
	var scene_path := GAME_SCENE if selected_spawn == "legacy" else "res://scenes/latest_world.tscn"
	var packed := load(scene_path) as PackedScene
	if packed == null:
		_finish_failure("Не удалось прочитать игровую сцену. Проверь вывод ошибок Godot.")
		return
	world = packed.instantiate() as Node3D
	if world == null or not world.has_signal("boot_completed"):
		_finish_failure("Игровой скрипт не загрузился. Проверь версию Godot и его журнал.")
		return
	if selected_spawn != "legacy":
		world.spawn_id = selected_spawn
	world.testing = testing
	world.boot_managed = true
	world.safe_boot = %SafeMode.button_pressed
	world.loading_stage.connect(_on_stage)
	world.boot_completed.connect(_on_boot_completed)
	world.main_menu_requested.connect(return_to_menu)
	world.quit_requested.connect(quit_application)
	get_tree().set_deferred("paused", false)
	add_child(world)


static func preflight(
	paths: Array[String] = ["res://assets/city.scn", "res://assets/player.scn"],
	manifest_path: String = "res://assets/baked-manifest.json"
) -> String:
	if not FileAccess.file_exists(manifest_path):
		return "Не найден манифест готовых моделей. Распакуй весь архив 05 в новую папку."
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
	if not parsed is Dictionary or not parsed.get("models") is Dictionary:
		return "Повреждён манифест готовых моделей. Скачай архив повторно."
	for path in paths:
		if not FileAccess.file_exists(path):
			return "Не найден " + path + ". Распакуй архив полностью в новую папку."
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			return "Нет доступа к модели: " + path
		if file.get_length() < 32:
			file.close()
			return "Повреждён заголовок модели: " + path
		var magic := file.get_buffer(4).get_string_from_ascii()
		var length := file.get_length()
		file.close()
		if magic not in ["RSCC", "RSRC"]:
			return "Повреждён нативный ресурс: " + path
		var expected: Variant = parsed.models.get(path)
		if not expected is Dictionary:
			return "Нет контрольной суммы модели: " + path
		if length != int(expected.get("bytes", -1)):
			return "Повреждён размер модели: " + path
		if FileAccess.get_sha256(path) != expected.get("sha256", ""):
			return "Повреждён файл модели (SHA-256): " + path + ". Скачай архив повторно."
	return ""


func _on_stage(text: String, ratio: float) -> void:
	if not busy:
		return
	stage_label.text = ("Отмена: " + text) if cancel_requested else text
	progress.value = clampf(ratio, 0, 1) * 100.0
	launch_log.mark("loading", text)


func cancel_loading() -> void:
	if not busy:
		return
	cancel_requested = true
	if is_instance_valid(world):
		world.cancel_loading = true
	if is_instance_valid(cancel_button):
		cancel_button.disabled = true
	if is_instance_valid(stage_label):
		stage_label.text = "Отмена после завершения текущего шага чтения…"


func _on_boot_completed(success: bool, message: String) -> void:
	# Do not remove a world while its _ready/physics callbacks are on the stack.
	if not success or cancel_requested:
		_finish_failure.call_deferred(message if not message.is_empty() else "Загрузка отменена.")
		return
	busy = false
	page = "game"
	%Overlay.hide()
	%MenuView.hide()
	world.hud.visible = true
	launch_log.mark("running", "Город готов")


func _finish_failure(message: String) -> void:
	busy = false
	last_error = message
	_release_world()
	launch_log.mark("failed", "Возврат в меню", message)
	_begin_panel("ЗАПУСК ОСТАНОВЛЕН", "error")
	_text(message, Color("ffc2b9"))
	_text("Главное меню остаётся доступным. Можно проверить настройки и повторить запуск.")
	_button("СОХРАНИТЬ / СКОПИРОВАТЬ ДИАГНОСТИКУ", export_diagnostics)


func return_to_menu() -> void:
	if busy:
		cancel_loading()
		return
	if is_instance_valid(world):
		world.save_session()
	_return_to_menu_deferred.call_deferred()


func _return_to_menu_deferred() -> void:
	_release_world()
	launch_log.mark("clean", "Главное меню")
	%MenuView.show()
	%Overlay.hide()
	page = "main"
	_reload_profile()
	if selected_spawn != "legacy" and not checkpoint.is_empty():
		selected_spawn = "continue"
	%Play.grab_focus()


func _release_world() -> void:
	get_tree().set_deferred("paused", false)
	if is_instance_valid(world):
		world.process_mode = Node.PROCESS_MODE_DISABLED
		world.queue_free()
	world = null
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func quit_application() -> void:
	if quitting:
		return
	quitting = true
	if is_instance_valid(world) and world.state_ready:
		world.save_session()
	launch_log.mark("clean", "Выход по запросу пользователя")
	get_tree().quit()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		quit_application()


func _unhandled_input(event: InputEvent) -> void:
	if page == "game" or not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.keycode == KEY_ESCAPE:
		if busy:
			cancel_loading()
		elif %Overlay.visible:
			close_panel()
		get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	if busy and not stalled and Time.get_ticks_msec() - load_started > 90000:
		stalled = true
		_text(
			(
				"Загрузка длится больше 90 секунд. Сохрани диагностику. "
				+ "Отмена дождётся завершения текущего шага; эта задержка не означает успешный запуск."
			),
			Color("ffc2b9")
		)


func show_destinations() -> void:
	if busy:
		return
	_begin_panel("КАРТЫ И СПАВНЫ", "destinations")
	_text("Последняя карта веб-версии. Выбери точку входа, затем нажми ИГРАТЬ.")
	var entries := {
		"sky": "Небесная площадь · спавн над облаками",
		"center": "Город v28 · площадь и GRAND MALL",
		"factory": "Промышленный район · Заводская",
		"park": "Парк · Парковая",
		"port": "Набережная · Портовая",
		"business": "Деловой район",
		"sea": "Морской район · гавань и остров",
		"continue": "Продолжить последнюю сессию v28",
		"legacy": "Карта проекта 04 · подъезд и лифт"
	}
	for id in entries:
		_button(
			entries[id],
			func():
				selected_spawn = id
				profile.path = (
					"user://prototype-profile.json"
					if id == "legacy"
					else "user://world05-profile.json"
				)
				_reload_profile()
				%Notice.text = "Точка входа: " + entries[id]
				%Play.text = "ИГРАТЬ  →"
				close_panel()
		)
