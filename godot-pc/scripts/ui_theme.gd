extends RefCounted
## Native equivalents of fz-lobby23.css / fz-neon.css. No browser or HTML runtime.
const BACKGROUND := Color("080e1c")
const PANEL := Color("18243d")
const TEXT := Color("f1f3ff")
const MUTED := Color("bdc9e5")
const VIOLET := Color("ab9fff")
const CYAN := Color("88d9ff")
const BORDER := Color("354366")
static var cached: Theme


static func panel(color: Color = PANEL, padding: int = 18, radius: int = 12) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = BORDER
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	style.content_margin_left = padding
	style.content_margin_right = padding
	style.content_margin_top = padding
	style.content_margin_bottom = padding
	return style


static func shared() -> Theme:
	if cached != null:
		return cached
	cached = Theme.new()
	cached.default_font_size = 17
	cached.set_color("font_color", "Label", TEXT)
	cached.set_color("font_color", "Button", TEXT)
	cached.set_color("font_hover_color", "Button", Color.WHITE)
	cached.set_color("font_pressed_color", "Button", Color.WHITE)
	cached.set_color("font_disabled_color", "Button", Color("7785a4"))
	cached.set_stylebox("normal", "Button", panel(PANEL, 16))
	cached.set_stylebox("hover", "Button", panel(Color("26365a"), 16))
	cached.set_stylebox("pressed", "Button", panel(Color("40326d"), 16))
	cached.set_stylebox("disabled", "Button", panel(Color("111a2b"), 16))
	var focus := panel(Color(0, 0, 0, 0), 0)
	focus.border_color = CYAN
	focus.set_border_width_all(2)
	cached.set_stylebox("focus", "Button", focus)
	cached.set_stylebox("panel", "PanelContainer", panel())
	cached.set_stylebox("panel", "TabContainer", panel(Color("101b30"), 8))
	cached.set_stylebox("tab_selected", "TabContainer", panel(Color("40326d"), 10, 8))
	cached.set_stylebox("tab_unselected", "TabContainer", panel(Color("101a2d"), 10, 8))
	cached.set_color("font_selected_color", "TabContainer", TEXT)
	cached.set_color("font_unselected_color", "TabContainer", MUTED)
	cached.set_stylebox("background", "ProgressBar", panel(Color("111a2b"), 0, 5))
	cached.set_stylebox("fill", "ProgressBar", panel(VIOLET, 0, 5))
	cached.set_color("font_color", "RichTextLabel", MUTED)
	cached.set_stylebox("panel", "PopupMenu", panel(Color("101b30"), 10))
	cached.set_stylebox("hover", "PopupMenu", panel(Color("40326d"), 8))
	cached.set_color("font_color", "PopupMenu", TEXT)
	cached.set_color("font_hover_color", "PopupMenu", Color.WHITE)
	cached.set_color("font_disabled_color", "PopupMenu", MUTED)
	cached.set_stylebox("panel", "TooltipPanel", panel(Color("101b30"), 10))
	cached.set_color("font_color", "TooltipLabel", TEXT)
	cached.set_color("font_color", "CheckButton", TEXT)
	cached.set_color("font_hover_color", "CheckButton", CYAN)
	var track := panel(Color("111a2b"), 0, 3)
	track.content_margin_top = 3
	track.content_margin_bottom = 3
	cached.set_stylebox("slider", "HSlider", track)
	cached.set_stylebox("grabber_area", "HSlider", panel(VIOLET, 0, 3))
	cached.set_stylebox("grabber_area_highlight", "HSlider", panel(CYAN, 0, 3))
	var separator := StyleBoxLine.new()
	separator.color = BORDER
	separator.thickness = 1
	cached.set_stylebox("separator", "HSeparator", separator)
	cached.set_type_variation("PrimaryButton", "Button")
	cached.set_stylebox("normal", "PrimaryButton", panel(Color("a99cff"), 20))
	cached.set_stylebox("hover", "PrimaryButton", panel(Color("71cfff"), 20))
	cached.set_stylebox("pressed", "PrimaryButton", panel(Color("8c80e0"), 20))
	for key in ["font_color", "font_hover_color", "font_pressed_color"]:
		cached.set_color(key, "PrimaryButton", Color("101a34"))
	cached.set_font_size("font_size", "PrimaryButton", 21)
	cached.set_type_variation("StoryPanel", "PanelContainer")
	cached.set_stylebox("panel", "StoryPanel", panel(Color("202c49"), 28, 28))
	return cached


static func primary(button: Button) -> void:
	button.theme_type_variation = "PrimaryButton"
	button.add_theme_stylebox_override("normal", panel(Color("a99cff"), 20))
	button.add_theme_stylebox_override("hover", panel(Color("71cfff"), 20))
	button.add_theme_stylebox_override("pressed", panel(Color("8c80e0"), 20))
	for key in ["font_color", "font_hover_color", "font_pressed_color"]:
		button.add_theme_color_override(key, Color("101a34"))
	button.add_theme_font_size_override("font_size", 21)
