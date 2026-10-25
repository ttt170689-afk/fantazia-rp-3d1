extends CharacterBody3D
const Assets = preload("res://scripts/assets.gd")

const WALK_SPEED: float = 4.2
const RUN_SPEED: float = 7.5
const GRAVITY: float = 20.0
const BODY_HEIGHT: float = 1.85
var sensitivity: float = 0.0025
var pivot: Node3D
var spring: SpringArm3D
var camera: Camera3D
var avatar: Node3D
var animator: AnimationPlayer
var flashlight: SpotLight3D
var dancing: bool = false
var current_clip: String = ""
var model_loaded: bool = false
var controls_enabled: bool = true
var invert_y: bool = false
var zoom_target: float = 5.0
var jump_buffer: float = 0.0
var coyote_time: float = 0.0


func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(50.0)
	floor_stop_on_slope = true
	# The lift explicitly carries its passenger, avoiding double platform motion.
	platform_floor_layers = 0
	platform_wall_layers = 0
	platform_on_leave = CharacterBody3D.PLATFORM_ON_LEAVE_DO_NOTHING
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.3
	capsule.height = BODY_HEIGHT
	var collision := CollisionShape3D.new()
	collision.shape = capsule
	collision.position.y = BODY_HEIGHT * 0.5
	add_child(collision)
	avatar = Assets.model("res://assets/player.scn")
	if avatar != null:
		model_loaded = true
		avatar.name = "OriginalGameplayAvatar"
		add_child(avatar)
		avatar.scale = Vector3.ONE * 0.66
		animator = Assets.animation_player(avatar)
		Assets.loop_animations(animator)
	else:
		push_error("The gameplay avatar is missing; no substitute mannequin was created.")
	pivot = Node3D.new()
	pivot.name = "CameraPivot"
	add_child(pivot)
	pivot.position.y = 1.5
	pivot.rotation.x = -0.18
	spring = SpringArm3D.new()
	spring.name = "WallSafeCamera"
	spring.spring_length = 5.0
	spring.margin = 0.15
	spring.collision_mask = 1
	var probe := SphereShape3D.new()
	probe.radius = 0.18
	spring.shape = probe
	pivot.add_child(spring)
	spring.add_excluded_object(get_rid())
	camera = Camera3D.new()
	camera.current = true
	camera.fov = 70.0
	camera.near = 0.08
	camera.far = 850.0
	spring.add_child(camera)
	flashlight = SpotLight3D.new()
	flashlight.name = "CameraFlashlight"
	flashlight.light_energy = 4.0
	flashlight.spot_range = 20.0
	flashlight.spot_angle = 35.0
	flashlight.visible = false
	pivot.add_child(flashlight)
	flashlight.position = Vector3(0.35, -0.25, -0.4)


func _unhandled_input(event: InputEvent) -> void:
	if not controls_enabled:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		look(event.relative)
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom_target = maxf(2.2, zoom_target - 0.4)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom_target = minf(8.0, zoom_target + 0.4)
	if event.is_action_pressed("flashlight"):
		flashlight.visible = not flashlight.visible
	if event.is_action_pressed("dance"):
		dancing = not dancing


func _physics_process(delta: float) -> void:
	spring.spring_length = move_toward(spring.spring_length, zoom_target, delta * 9.0)
	if avatar != null:
		avatar.visible = spring.get_hit_length() > 0.7
	jump_buffer = maxf(0, jump_buffer - delta)
	coyote_time = maxf(0, coyote_time - delta)
	if controls_enabled and Input.is_action_just_pressed("jump"):
		jump_buffer = 0.12
	if is_on_floor():
		coyote_time = 0.10
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	if not controls_enabled:
		input = Vector2.ZERO
	var basis_y := Basis(Vector3.UP, pivot.rotation.y)
	var direction := basis_y * Vector3(input.x, 0.0, input.y)
	var speed: float = RUN_SPEED if Input.is_action_pressed("run") else WALK_SPEED
	velocity.x = move_toward(velocity.x, direction.x * speed, 28.0 * delta)
	velocity.z = move_toward(velocity.z, direction.z * speed, 28.0 * delta)
	if is_on_floor():
		velocity.y = -0.15
	else:
		velocity.y -= GRAVITY * delta
	if controls_enabled and jump_buffer > 0 and coyote_time > 0:
		velocity.y = 6.0
		jump_buffer = 0.0
		coyote_time = 0.0
	# Step over small city kerbs. The test includes a ceiling probe and a landing
	# probe, so a blocked wall cannot be turned into a free upward teleport.
	var horizontal := Vector3(velocity.x, 0.0, velocity.z) * delta
	if is_on_floor() and horizontal.length() > 0.001 and test_move(global_transform, horizontal):
		_try_step(horizontal)
	move_and_slide()
	if direction.length() > 0.1:
		dancing = false
		if avatar != null:
			avatar.rotation.y = lerp_angle(
				avatar.rotation.y, atan2(direction.x, direction.z), minf(delta * 12.0, 1.0)
			)
	var clip := "ANIM_Idle_Loop"
	if not is_on_floor():
		clip = "ANIM_Jump"
	elif Vector2(get_real_velocity().x, get_real_velocity().z).length() > 0.3:
		clip = "ANIM_Run_Loop" if speed > WALK_SPEED else "ANIM_Walk_Loop"
	elif dancing:
		clip = "ANIM_Dance_Loop"
	_play(clip)


func _try_step(horizontal: Vector3) -> void:
	var rise := Vector3.UP * 0.24
	if test_move(global_transform, rise):
		return
	var raised := global_transform.translated(rise)
	if test_move(raised, horizontal * 2.0):
		return
	var landing := raised.translated(horizontal * 2.0)
	if not test_move(landing, Vector3.DOWN * 0.28):
		return
	global_position += rise


func _play(clip: String) -> void:
	if animator == null or clip == current_clip or not animator.has_animation(clip):
		return
	current_clip = clip
	animator.play(clip, 0.15)


func place(at: Vector3, yaw: float = 0.0) -> void:
	global_position = at
	stop_input()
	velocity = Vector3.ZERO
	dancing = false
	pivot.rotation = Vector3(-0.18, yaw, 0.0)
	if avatar != null:
		avatar.rotation.y = yaw + PI


func stop_input() -> void:
	velocity.x = 0.0
	velocity.z = 0.0
	jump_buffer = 0.0
	coyote_time = 0.0


func look(relative: Vector2) -> void:
	if not controls_enabled or not relative.is_finite():
		return
	pivot.rotation.y = wrapf(pivot.rotation.y - relative.x * sensitivity, -PI, PI)
	var sign_y := -1.0 if invert_y else 1.0
	pivot.rotation.x = clampf(pivot.rotation.x - relative.y * sensitivity * sign_y, -0.9, 0.6)
