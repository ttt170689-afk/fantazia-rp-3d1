extends SceneTree


## Maintainer tool: regenerates the editor-visible native theme from UI tokens.
func _initialize() -> void:
	var styles = load("res://scripts/ui_theme.gd")
	var result := ResourceSaver.save(styles.shared(), "res://ui/native_theme.tres")
	print("THEME_EXPORT ", result)
	quit(0 if result == OK else 1)
