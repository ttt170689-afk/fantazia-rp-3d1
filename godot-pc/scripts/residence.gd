extends Node3D
signal leave_requested
signal notice(text: String)
const Kit = preload("res://scripts/kit.gd")
const Assets = preload("res://scripts/assets.gd")
const Door = preload("res://scripts/door.gd")
const Action = preload("res://scripts/interaction.gd")
const Lift = preload("res://scripts/lift.gd")

var lift: Node3D
var entry_door: Node3D
var apartment_door: Node3D
var stair_bottom := Vector3(5.15, 0.2, 7.0)
var stair_top := Vector3(5.15, 4.2, -7.2)
var concierge_loaded: bool = false
var apartment_light: OmniLight3D
var light_switch: Node3D
var apartment_lit: bool = true


func _ready() -> void:
	var wall := Color("d4d0c8")
	var floor_color := Color("687783")
	Kit.box(self, "GroundFloor", Vector3(14.0, 0.3, 20.0), Vector3(0, -0.15, 1), floor_color)
	# Four rectangles leave an actual hole for the lift; the right strip is
	# reserved for the stairs. No hidden upper slab blocks either route.
	_floor_rect(-7.0, -6.5, -9.0, 9.0)
	_floor_rect(-3.5, 3.8, -9.0, 9.0)
	_floor_rect(-6.5, -3.5, -9.0, 2.4)
	_floor_rect(-6.5, -3.5, 5.6, 9.0)
	_floor_rect(3.8, 7.0, -9.0, -6.0)
	Kit.box(self, "Roof", Vector3(14.0, 0.2, 18.0), Vector3(0, 7.8, 0), Color("ece7dc"))
	for x in [-7.0, 7.0]:
		Kit.box(self, "SideWall", Vector3(0.2, 7.8, 18.0), Vector3(x, 3.9, 0), wall)
	Kit.box(self, "BackWall", Vector3(14.0, 7.8, 0.2), Vector3(0, 3.9, -9.0), wall)
	# Front wall has a 1.9 metre gap with a physically rotating door.
	for x in [-3.975, 3.975]:
		Kit.box(self, "FrontWall", Vector3(6.05, 3.8, 0.2), Vector3(x, 1.9, 9.0), wall)
	Kit.box(self, "DoorLintel", Vector3(1.9, 1.15, 0.2), Vector3(0, 3.225, 9.0), wall)
	Kit.box(self, "UpperFront", Vector3(14, 3.8, 0.2), Vector3(0, 5.9, 9.0), wall)
	entry_door = Door.new()
	entry_door.title = "Выход"
	add_child(entry_door)
	entry_door.position = Vector3(-0.85, 0, 8.95)
	var exit_action := Action.new()
	exit_action.title = "Выйти в город"
	exit_action.radius = 1.4
	add_child(exit_action)
	exit_action.position = Vector3(0, 1.1, 10.5)
	exit_action.activated.connect(func(): leave_requested.emit())
	Kit.label(self, "В ГОРОД", Vector3(0, 2.9, 8.8), 30).rotation.y = PI
	_build_stairs()
	lift = Lift.new()
	add_child(lift)
	lift.position = Vector3(-5.0, 0.0, 4.0)
	lift.notice.connect(func(text: String): notice.emit(text))
	_build_apartment()
	_build_lobby()
	for y in [3.3, 7.0]:
		Kit.light(self, Vector3(0, y, 3.0), 1.1)
		var back_light := Kit.light(self, Vector3(0, y, -5.0), 1.0)
		if y > 6.0:
			apartment_light = back_light
		Kit.box(
			self,
			"CeilingLamp",
			Vector3(1.5, 0.08, 0.55),
			Vector3(0, y + 0.15, 3),
			Color("fff1d0"),
			false
		)
	Kit.label(self, "ДОМ РАССВЕТ\nЛЕСТНИЦА →", Vector3(0, 2.6, -8.86), 36)
	Kit.label(self, "2 ЭТАЖ · КВАРТИРА 201", Vector3(0, 6.5, 8.85), 30).rotation.y = PI


func _floor_rect(x0: float, x1: float, z0: float, z1: float) -> void:
	Kit.box(
		self,
		"UpperFloor",
		Vector3(x1 - x0, 0.22, z1 - z0),
		Vector3((x0 + x1) * 0.5, 3.89, (z0 + z1) * 0.5),
		Color("70818c")
	)


func _build_stairs() -> void:
	# Visible treads and a solid wedge collider: ordinary continuous movement,
	# not a teleport. This also avoids capsule jitter on individual riser edges.
	for i in range(24):
		var top: float = float(i + 1) / 6.0
		Kit.box(
			self,
			"Stair_%02d" % i,
			Vector3(2.6, top, 0.5),
			Vector3(5.15, top * 0.5, 5.75 - i * 0.5),
			Color("9ba4aa"),
			false
		)
	var ramp := StaticBody3D.new()
	ramp.name = "ContinuousStairCollider"
	add_child(ramp)
	var collision := CollisionShape3D.new()
	var shape := ConvexPolygonShape3D.new()
	shape.points = PackedVector3Array(
		[
			Vector3(3.85, 0, 6),
			Vector3(6.45, 0, 6),
			Vector3(3.85, 0, -6),
			Vector3(6.45, 0, -6),
			Vector3(3.85, 4, -6),
			Vector3(6.45, 4, -6)
		]
	)
	collision.shape = shape
	ramp.add_child(collision)
	for x in [3.75, 6.55]:
		var rail := Kit.box(
			self, "StairHandrail", Vector3(0.10, 0.12, 12.65), Vector3(x, 3.0, 0), Color("35485a")
		)
		rail.rotation.x = atan2(4.0, 12.0)
		for i in range(7):
			var z: float = 6.0 - i * 2.0
			Kit.box(
				self,
				"RailPost",
				Vector3(0.08, 1.0, 0.08),
				Vector3(x, float(i) * 4.0 / 6.0 + 0.5, z),
				Color("35485a")
			)
	# Guard the upper-floor edge alongside the stair opening.
	Kit.box(self, "LandingGuard", Vector3(0.1, 1.0, 12.0), Vector3(3.75, 4.5, 0.1), Color("596f80"))


func _build_apartment() -> void:
	# Apartment 201 occupies the upper back-left room. Its doorway is not
	# backed by a full-width collider; the rotating leaf is the only barrier.
	for rect in [[-7.0, -2.8], [-1.0, 2.0]]:
		Kit.box(
			self,
			"ApartmentPartition",
			Vector3(rect[1] - rect[0], 3.65, 0.15),
			Vector3((rect[0] + rect[1]) * 0.5, 5.825, -3.0),
			Color("c4c2bb")
		)
	Kit.box(
		self, "ApartmentHeader", Vector3(1.8, 1.05, 0.15), Vector3(-1.9, 7.125, -3), Color("c4c2bb")
	)
	Kit.box(
		self, "ApartmentSide", Vector3(0.15, 3.65, 6.0), Vector3(2.0, 5.825, -6.0), Color("c4c2bb")
	)
	apartment_door = Door.new()
	apartment_door.title = "Квартира 201"
	add_child(apartment_door)
	apartment_door.position = Vector3(-2.75, 4, -2.97)
	Kit.box(self, "Sofa", Vector3(2.8, 0.45, 1.0), Vector3(-4.7, 4.35, -7.7), Color("536881"))
	Kit.box(self, "SofaBack", Vector3(2.8, 0.7, 0.2), Vector3(-4.7, 4.9, -8.15), Color("536881"))
	Kit.box(self, "Table", Vector3(1.7, 0.65, 0.9), Vector3(-4.5, 4.325, -5.6), Color("ad8867"))
	Kit.box(self, "Bed", Vector3(1.8, 0.5, 3.0), Vector3(0.6, 4.25, -6.7), Color("afc1cc"))
	Kit.box(
		self, "Pillow", Vector3(1.5, 0.15, 0.65), Vector3(0.6, 4.6, -7.7), Color("ede6dc"), false
	)
	Kit.label(self, "201", Vector3(-1.9, 6.8, -2.8), 40)

	light_switch = Action.new()
	light_switch.title = "Выключить свет в квартире"
	light_switch.radius = 1.8
	add_child(light_switch)
	light_switch.position = Vector3(-0.7, 5.1, -3.22)
	light_switch.activated.connect(toggle_apartment_light)
	Kit.box(
		self,
		"ApartmentLightSwitch",
		Vector3(0.2, 0.3, 0.1),
		Vector3(-0.7, 5.1, -3.12),
		Color("e8e3d8"),
		false
	)


func _build_lobby() -> void:
	Kit.box(
		self, "ConciergeDesk", Vector3(3.0, 1.1, 0.9), Vector3(-0.8, 0.55, 2.1), Color("947556")
	)
	Kit.label(self, "КОНСЬЕРЖ", Vector3(-0.8, 0.8, 2.58), 24)
	var person := Assets.model("res://assets/player.scn")
	if person != null:
		concierge_loaded = true
		add_child(person)
		person.name = "ConciergeGameplayGLB"
		person.position = Vector3(-0.8, 0, 1.2)
		person.scale = Vector3.ONE * 0.66
		var body := StaticBody3D.new()
		body.name = "ConciergeCollision"
		add_child(body)
		body.position = Vector3(-0.8, 0, 1.2)
		var shape := CapsuleShape3D.new()
		shape.radius = 0.3
		shape.height = 1.75
		var collision := CollisionShape3D.new()
		collision.shape = shape
		collision.position.y = 0.875
		body.add_child(collision)
		var animator := Assets.animation_player(person)
		Assets.loop_animations(animator)
		if animator != null and animator.has_animation("ANIM_Idle_Loop"):
			animator.play("ANIM_Idle_Loop")
	var talk := Action.new()
	talk.title = "Поговорить с консьержем"
	add_child(talk)
	talk.position = Vector3(-0.8, 1.3, 2.8)
	talk.activated.connect(
		func():
			(
				notice
				. emit(
					"Добро пожаловать! Квартира 201 наверху. Справа лестница, слева лифт. В кабине: 1 / 2."
				)
			)
	)
	for i in range(6):
		Kit.box(
			self,
			"Mailbox",
			Vector3(0.55, 0.42, 0.2),
			Vector3(-6.7, 1.1 + (i / 3) * 0.5, -1.5 - (i % 3) * 0.7),
			Color("536a7c")
		)
	Kit.box(self, "Bin", Vector3(0.55, 0.75, 0.55), Vector3(2.6, 0.375, 7.8), Color("4b6464"))
	Kit.box(self, "Bench", Vector3(2.2, 0.45, 0.65), Vector3(1.5, 0.225, -7.6), Color("9f805f"))


func toggle_apartment_light() -> void:
	apartment_lit = not apartment_lit
	apartment_light.visible = apartment_lit
	light_switch.title = (
		"Выключить свет в квартире" if apartment_lit else "Включить свет в квартире"
	)
	notice.emit(
		"Свет в квартире включён." if apartment_lit else "Свет выключен. F — личный фонарь."
	)
