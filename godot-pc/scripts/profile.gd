extends RefCounted
## Small, versioned, local-only save. No web accounts or tokens are read.
const VERSION: int = 1
const MAX_BYTES: int = 16384
const DEFAULTS: Dictionary = {
	"sensitivity": 0.0025,
	"fov": 70.0,
	"zoom": 5.0,
	"invert_y": false,
	"quality": 1,
	"fps_limit": 60,
}
var path: String = "user://prototype-profile.json"
var recovered: bool = false
var warning: String = ""


static func number(value: Variant, fallback: float, low: float, high: float) -> float:
	if not (value is float or value is int) or not is_finite(float(value)):
		return fallback
	return clampf(float(value), low, high)


static func settings(raw: Variant) -> Dictionary:
	var result: Dictionary = DEFAULTS.duplicate()
	if not raw is Dictionary:
		return result
	result.sensitivity = number(raw.get("sensitivity"), 0.0025, 0.001, 0.006)
	result.fov = number(raw.get("fov"), 70.0, 60.0, 95.0)
	result.zoom = number(raw.get("zoom"), 5.0, 2.2, 8.0)
	result.quality = int(number(raw.get("quality"), 1, 0, 2))
	var cap := int(number(raw.get("fps_limit"), 60, 0, 120))
	result.fps_limit = cap if cap in [0, 60, 120] else 60
	if raw.get("invert_y") is bool:
		result.invert_y = raw.invert_y
	return result


static func location(raw: Variant) -> Dictionary:
	if not raw is Dictionary or raw.get("zone") not in ["city", "residence", "v28"]:
		return {}
	var coords: Variant = raw.get("position")
	if not coords is Array or coords.size() != 3:
		return {}
	for component in coords:
		if not (component is float or component is int) or not is_finite(float(component)):
			return {}
	var point := Vector3(float(coords[0]), float(coords[1]), float(coords[2]))
	if raw.zone == "v28":
		if (
			point.x < -650
			or point.x > 6500
			or absf(point.z) > 1600
			or point.y < -15
			or point.y > 500
		):
			return {}
	elif raw.zone == "city":
		if absf(point.x) > 500 or absf(point.z) > 500 or point.y < -1 or point.y > 100:
			return {}
	else:
		if absf(point.x) > 7 or point.z < -9 or point.z > 11 or point.y < -40.5 or point.y > -35.5:
			return {}
	return {
		"zone": raw.zone,
		"position": [point.x, point.y, point.z],
		"yaw": number(raw.get("yaw"), 0, -TAU, TAU),
	}


func load_data() -> Dictionary:
	recovered = false
	warning = ""
	var raw := _read(path)
	if raw.is_empty():
		raw = _read(path + ".bak")
		if not raw.is_empty():
			recovered = true
			warning = "Загружена резервная копия сохранения."
		elif FileAccess.file_exists(path):
			warning = "Сохранение повреждено или несовместимо. Начало у дома; файлы не удалены."
	return {"settings": settings(raw.get("settings")), "location": location(raw.get("location"))}


func _read(filename: String) -> Dictionary:
	if not FileAccess.file_exists(filename):
		return {}
	var file := FileAccess.open(filename, FileAccess.READ)
	if file == null or file.get_length() > MAX_BYTES:
		return {}
	var text := file.get_as_text()
	file.close()
	var parser := JSON.new()
	if parser.parse(text) != OK:
		return {}
	var raw: Variant = parser.data
	if not raw is Dictionary or raw.get("version") != VERSION:
		return {}
	if not raw.get("settings") is Dictionary:
		return {}
	return raw


func save_data(options: Dictionary, checkpoint: Dictionary) -> Error:
	var payload := {
		"version": VERSION,
		"settings": settings(options),
		"location": location(checkpoint),
	}
	var temp := path + ".tmp"
	var file := FileAccess.open(temp, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(payload, "\t"))
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK:
		return error
	# Never replace a good backup with corrupt primary data.
	var good_primary := not _read(path).is_empty()
	if good_primary:
		error = DirAccess.rename_absolute(path, path + ".bak")
		if error != OK:
			return error
	elif FileAccess.file_exists(path):
		# Preserve one damaged file for inspection rather than silently deleting it.
		error = DirAccess.rename_absolute(path, path + ".damaged")
		if error != OK:
			return error
	error = DirAccess.rename_absolute(temp, path)
	if error != OK and good_primary:
		DirAccess.rename_absolute(path + ".bak", path)
	return error
