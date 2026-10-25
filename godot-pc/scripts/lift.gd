extends Node3D
signal notice(text: String)
const Kit = preload("res://scripts/kit.gd")
const Action = preload("res://scripts/interaction.gd")

const FLOOR_HEIGHT: float = 4.0
const SPEED: float = 1.6
var height: float = 0.0
var target_height: float = 0.0
var phase: String = "open"
var door_progress: float = 1.0
var cabin: AnimatableBody3D
var gates: Array[AnimatableBody3D] = []
var cabin_gate: AnimatableBody3D
var buttons: Array[Node3D] = []
var player: CharacterBody3D
var floor_display: Label3D
var pending_floor: int = -1
var boarding_time: float = 0.0
var indicators: Array[Label3D] = []
var last_status: String = ""


func _ready() -> void:
	name = "TwoFloorLift"
	# Closed shaft; the only way in or out is through the landing gate.
	Kit.box(self, "ShaftBack", Vector3(3.0, 7.1, 0.2), Vector3(0, 3.45, -1.5), Color("414d62"))
	for x in [-1.5, 1.5]:
		Kit.box(self, "ShaftSide", Vector3(0.2, 7.1, 3.0), Vector3(x, 3.45, 0), Color("414d62"))
	cabin = AnimatableBody3D.new()
	cabin.name = "MovingCabin"
	cabin.sync_to_physics = false
	add_child(cabin)
	Kit.box(
		cabin, "FloorVisual", Vector3(2.8, 0.16, 2.8), Vector3(0, -0.08, 0), Color("8b96a5"), false
	)
	Kit.collider(cabin, Vector3(2.8, 0.16, 2.8), Vector3(0, -0.08, 0))
	Kit.box(
		cabin, "CeilingVisual", Vector3(2.8, 0.12, 2.8), Vector3(0, 2.8, 0), Color("bdc6d1"), false
	)
	Kit.collider(cabin, Vector3(2.8, 0.12, 2.8), Vector3(0, 2.8, 0))
	for x in [-1.35, 1.35]:
		Kit.box(
			cabin, "WallVisual", Vector3(0.1, 2.8, 2.8), Vector3(x, 1.4, 0), Color("929dab"), false
		)
		Kit.collider(cabin, Vector3(0.1, 2.8, 2.8), Vector3(x, 1.4, 0))
	Kit.box(
		cabin, "BackVisual", Vector3(2.7, 2.8, 0.1), Vector3(0, 1.4, -1.35), Color("acb6c4"), false
	)
	Kit.collider(cabin, Vector3(2.7, 2.8, 0.1), Vector3(0, 1.4, -1.35))
	cabin_gate = _gate(cabin, Vector3(0, 0, 1.32))
	Kit.light(cabin, Vector3(0, 2.4, 0), 0.65)
	floor_display = Kit.label(cabin, "ЭТАЖ 1", Vector3(0, 2.1, -1.28), 24)
	for floor_index in range(2):
		var gate := _gate(self, Vector3(0, floor_index * FLOOR_HEIGHT, 1.51))
		gates.append(gate)
		var action := Action.new()
		action.title = "Вызвать лифт • этаж %d" % (floor_index + 1)
		action.radius = 2.2
		add_child(action)
		action.position = Vector3(1.8, floor_index * FLOOR_HEIGHT + 1.15, 1.65)
		action.activated.connect(request_floor.bind(floor_index))
		buttons.append(action)
		Kit.box(
			self, "CallButton", Vector3(0.22, 0.35, 0.14), action.position, Color("91b9f4"), false
		)
		var indicator := Kit.label(
			self, "ЛИФТ", Vector3(0, floor_index * FLOOR_HEIGHT + 3.0, 1.65), 26
		)
		indicators.append(indicator)
		var inside := Action.new()
		inside.title = "Лифт: на этаж %d" % (floor_index + 1)
		inside.radius = 2.0
		cabin.add_child(inside)
		inside.position = Vector3(0.65, 1.1 + floor_index * 0.38, -1.22)
		inside.activated.connect(request_floor.bind(floor_index))
		buttons.append(inside)
		Kit.label(cabin, str(floor_index + 1), inside.position + Vector3(0, 0, 0.02), 22)
	_refresh_gates()


func _gate(parent: Node3D, at: Vector3) -> AnimatableBody3D:
	var result := AnimatableBody3D.new()
	result.name = "SafetyGate"
	result.sync_to_physics = false
	parent.add_child(result)
	result.position = at
	Kit.box(
		result, "SteelDoor", Vector3(2.7, 2.7, 0.08), Vector3(0, 1.35, 0), Color("65758c"), false
	)
	Kit.collider(result, Vector3(2.7, 2.7, 0.08), Vector3(0, 1.35, 0))
	return result


func request_floor(floor_index: int) -> void:
	if floor_index < 0 or floor_index > 1:
		return
	if phase != "open":
		if floor_index == roundi(target_height / FLOOR_HEIGHT):
			notice.emit("Лифт уже следует на этот этаж.")
		else:
			pending_floor = floor_index
			notice.emit("Вызов сохранён: этаж %d. Сначала высадка пассажира." % (floor_index + 1))
		return
	var destination: float = floor_index * FLOOR_HEIGHT
	if is_equal_approx(height, destination):
		notice.emit("Лифт уже на этом этаже. Двери открыты.")
		return
	if _threshold_occupied():
		notice.emit("Освободи порог: зайди в кабину полностью или отойди.")
		return
	if pending_floor == floor_index:
		pending_floor = -1
	target_height = destination
	phase = "closing"
	notice.emit("Двери закрываются. Этаж %d." % (floor_index + 1))


func _threshold_occupied() -> bool:
	if not is_instance_valid(player):
		return false
	var p := to_local(player.global_position)
	return absf(p.x) < 1.7 and absf(p.z - 1.45) < 0.6 and absf(p.y - height) < 2.6


func _rider_inside() -> bool:
	if not is_instance_valid(player):
		return false
	var p := to_local(player.global_position)
	return (
		absf(p.x) < 1.25
		and p.z > -1.25
		and p.z < 1.1
		and p.y >= height - 0.25
		and p.y < height + 2.5
	)


func _physics_process(delta: float) -> void:
	if phase == "closing":
		if _threshold_occupied():
			pending_floor = roundi(target_height / FLOOR_HEIGHT)
			phase = "opening"
			target_height = height
		else:
			door_progress = move_toward(door_progress, 0.0, delta * 1.8)
			if door_progress <= 0.0:
				phase = "moving"
	elif phase == "moving":
		var carry := _rider_inside()
		var previous := height
		height = move_toward(height, target_height, SPEED * delta)
		cabin.position.y = height
		if carry:
			player.global_position.y += height - previous
		if is_equal_approx(height, target_height):
			phase = "opening"
			floor_display.text = "ЭТАЖ %d" % (roundi(height / FLOOR_HEIGHT) + 1)
	elif phase == "opening":
		door_progress = move_toward(door_progress, 1.0, delta * 1.8)
		if door_progress >= 1.0:
			phase = "open"
			boarding_time = 2.0
	elif phase == "open":
		boarding_time = maxf(0.0, boarding_time - delta)
		if pending_floor >= 0 and boarding_time <= 0.0 and not _threshold_occupied():
			var next_floor := pending_floor
			pending_floor = -1
			request_floor(next_floor)
	_refresh_gates()
	_update_indicators()


func _refresh_gates() -> void:
	# Visual slides and collision use the same offset, including the cabin gate.
	cabin_gate.position.x = -2.9 * door_progress
	for i in range(gates.size()):
		var at_landing := absf(height - i * FLOOR_HEIGHT) < 0.015 and phase != "moving"
		gates[i].position.x = -2.9 * door_progress if at_landing else 0.0


func status_text() -> String:
	if phase == "moving":
		var arrow := "↑" if target_height > height else "↓"
		return "%s НА ЭТАЖ %d" % [arrow, roundi(target_height / FLOOR_HEIGHT) + 1]
	if phase == "closing":
		return "ДВЕРИ ЗАКРЫВАЮТСЯ"
	if phase == "opening":
		return "ДВЕРИ ОТКРЫВАЮТСЯ"
	if pending_floor >= 0:
		return "ВЫСАДКА • ДАЛЕЕ %d" % (pending_floor + 1)
	return "ЭТАЖ %d • ОТКРЫТО" % (roundi(height / FLOOR_HEIGHT) + 1)


func _update_indicators() -> void:
	var text := status_text()
	if text == last_status:
		return
	last_status = text
	floor_display.font_size = 18
	floor_display.text = text
	for indicator in indicators:
		indicator.text = text
