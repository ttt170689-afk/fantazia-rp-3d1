"""
Fantazia RP 3D: клипы «держит фонарик / меч» и «подбирает фонарик / меч».

Запуск (Blender 4.x, фоном):
    blender -b --python tools/blender/build_hold_anims.py

Что делает:
  1. Импортирует public/exports/player_super.glb (скелет Fantazia_Player_Rig).
  2. Удаляет из сессии исходные клипы (в результат они не нужны).
  3. Строит 4 клипа на тех же костях, что и рига игры (поворот Эйлера XYZ
     в локальной системе кости, ключи во всех костях, сглаживание auto-clamped).
  4. Экспортирует ТОЛЬКО скелет с клипами в public/exports/player_hold.glb
     (без мешей: меши остаются от player_super.glb).

Соглашения осей (проверено рендером):
  * лицо персонажа смотрит в -Y; рука вперёд = +X у любого плеча;
  * у правой руки Z > 0 — приведение к телу, Z < 0 — отведение наружу;
    у левой руки знак обратный;
  * сгиб колена назад — отрицательный X у кости колена.
"""
import bpy
import math
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(REPO, 'public', 'exports', 'player_super.glb')
OUT = os.path.join(REPO, 'public', 'exports', 'player_hold.glb')
FPS = 24

# ---------- позы (градусы, XYZ, локальные оси кости) ----------
# Порядок ключей важен только для читаемости. Не указанные кости = 0 (покой).
HOLD_FLASH = {
    'rightArm': [70, 0, 8], 'rightElbow': [15, 0, 0], 'rightHand': [-10, 0, 0],
    'leftArm': [60, 0, -25], 'leftElbow': [100, 0, 0], 'leftHand': [0, 0, 0],
    'spine': [6, 0, 0],
}
HOLD_SWORD = {
    'rightArm': [30, 0, -5], 'rightElbow': [75, 0, 0], 'rightHand': [10, 0, 0],
    'leftArm': [35, 0, 10], 'leftElbow': [50, 0, 0],
    'spine': [4, 0, 0],
}
FINGERS_R = ['fingerR1', 'fingerR2', 'fingerR3', 'fingerR4', 'thumbR']
FINGERS_L = ['fingerL1', 'fingerL2', 'fingerL3', 'fingerL4', 'thumbL']


def pose(base, **over):
    d = dict(base)
    d.update(over)
    return d


def grip(on):
    """Пальцы правой руки: 0 — разжаты, ~1 — в кулаке."""
    return {n: [(70 if n != 'thumbR' else 25) * on, 0, 0] for n in FINGERS_R}


def legs(bend):
    """bend 0..1: приседание/наклон для подбора."""
    return {
        'leftLeg': [45 * bend, 0, 0], 'leftKnee': [-55 * bend, 0, 0],
        'rightLeg': [45 * bend, 0, 0], 'rightKnee': [-55 * bend, 0, 0],
    }


def merged(*ds):
    out = {}
    for d in ds:
        out.update(d)
    return out


ALL_BONES = [
    'hips', 'spine', 'head',
    'leftArm', 'leftElbow', 'leftHand', 'rightArm', 'rightElbow', 'rightHand',
    'leftLeg', 'leftKnee', 'leftFoot', 'rightLeg', 'rightKnee', 'rightFoot',
    'fingerR1', 'fingerR2', 'fingerR3', 'fingerR4', 'thumbR',
    'fingerL1', 'fingerL2', 'fingerL3', 'fingerL4', 'thumbL',
]


def loop_clip(base, dur=4.0, breath=1.2, sway=0.0):
    """Цикл: базовая поза + дыхание (синус по spine) и покачивание, ключи по 1/4 периода."""
    keys = []
    steps = 4
    for i in range(steps + 1):
        t = dur * i / steps
        s = math.sin(2 * math.pi * i / steps)
        k = dict(base)
        sp = list(k.get('spine', [0, 0, 0]))
        sp[0] += breath * s
        k['spine'] = sp
        if sway:
            k['head'] = [0, 0, sway * math.sin(2 * math.pi * i / steps + 1.0)]
        keys.append((t, k, None))
    return keys


def build_action(rig, name, keys):
    """keys: [(time_s, {bone: [x,y,z]}, hips_loc_z or None)]."""
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


def clip(rig, name, spec):
    return build_action(rig, name, spec)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    rig = bpy.data.objects['Fantazia_Player_Rig']
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)

    # HOLD_FLASH: цикл, фонарик в правой руке перед грудью, левая держит снизу
    hf = merged(HOLD_FLASH, grip(0.5))
    clip(rig, 'HOLD_FLASH', loop_clip(hf, dur=4.0, breath=1.0, sway=1.5))

    # HOLD_SWORD: цикл, клинок вверх-вперёд, обе руки на рукояти
    hs = merged(HOLD_SWORD, grip(0.8))
    clip(rig, 'HOLD_SWORD', loop_clip(hs, dur=4.0, breath=1.4, sway=2.0))

    # PICK_FLASH: присед, рука к фонарику, захват, подъём в позу HOLD_FLASH
    pf_reach = merged(HOLD_FLASH, legs(0.6), grip(0.0), {
        'spine': [24, 0, 0], 'rightArm': [60, 0, 0], 'rightElbow': [30, 0, 0]})
    pf_grab = merged(HOLD_FLASH, legs(0.8), grip(1.0), {
        'spine': [28, 0, 0], 'rightArm': [85, 0, 8], 'rightElbow': [10, 0, 0], 'rightHand': [30, 0, 0]})
    pf_hold = merged(HOLD_FLASH, grip(1.0), {'rightHand': [30, 0, 0]})
    pf_up = merged(HOLD_FLASH, legs(0.2), grip(0.5), {'spine': [10, 0, 0]})
    pf_end = merged(HOLD_FLASH, grip(0.5))
    clip(rig, 'PICK_FLASH', [
        (0.0, {}, None),
        (0.5, pf_reach, -0.12),
        (1.0, pf_grab, -0.22),
        (1.4, pf_hold, -0.22),
        (1.9, pf_up, -0.05),
        (2.3, pf_end, 0.0),
    ])

    # PICK_SWORD: тянемся к клинку на алтаре, вынимаем, поднимаем в позу HOLD_SWORD
    ps_reach = merged(HOLD_SWORD, legs(0.5), grip(0.0), {
        'spine': [22, 0, 0], 'rightArm': [80, 0, -4], 'rightElbow': [25, 0, 0], 'leftArm': [50, 0, 12]})
    ps_grab = merged(HOLD_SWORD, legs(0.6), grip(1.0), {
        'spine': [20, 0, 0], 'rightArm': [78, 0, -4], 'rightElbow': [22, 0, 0], 'rightHand': [25, 0, 0]})
    ps_pull = merged(HOLD_SWORD, grip(1.0), {
        'spine': [8, 0, 0], 'rightArm': [45, 0, -5], 'rightElbow': [65, 0, 0]})
    ps_end = merged(HOLD_SWORD, grip(0.8))
    clip(rig, 'PICK_SWORD', [
        (0.0, {}, None),
        (0.6, ps_reach, -0.1),
        (1.2, ps_grab, -0.16),
        (1.8, ps_pull, -0.04),
        (2.6, ps_end, 0.0),
    ])

    # --- экспорт только скелета с клипами ---
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
