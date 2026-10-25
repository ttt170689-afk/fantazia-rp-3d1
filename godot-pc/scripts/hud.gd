extends CanvasLayer
signal play_requested
signal pause_requested
signal restart_requested
signal sensitivity_changed(value: float)
signal option_changed(key: String, value: Variant)
signal save_requested
signal reset_requested
signal quit_requested
signal return_to_menu_requested
const Visuals = preload("res://scripts/ui_theme.gd")
const OptionsPanel = preload("res://scripts/options_panel.gd")

var options_panel: VBoxContainer
var tabs: TabContainer
var play_button: Button
var fatal_message: Label
var content: VBoxContainer

var menu: PanelContainer
var hint: Label
var status: Label
var stats: Label
var toast: Label
var toast_time: float = 0.0
var started: bool = false
var sensitivity_slider: HSlider
var initial_sensitivity: float = 0.0025
var debug_visible: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	root.theme = Visuals.shared()
	var bar := PanelContainer.new()
	root.add_child(bar)
	bar.position = Vector2(22, 18)
	bar.add_theme_stylebox_override("panel", _panel(Color("142031e8")))
	status = Label.new()
	status.text = "FANTAZIA RP  /  GODOT PC\nЛокальный прототип · город"
	status.add_theme_font_size_override("font_size", 16)
	bar.add_child(status)
	stats = Label.new()
	root.add_child(stats)
	stats.position = Vector2(22, 95)
	stats.visible = false
	hint = Label.new()
	root.add_child(hint)
	hint.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	hint.offset_left = -430
	hint.offset_right = 430
	hint.offset_top = -82
	hint.offset_bottom = -24
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	hint.add_theme_constant_override("shadow_offset_x", 2)
	hint.add_theme_constant_override("shadow_offset_y", 2)
	toast = Label.new()
	root.add_child(toast)
	toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	toast.offset_left = -420
	toast.offset_right = 420
	toast.offset_top = 112
	toast.offset_bottom = 205
	toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.add_theme_color_override("font_shadow_color", Color.BLACK)
	toast.add_theme_constant_override("shadow_offset_x", 2)
	toast.add_theme_constant_override("shadow_offset_y", 2)
	var crosshair := Label.new()
	root.add_child(crosshair)
	crosshair.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	crosshair.text = "·"
	crosshair.add_theme_font_size_override("font_size", 30)
	crosshair.offset_left = -5
	crosshair.offset_top = -18
	menu = PanelContainer.new()
	root.add_child(menu)
	menu.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	menu.offset_left = -280
	menu.offset_right = 280
	menu.offset_top = -300
	menu.offset_bottom = 300
	menu.add_theme_stylebox_override("panel", _panel(Color("131d2ff5"), 24))
	tabs = TabContainer.new()
	menu.add_child(tabs)
	var play_scroll := ScrollContainer.new()
	play_scroll.name = "Игра"
	play_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tabs.add_child(play_scroll)
	content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 12)
	play_scroll.add_child(content)
	var title := Label.new()
	title.text = "FANTAZIA RP"
	title.add_theme_font_size_override("font_size", 36)
	content.add_child(title)
	var caption := Label.new()
	caption.text = (
		"GODOT PC • ОБНОВЛЕНИЕ 04\n"
		+ "Город и персонаж из существующих GLB.\n"
		+ "Один подъезд, лестница, лифт и квартира.\n"
		+ "Без онлайна и аккаунтов. Это ещё не вся v28."
	)
	caption.add_theme_font_size_override("font_size", 16)
	content.add_child(caption)
	play_button = _button(content, "ИГРАТЬ / ПРОДОЛЖИТЬ", func(): play_requested.emit())
	Visuals.primary(play_button)
	_button(content, "Вернуться ко входу в дом", func(): restart_requested.emit())
	var controls := Label.new()
	controls.text = (
		"WASD / стрелки — ходьба    Shift — бег\n"
		+ "Мышь — камера    Колёсико — расстояние\n"
		+ "Space — прыжок    E — действие    Tab — выбор\n"
		+ "В лифте: 1 / 2 — этаж    F — свет    B — танец\n"
		+ "Esc — пауза    F3 — диагностика"
	)
	controls.add_theme_font_size_override("font_size", 16)
	content.add_child(controls)
	_button(content, "Настройки и маршрут", func(): tabs.current_tab = 1)
	_button(content, "ГЛАВНОЕ МЕНЮ", func(): return_to_menu_requested.emit())
	_button(content, "Выйти из игры", func(): quit_requested.emit())
	var option_scroll := ScrollContainer.new()
	option_scroll.name = "Настройки"
	option_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tabs.add_child(option_scroll)
	options_panel = OptionsPanel.new()
	options_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	option_scroll.add_child(options_panel)
	options_panel.option_changed.connect(
		func(key: String, value: Variant): option_changed.emit(key, value)
	)
	options_panel.save_requested.connect(func(): save_requested.emit())
	options_panel.reset_requested.connect(func(): reset_requested.emit())
	sensitivity_slider = options_panel.widgets.sensitivity
	fatal_message = Label.new()
	fatal_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	fatal_message.visible = false
	content.add_child(fatal_message)


func _button(parent: Node, text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 42
	button.pressed.connect(action)
	parent.add_child(button)
	return button


func _panel(color: Color, padding: int = 12) -> StyleBoxFlat:
	return Visuals.panel(color, padding)


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("guide"):
		pause_requested.emit()
		tabs.current_tab = 1
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("pause"):
		if menu.visible:
			play_requested.emit()
		else:
			pause_requested.emit()
		get_viewport().set_input_as_handled()
	if event.is_action_pressed("debug_stats"):
		debug_visible = not debug_visible
		stats.visible = debug_visible


func _process(delta: float) -> void:
	if not get_tree().paused:
		toast_time = maxf(0, toast_time - delta)
	toast.visible = toast_time > 0 and not menu.visible
	hint.visible = not menu.visible


func show_menu(show: bool) -> void:
	menu.visible = show
	if show:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		started = true
		if DisplayServer.get_name() != "headless":
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func message(text: String) -> void:
	toast.text = text
	toast_time = 7.0


func update_info(zone: String, prompt: String, position: Vector3, models: int) -> void:
	status.text = "FANTAZIA RP  /  GODOT PC\nЛокальный прототип · " + zone
	hint.text = prompt
	stats.text = (
		"FPS: %d   |   мешей города: %d\nX %.1f  Y %.1f  Z %.1f\nEsc — меню"
		% [Engine.get_frames_per_second(), models, position.x, position.y, position.z]
	)


func show_failure(text: String) -> void:
	show_menu(true)
	tabs.current_tab = 0
	play_button.disabled = true
	fatal_message.text = text + "\nРаспакуй архив 04 полностью в новую папку. Не смешивай его с 03."
	fatal_message.modulate = Color("ffc2b9")
	fatal_message.visible = true
	status.text = "FANTAZIA RP · Не удалось загрузить ресурсы"


func sync_options(values: Dictionary) -> void:
	options_panel.sync(values)


func save_report(text: String, success: bool = true) -> void:
	options_panel.report(text, success)
