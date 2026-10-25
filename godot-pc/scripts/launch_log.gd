extends RefCounted
## Local crash breadcrumbs only. No account data, uploads or machine/user names.
var path: String = "user://launch-state.json"
var enabled: bool = true
var state: String = "clean"
var stage: String = "Главное меню"
var last_error: String = ""


func previous_interrupted() -> bool:
	if not enabled or not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 8192:
		return false
	var parser := JSON.new()
	var result := parser.parse(file.get_as_text())
	file.close()
	if result != OK or not parser.data is Dictionary:
		return false
	var data: Dictionary = parser.data
	if data.get("stage") is String:
		stage = data.stage.left(200)
	if data.get("error") is String:
		last_error = data.error.left(800)
	if data.get("state") in ["loading", "running", "failed", "clean"]:
		state = data.state
	return state in ["loading", "running"]


func mark(next_state: String, next_stage: String, error: String = "") -> void:
	state = next_state
	stage = next_stage.left(200)
	last_error = error.left(800)
	if not enabled:
		return
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file != null:
		file.store_string(
			JSON.stringify(
				{"state": state, "stage": stage, "error": last_error, "version": "0.3.0"}
			)
		)
		file.flush()
		file.close()


func report() -> String:
	return (
		"Fantazia Godot PC 04\n"
		+ "Godot: "
		+ str(Engine.get_version_info().get("string", "unknown"))
		+ "\n"
		+ "OS: "
		+ OS.get_name()
		+ "\n"
		+ "Display: "
		+ DisplayServer.get_name()
		+ "\n"
		+ "Renderer setting: "
		+ str(ProjectSettings.get_setting("rendering/renderer/rendering_method"))
		+ "\n"
		+ "State: "
		+ state
		+ "\nStage: "
		+ stage
		+ "\nError: "
		+ last_error
		+ "\n"
		+ "No account or user-directory data included."
	)


func export_report() -> Error:
	if not enabled:
		return OK
	var file := FileAccess.open("user://diagnostics.txt", FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(report())
	file.flush()
	var error := file.get_error()
	file.close()
	return error
