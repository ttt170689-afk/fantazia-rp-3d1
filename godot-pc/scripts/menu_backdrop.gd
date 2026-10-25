extends Control
## Lightweight decorative 2D skyline; explicitly not a screenshot of the game.
## No GLB, Camera3D, shader, SubViewport or world allocation on the title screen.


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("080e1c"))
	var horizon := size.y * 0.88
	for i in range(22):
		var width := size.x / 20.0
		var height := 35.0 + float((i * 73 + 41) % 155)
		var x := i * width - width * 0.5
		var color := Color("101a30") if i % 2 == 0 else Color("121d36")
		draw_rect(Rect2(x, horizon - height, width * 0.86, height), color)
		for row in range(int(height / 22.0) - 1):
			for column in range(2):
				if (row + i + column) % 3 == 0:
					draw_rect(
						Rect2(x + 10 + column * 16, horizon - height + 12 + row * 22, 5, 7),
						Color("25365a")
					)
	draw_line(Vector2(0, horizon), Vector2(size.x, horizon), Color("263555"), 1.0)
	draw_line(Vector2(size.x * 0.48, 0), Vector2(size.x * 0.81, size.y), Color("15213a"), 2.0)
