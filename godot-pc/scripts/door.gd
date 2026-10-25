extends Node3D
const Kit = preload("res://scripts/kit.gd")

var title: String = "Дверь"
var radius: float = 2.5
var width: float = 1.7
var opened: bool = false
var locked: bool = false
var turn: float = 0.0
var target_turn: float = 0.0
var leaf: AnimatableBody3D
var obstructed: bool = false
var input_delay: float = 0.0


func _ready() -> void:
	add_to_group("interactable")
	leaf = AnimatableBody3D.new()
	leaf.name = "MovingDoor"
	leaf.sync_to_physics = false
	add_child(leaf)
	Kit.box(
		leaf,
		"Panel",
		Vector3(width, 2.55, 0.12),
		Vector3(width * 0.5, 1.275, 0),
		Color("795b4a"),
		false
	)
	Kit.collider(leaf, Vector3(width, 2.55, 0.12), Vector3(width * 0.5, 1.275, 0))
	Kit.box(
		leaf,
		"Handle",
		Vector3(0.10, 0.28, 0.22),
		Vector3(width - 0.2, 1.1, 0.03),
		Color("d1c9b7"),
		false
	)
	Kit.label(leaf, title, Vector3(width * 0.5, 1.95, 0.075), 24)


func _physics_process(delta: float) -> void:
	# Probe the next leaf pose expanded by the capsule radius, not the entire
	# circle around the hinge: a person in front can open a door swinging away.
	input_delay = maxf(0, input_delay - delta)
	obstructed = false
	var next_turn := move_toward(turn, target_turn, delta * 2.4)
	if not is_equal_approx(turn, target_turn):
		for actor in get_tree().get_nodes_in_group("player"):
			var local_point: Vector3 = to_local(actor.global_position)
			if local_point.y > -1.8 and local_point.y < 2.55:
				var relative := Basis(Vector3.UP, -next_turn) * local_point
				if relative.x > -0.38 and relative.x < width + 0.38 and absf(relative.z) < 0.42:
					obstructed = true
					return
	turn = next_turn
	leaf.rotation.y = turn


func get_prompt() -> String:
	if locked:
		return "Дверь занята"
	if obstructed:
		return "Освободи проход: " + title
	return ("Закрыть: " if opened else "Открыть: ") + title


func get_focus() -> Vector3:
	return leaf.to_global(Vector3(width * 0.5, 1.15, 0.0))


func interact() -> void:
	if locked or input_delay > 0:
		return
	input_delay = 0.25
	opened = not opened
	target_turn = deg_to_rad(105.0) if opened else 0.0
