extends VBoxContainer
## Native settings/guide panel. Changes are applied through the world, not globals.
signal option_changed(key: String, value: Variant)
signal save_requested
signal reset_requested
const Profile = preload("res://scripts/profile.gd")
var widgets: Dictionary = {}
var save_status: Label
var route_status: Label
var syncing: bool = false


func _ready() -> void:
	add_theme_constant_override("separation", 10)
	_slider("Чувствительность мыши", "sensitivity", 0.001, 0.006, 0.0001)
	_slider("Поле зрения", "fov", 60, 95, 1)
	_slider("Расстояние камеры", "zoom", 2.2, 8.0, 0.2)
	var invert := CheckButton.new()
	invert.text = "Инвертировать вертикальную ось мыши"
	invert.toggled.connect(func(value: bool): _emit("invert_y", value))
	add_child(invert)
	widgets.invert_y = invert
	_choice("Графика", "quality", ["Низкая", "Средняя", "Высокая"], [0, 1, 2])
	_choice("Ограничение FPS", "fps_limit", ["60", "120", "Без ограничения"], [60, 120, 0])
	var note := Label.new()
	note.text = "Качество меняет тени, MSAA и дальность камеры.\nПрирост FPS зависит от компьютера."
	note.add_theme_font_size_override("font_size", 14)
	add_child(note)
	var buttons := HBoxContainer.new()
	add_child(buttons)
	var save := Button.new()
	save.text = "Сохранить сейчас"
	save.pressed.connect(func(): save_requested.emit())
	buttons.add_child(save)
	var reset := Button.new()
	reset.text = "Сбросить настройки"
	reset.pressed.connect(func(): reset_requested.emit())
	buttons.add_child(reset)
	save_status = Label.new()
	save_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	save_status.custom_minimum_size.x = 440
	save_status.add_theme_font_size_override("font_size", 14)
	add_child(save_status)
	route_status = Label.new()
	route_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	route_status.add_theme_font_size_override("font_size", 15)
	route_status.text = (
		"МАРШРУТ ДЛЯ ПРОВЕРКИ\n"
		+ "1. Подойди к метке дома и нажми E.\n"
		+ "2. Справа поднимись по лестнице, обойди ограждение.\n"
		+ "3. Открой квартиру 201. Лифт слева от холла.\n"
		+ "4. В кабине 1 / 2 выбирают этаж.\n"
		+ "5. Открой дверь выхода, пройди и нажми E.\n\n"
		+ "F1 — это меню, F5 — быстрое сохранение внутри игры.\n"
		+ "Если дверь остановилась, освободи её проход."
	)
	add_child(route_status)


func _slider(title: String, key: String, low: float, high: float, step: float) -> void:
	var caption := Label.new()
	caption.text = title
	caption.add_theme_font_size_override("font_size", 15)
	add_child(caption)
	var slider := HSlider.new()
	slider.min_value = low
	slider.max_value = high
	slider.step = step
	slider.value_changed.connect(func(value: float): _emit(key, value))
	add_child(slider)
	widgets[key] = slider


func _choice(title: String, key: String, labels: Array, values: Array) -> void:
	var row := HBoxContainer.new()
	var caption := Label.new()
	caption.text = title
	caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(caption)
	var choice := OptionButton.new()
	for i in range(labels.size()):
		choice.add_item(labels[i], values[i])
	choice.item_selected.connect(func(index: int): _emit(key, choice.get_item_id(index)))
	row.add_child(choice)
	add_child(row)
	widgets[key] = choice


func _emit(key: String, value: Variant) -> void:
	if not syncing:
		option_changed.emit(key, value)


func sync(options: Dictionary) -> void:
	syncing = true
	var clean := Profile.settings(options)
	for key in widgets:
		var widget: Control = widgets[key]
		if widget is HSlider:
			widget.set_value_no_signal(clean[key])
		elif widget is CheckButton:
			widget.set_pressed_no_signal(clean[key])
		elif widget is OptionButton:
			widget.select(widget.get_item_index(clean[key]))
	syncing = false


func report(text: String, success: bool = true) -> void:
	save_status.text = text
	save_status.modulate = Color("b8d7c7") if success else Color("ffc2b9")
