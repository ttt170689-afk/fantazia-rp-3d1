extends Node3D
## Native walk-in metro. No entry/boarding teleport and no seating requirement.
const Kit = preload("res://scripts/kit.gd")
var stations: Array = []
var player: CharacterBody3D
var train: Node3D
var doors: Array[Node3D] = []
var gates: Array[Node3D] = []
var board: Label3D
var index := 0
var phase := "open"
var elapsed := 0.0
var door_open := 1.0
var moving_from := Vector3.ZERO
var moving_to := Vector3.ZERO
var paused_for_threshold := false


func _ready() -> void:
	for station in stations:
		_build_station(station)
	_build_train()
	# Keep train physics separate from stationary scenery during transit.
	for body in train.get_children():
		if body is StaticBody3D:
			body.collision_layer = 4
	player.collision_mask = 5


func stop_position(i: int) -> Vector3:
	return Vector3(stations[i].x, -8, stations[i].z + 45)


func _build_station(s: Dictionary) -> void:
	var root := Node3D.new()
	root.name = "Station_" + s.id
	add_child(root)
	root.position = Vector3(s.x, 0, s.z)
	var ramp = Kit.box(
		root,
		"WalkDown",
		Vector3(4.8, 0.25, sqrt(28 * 28 + 64)),
		Vector3(0, -4.1, 15),
		Color("a8acb7")
	)
	ramp.rotation.x = atan2(8.0, 28.0)
	for side in [-1, 1]:
		Kit.box(
			root, "StairWall", Vector3(0.3, 10, 28), Vector3(side * 2.6, -4, 15), Color("29384d")
		)
		for step in range(26):
			# Visual treads; the walkable ramp prevents capsule snagging.
			Kit.box(
				root,
				"Tread",
				Vector3(4.7, 0.04, 0.15),
				Vector3(0, -step * 8.0 / 26.0 - 0.08, 2 + step),
				Color("d7dbe4"),
				false
			)
	Kit.box(root, "Platform", Vector3(48, 0.4, 14), Vector3(0, -8.25, 35), Color("828b9c"))
	Kit.box(root, "BackWall", Vector3(48, 0.25, 0.4), Vector3(0, -4.5, 42), Color("26344b"))
	for side in [-1, 1]:
		Kit.box(
			root, "EndWall", Vector3(0.4, 3.5, 16), Vector3(side * 24, -6.5, 35), Color("26344b")
		)
		Kit.light(root, Vector3(side * 12, -5, 35), 1.3)
	Kit.label(root, s.name.to_upper(), Vector3(0, -5.6, 41.6), 48)
	Kit.label(root, "МЕТРО · " + s.name, Vector3(0, 2.2, 1), 34, true)
	Kit.label(root, "ВХОД ПЕШКОМ ↓", Vector3(0, 0.7, 3), 22, true)
	for x in [-8, 0, 8]:
		var gate = Kit.box(
			root, "PlatformGate", Vector3(1.8, 2.6, 0.16), Vector3(x, -6.7, 42.3), Color("80a8bf")
		)
		gate.set_meta("station", stations.find(s))
		gates.append(gate)
		Kit.box(root, "BoardingBridge", Vector3(2, 0.2, 2), Vector3(x, -8.1, 42.5), Color("c8bb77"))
	for span in [[-24.0, -8.9], [-7.1, -0.9], [0.9, 7.1], [8.9, 19.0], [21.0, 24.0]]:
		Kit.box(
			root,
			"PlatformRail",
			Vector3(span[1] - span[0], 2.6, 0.16),
			Vector3((span[0] + span[1]) / 2, -6.7, 42.3),
			Color("425a84")
		)
	# Physical escape steps, not a teleport, if the player jumps into the shallow pit.
	var escape = Kit.box(
		root, "PitReturnRamp", Vector3(2, 0.2, sqrt(10)), Vector3(20, -8.65, 43), Color("c8bb77")
	)
	escape.rotation.x = atan2(1.0, 3.0)
	for step in range(3):
		Kit.box(
			root,
			"PitReturnStep",
			Vector3(2, 0.35, 0.8),
			Vector3(20, -8.18 - step * 0.3, 42.5 + step * 0.7),
			Color("c8bb77"),
			false
		)
	Kit.label(root, "ВЫХОД ИЗ ПРИЯМКА ↑", Vector3(20, -6.6, 42), 18)
	# Track pit catches accidental falls; ordinary stairs return to platform level.
	Kit.box(root, "TrackBed", Vector3(54, 0.4, 8), Vector3(0, -9.2, 46), Color("30343d"))


func _build_train() -> void:
	train = Node3D.new()
	train.name = "MetroTrain"
	add_child(train)
	train.position = stop_position(0)
	train.rotation.y = PI
	Kit.box(train, "CarFloor", Vector3(24, 0.2, 4), Vector3(0, -0.1, 0), Color("565f74"))
	Kit.box(train, "Back", Vector3(24, 2.8, 0.15), Vector3(0, 1.4, -2), Color("425a84"))
	Kit.box(train, "Roof", Vector3(24, 0.2, 4), Vector3(0, 2.9, 0), Color("607fac"))
	for side in [-1, 1]:
		Kit.box(train, "End", Vector3(0.2, 2.8, 4), Vector3(side * 12, 1.4, 0), Color("425a84"))
	for segment in [[-12.0, -8.9], [-7.1, -0.9], [0.9, 7.1], [8.9, 12.0]]:
		Kit.box(
			train,
			"Front",
			Vector3(segment[1] - segment[0], 2.8, 0.15),
			Vector3((segment[0] + segment[1]) / 2, 1.4, 2),
			Color("425a84")
		)
	for x in [-8, 0, 8]:
		var door = Kit.box(
			train,
			"SlidingDoor",
			Vector3(1.8, 2.7, 0.18),
			Vector3(x + 1.8, 1.35, 2),
			Color("8ab8dd")
		)
		door.set_meta("center", float(x))
		doors.append(door)
		Kit.light(train, Vector3(x, 2.4, 0), 0.8)
	board = Kit.label(train, "", Vector3(0, 2.15, -1.85), 23)


func rider_inside() -> bool:
	if not is_instance_valid(player):
		return false
	var p := train.to_local(player.global_position)
	return absf(p.x) < 11.8 and absf(p.z) < 1.75 and p.y > -0.4 and p.y < 2.4


func threshold_occupied() -> bool:
	if not is_instance_valid(player):
		return false
	var p := train.to_local(player.global_position)
	return (
		p.y > -0.5
		and p.y < 2.6
		and absf(p.z - 2) < 0.65
		and [-8, 0, 8].any(func(x): return absf(p.x - x) < 1.3)
	)


func _physics_process(delta: float) -> void:
	elapsed += delta
	paused_for_threshold = false
	if phase == "open" and elapsed >= 14:
		phase = "closing"
		elapsed = 0
	elif phase == "closing":
		if threshold_occupied():
			paused_for_threshold = true
			door_open = move_toward(door_open, 1.0, delta * 2)
			elapsed = 0
		else:
			door_open = move_toward(door_open, 0, delta * 0.6)
			if door_open <= 0:
				phase = "travel"
				elapsed = 0
				moving_from = train.position
				moving_to = stop_position((index + 1) % stations.size())
	elif phase == "travel":
		var carry := rider_inside()
		player.collision_mask = 4 if carry else 5
		var old := train.position
		var ratio := clampf(elapsed / 12.0, 0, 1)
		train.position = moving_from.lerp(moving_to, smoothstep(0.0, 1.0, ratio))
		if carry:
			player.global_position += train.position - old
		if ratio >= 1:
			index = (index + 1) % stations.size()
			phase = "opening"
			elapsed = 0
	elif phase == "opening":
		door_open = move_toward(door_open, 1, delta * 0.6)
		if door_open >= 1:
			phase = "open"
			elapsed = 0
	if phase != "travel":
		player.collision_mask = 5
	for gate in gates:
		var closed: bool = gate.get_meta("station") != index or phase == "travel"
		gate.get_child(0).visible = closed
		gate.get_child(1).set_deferred("disabled", not closed)
	for door in doors:
		door.position.x = float(door.get_meta("center")) + door_open * 1.8
	board.text = (
		"КОЛЬЦЕВАЯ ЛИНИЯ\n"
		+ stations[index].name
		+ " → "
		+ stations[(index + 1) % stations.size()].name
	)
	if paused_for_threshold:
		board.text += "\nОСВОБОДИТЕ ДВЕРИ"
