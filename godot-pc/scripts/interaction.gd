extends Node3D
signal activated

var title: String = "Взаимодействовать"
var radius: float = 2.5
var enabled: bool = true
var cooldown: float = 0.0


func _ready() -> void:
	add_to_group("interactable")


func get_prompt() -> String:
	return title if enabled else ""


func get_focus() -> Vector3:
	return global_position


func interact() -> void:
	if enabled and cooldown <= 0.0:
		cooldown = 0.25
		activated.emit()


func _physics_process(delta: float) -> void:
	cooldown = maxf(0, cooldown - delta)
