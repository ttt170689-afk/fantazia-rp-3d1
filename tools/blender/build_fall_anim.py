"""
Fantazia RP 3D: клип «падение в дыру» на скелете модели игрока.

Запуск (Blender 4.x, фоном, на вашем компьютере):
    blender -b --python tools/blender/build_fall_anim.py

Что делает:
  1. Импортирует public/exports/player_super.glb (скелет Fantazia_Player_Rig — та же модель игрока).
  2. Строит клип FALL_INTO_HOLE на тех же костях, что и рига игры:
       бег к краю → прыжок → падение (руки машут, тело прогнуто) →
       приземление в присед → подъём.
  3. Экспортирует ТОЛЬКО скелет с клипом в public/exports/player_fall.glb (без мешей).

Соглашения осей (как в build_hold_anims.py): лицо персонажа смотрит в -Y,
рука вперёд = +X, у правой руки Z > 0 — приведение к телу, Z < 0 — наружу.
Сгиб колена назад — отрицательный X у кости колена.

ВАЖНО: это базовый вариант. Качество дорабатывается правкой ключей ниже
(и добавлением ключей, если нужна более плавная картинка).
"""
import bpy
import math
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(REPO, 'public', 'exports', 'player_super.glb')
OUT = os.path.join(REPO, 'public', 'exports', 'player_fall.glb')
FPS = 24

ALL_BONES = [
    'hips', 'spine', 'head',
    'leftArm', 'leftElbow', 'leftHand', 'rightArm', 'rightElbow', 'rightHand',
    'leftLeg', 'leftKnee', 'leftFoot', 'rightLeg', 'rightKnee', 'rightFoot',
    'fingerR1', 'fingerR2', 'fingerR3', 'fingerR4', 'thumbR',
    'fingerL1', 'fingerL2', 'fingerL3', 'fingerL4', 'thumbL',
]

# ---------- позы (градусы, XYZ, локальные оси кости) ----------
RUN_A = {'spine': [14, 0, 0], 'leftArm': [40, 0, 0], 'leftElbow': [70, 0, 0],
         'rightArm': [-30, 0, 0], 'rightElbow': [40, 0, 0],
         'leftLeg': [-25, 0, 0], 'leftKnee': [-40, 0, 0], 'rightLeg': [30, 0, 0], 'rightKnee': [-10, 0, 0]}
RUN_B = {'spine': [14, 0, 0], 'leftArm': [-30, 0, 0], 'leftElbow': [40, 0, 0],
         'rightArm': [40, 0, 0], 'rightElbow': [70, 0, 0],
         'leftLeg': [30, 0, 0], 'leftKnee': [-10, 0, 0], 'rightLeg': [-25, 0, 0], 'rightKnee': [-40, 0, 0]}
EDGE = {'spine': [10, 0, 0], 'leftArm': [-20, 0, 0], 'rightArm': [-20, 0, 0],
        'leftElbow': [30, 0, 0], 'rightElbow': [30, 0, 0], 'leftLeg': [10, 0, 0], 'rightLeg': [-10, 0, 0]}
JUMP_UP = {'spine': [-6, 0, 0], 'leftArm': [150, 0, 20], 'leftElbow': [10, 0, 0],
           'rightArm': [150, 0, -20], 'rightElbow': [10, 0, 0],
           'leftLeg': [-10, 0, 0], 'rightLeg': [-10, 0, 0]}
FALL_A = {'spine': [-12, 0, 0], 'head': [-10, 0, 0],
          'leftArm': [95, 0, 70], 'leftElbow': [20, 0, 0], 'rightArm': [95, 0, -70], 'rightElbow': [20, 0, 0],
          'leftLeg': [40, 0, 0], 'leftKnee': [-70, 0, 0], 'rightLeg': [40, 0, 0], 'rightKnee': [-70, 0, 0]}
FALL_B = {'spine': [-16, 0, 0], 'head': [-14, 0, 0],
          'leftArm': [140, 0, 40], 'leftElbow': [40, 0, 0], 'rightArm': [60, 0, -50], 'rightElbow': [60, 0, 0],
          'leftLeg': [30, 0, 0], 'leftKnee': [-60, 0, 0], 'rightLeg': [50, 0, 0], 'rightKnee': [-80, 0, 0]}
LAND = {'spine': [34, 0, 0], 'head': [-20, 0, 0],
        'leftArm': [55, 0, 10], 'leftElbow': [60, 0, 0], 'rightArm': [55, 0, -10], 'rightElbow': [60, 0, 0],
        'leftLeg': [70, 0, 0], 'leftKnee': [-100, 0, 0], 'rightLeg': [70, 0, 0], 'rightKnee': [-100, 0, 0]}
RISE = {'spine': [6, 0, 0], 'leftArm': [25, 0, 8], 'rightArm': [25, 0, -8],
        'leftElbow': [20, 0, 0], 'rightElbow': [20, 0, 0]}


def build_action(rig, name, keys):
    """keys: [(time_s, {bone: [x,y,z]}, hips_z или None)]. Ключи во всех костях, Безье с авто-сглаживанием."""
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    for bn in ALL_BONES:
        rig.pose.bones[bn].rotation_mode = 'XYZ'
    for t, vals, hz in keys:
        f = round(t * FPS) + 1
        for bn in ALL_BONES:
            pb = rig.pose.bones[bn]
            e = vals.get(bn, [0, 0, 0])
            pb.rotation_euler = [math.radians(v) for v in e]
            pb.keyframe_insert('rotation_euler', frame=f)
        hips = rig.pose.bones['hips']
        hips.location = (0.0, 0.0, hz if hz is not None else 0.0)
        hips.keyframe_insert('location', frame=f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
    act.use_fake_user = True
    rig.animation_data.action = None
    return act


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    rig = bpy.data.objects['Fantazia_Player_Rig']
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)

    # таймлайн (сек): бег 0–0.9, край 0.9–1.1, прыжок 1.1–1.5, падение 1.5–2.6, приземление 2.6–3.0, подъём 3.0–3.6
    build_action(rig, 'FALL_INTO_HOLE', [
        (0.00, RUN_A, 0.0),
        (0.22, RUN_B, 0.02),
        (0.44, RUN_A, 0.0),
        (0.66, RUN_B, 0.02),
        (0.90, EDGE, -0.04),
        (1.10, EDGE, 0.05),
        (1.50, JUMP_UP, 0.12),
        (1.90, FALL_A, 0.0),
        (2.25, FALL_B, -0.05),
        (2.60, FALL_A, -0.1),
        (3.00, LAND, -0.28),
        (3.60, RISE, 0.0),
    ])

    # --- экспорт только скелета с клипом ---
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.context.scene.render.fps = FPS
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_skins=False,
        export_yup=True,
    )
    print('EXPORTED', OUT, os.path.getsize(OUT))
    print('CLIPS', [a.name for a in bpy.data.actions])


if __name__ == '__main__':
    main()
