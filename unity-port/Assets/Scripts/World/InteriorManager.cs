// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ИНТЕРЬЕРЫ: ТЦ на 8 этажей и здания
//
//  Как в вебе: интерьеры живут в «кармане» далеко от города
//  (INTERIOR_BASE = 2000, 2000), игрок телепортируется туда при входе.
//  Так дешевле, чем строить интерьеры внутри зданий: снаружи их не видно,
//  и они не грузят сцену, пока в них никто не зашёл.
//
//  Геометрия снята с работающей веб-версии (tools/capture-interiors.js):
//  1999 мешей на 8 этажей ТЦ и ещё 932 на 7 типов зданий.
//
//  ЛИФТ. В вебе он был главным источником багов: катсцена уводила
//  игрока вбок, этаж перестраивался мгновенно и это читалось телепортом.
//  Здесь:
//   • смена этажа спрятана за затемнением (как в v52);
//   • камера едет вдоль оси проёма, а не поперёк (фикс v48);
//   • по прибытии игрок ставится перед створками, а не в стену.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Fantazia.Core;
using Fantazia.Player;

namespace Fantazia.World
{
    [Serializable]
    public class ColliderRec { public float minX, maxX, minZ, maxZ; }

    [Serializable]
    public class FloorRec
    {
        public int index;
        public string label;
        public int meshes;
        public ColliderRec[] colliders;
        public InterRec[] interactables;
    }
    [Serializable] public class MallIndex { public FloorRec[] floors; }

    [Serializable]
    public class OtherInterior
    {
        public string type;
        public int meshes;
        public ColliderRec[] colliders;
        public InterRec[] interactables;
    }
    [Serializable] public class InteriorsIndex { public OtherInterior[] list; }

    public class InteriorManager : MonoBehaviour
    {
        public static InteriorManager I { get; private set; }

        [Header("Карман интерьеров (как в вебе)")]
        public Vector3 interiorBase = new Vector3(2000f, 0f, 2000f);

        [Header("Состояние")]
        public bool inside;
        public string buildingType = "";
        public int currentFloor = 5;      // 5 = первый торговый этаж

        MallIndex mallIdx;
        InteriorsIndex otherIdx;
        GameObject root;
        readonly Dictionary<int, MeshRec[]> mallCache = new Dictionary<int, MeshRec[]>();
        readonly Dictionary<int, Material> matCache = new Dictionary<int, Material>();
        Shader litShader;
        Vector3 outsidePos;
        bool busy;

        public string[] FloorLabels =>
            mallIdx?.floors != null
                ? Array.ConvertAll(mallIdx.floors, f => f.label)
                : new[] { "B5","B4","B3","B2","B1","1","2","3" };

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            litShader = Shader.Find("Universal Render Pipeline/Lit");
            if (litShader == null) litShader = Shader.Find("Standard");
        }

        IEnumerator Start()
        {
            yield return WorldBuilder.Read("mall_index.json", txt =>
            {
                if (!string.IsNullOrEmpty(txt)) mallIdx = JsonUtility.FromJson<MallIndex>(txt);
            });
            yield return WorldBuilder.Read("interiors_index.json", txt =>
            {
                if (!string.IsNullOrEmpty(txt)) otherIdx = JsonUtility.FromJson<InteriorsIndex>(txt);
            });
            Debug.Log($"[Interior] Индексы загружены. Этажей ТЦ: {mallIdx?.floors?.Length ?? 0}");
        }

        // ── ВХОД / ВЫХОД ───────────────────────────────────────────────────
        public void Enter(string type, int floor = 5)
        {
            if (busy) return;
            StartCoroutine(EnterRoutine(type, floor));
        }

        IEnumerator EnterRoutine(string type, int floor)
        {
            busy = true;
            var pc = FindObjectOfType<PlayerController>();
            if (pc != null) outsidePos = pc.transform.position;

            yield return Fade(true);

            buildingType = type;
            currentFloor = (type == "mall") ? floor : 0;
            inside = true;

            yield return BuildFloor(type, currentFloor);

            // ставим игрока в центр зала — там же, где в вебе
            if (pc != null) pc.Teleport(interiorBase + new Vector3(0f, FloorY(currentFloor) + 1.2f, 0f));

            yield return Fade(false);
            busy = false;
        }

        public void Exit()
        {
            if (busy) return;
            StartCoroutine(ExitRoutine());
        }

        IEnumerator ExitRoutine()
        {
            busy = true;
            yield return Fade(true);

            Clear();
            inside = false;
            buildingType = "";

            var pc = FindObjectOfType<PlayerController>();
            if (pc != null) pc.Teleport(outsidePos + Vector3.up * 0.5f);

            yield return Fade(false);
            busy = false;
        }

        // ── СМЕНА ЭТАЖА (лифт / эскалатор) ─────────────────────────────────
        public void GoToFloor(int floor)
        {
            if (busy || !inside || buildingType != "mall") return;
            if (floor < 0 || floor >= (mallIdx?.floors?.Length ?? 8)) return;
            StartCoroutine(FloorRoutine(floor));
        }

        IEnumerator FloorRoutine(int floor)
        {
            busy = true;
            var pc = FindObjectOfType<PlayerController>();

            // Едем: небольшая пауза, чтобы поездка ощущалась.
            // В вебе на этом месте был баг — этаж менялся в тот же кадр.
            float ride = 0.5f + Mathf.Abs(floor - currentFloor) * 0.28f;
            yield return new WaitForSeconds(ride);

            yield return Fade(true);
            currentFloor = floor;
            yield return BuildFloor("mall", floor);

            // выходим ПЕРЕД створками лифта, а не в стену
            var w = GameData.I != null ? GameData.I.World : null;
            float lx = w?.lift != null ? w.lift.x : 21f;
            float lz = w?.lift != null ? w.lift.z : -2f;
            if (pc != null)
                pc.Teleport(interiorBase + new Vector3(lx - 2.4f, FloorY(floor) + 1.2f, lz));

            yield return Fade(false);
            busy = false;
        }

        public float FloorY(int floor)
        {
            float fh = GameData.I != null ? GameData.I.World.mallFloorHeight : 5.5f;
            return floor * fh;
        }

        // ── ПОСТРОЙКА ЭТАЖА ────────────────────────────────────────────────
        IEnumerator BuildFloor(string type, int floor)
        {
            Clear();
            root = new GameObject($"Interior_{type}_{floor}");
            root.transform.position = interiorBase;

            string file = (type == "mall") ? $"mall_floor{floor}.json" : $"interior_{type}.json";
            MeshRec[] recs = null;

            if (type == "mall" && mallCache.TryGetValue(floor, out var cached))
            {
                recs = cached;
            }
            else
            {
                yield return WorldBuilder.Read(file, txt =>
                {
                    if (string.IsNullOrEmpty(txt)) return;
                    var list = JsonUtility.FromJson<MeshList>("{\"items\":" + txt + "}");
                    recs = list?.items;
                });
                if (type == "mall" && recs != null) mallCache[floor] = recs;
            }

            if (recs == null)
            {
                Debug.LogWarning($"[Interior] нет данных: {file}");
                yield break;
            }

            foreach (var r in recs) Spawn(r, root.transform);

            // коллайдеры и точки взаимодействия
            ColliderRec[] cols = null;
            InterRec[] ints = null;
            if (type == "mall" && mallIdx?.floors != null && floor < mallIdx.floors.Length)
            {
                cols = mallIdx.floors[floor].colliders;
                ints = mallIdx.floors[floor].interactables;
            }
            else if (otherIdx?.list != null)
            {
                foreach (var o in otherIdx.list)
                    if (o.type == type) { cols = o.colliders; ints = o.interactables; break; }
            }

            BuildColliders(cols, floor, type);
            BuildShell(floor, type);        // стены, потолок, дверь, свет
            BuildFloorPlane(floor, type);
            RegisterInteractables(ints);

            Debug.Log($"[Interior] {type} этаж {floor}: {recs.Length} мешей, " +
                      $"{cols?.Length ?? 0} коллайдеров");
        }

        void Spawn(MeshRec r, Transform parent)
        {
            if (r.k == "cone")
            {
                var cone = new GameObject("Cone");
                cone.transform.SetParent(parent, false);
                cone.AddComponent<MeshFilter>().sharedMesh = WorldBuilder.GetConeMeshPublic();
                cone.AddComponent<MeshRenderer>().sharedMaterial = GetMat(r);
                cone.transform.localPosition = new Vector3(r.x, r.y, r.z);
                cone.transform.localEulerAngles = new Vector3(r.rx, r.ry, r.rz);
                cone.transform.localScale = new Vector3(r.sx, r.sy, r.sz);
                return;
            }

            PrimitiveType pt;
            switch (r.k)
            {
                case "sphere": pt = PrimitiveType.Sphere; break;
                case "cylinder":
                case "torus": pt = PrimitiveType.Cylinder; break;
                default: pt = PrimitiveType.Cube; break;
            }
            var go = GameObject.CreatePrimitive(pt);
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);

            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(r.x, r.y, r.z);
            go.transform.localEulerAngles = new Vector3(r.rx, r.ry, r.rz);

            Vector3 s = new Vector3(r.sx, r.sy, r.sz);
            if (pt == PrimitiveType.Cylinder) s.y *= 0.5f;
            if (r.k == "plane") s.y = Mathf.Max(s.y, 0.02f);
            go.transform.localScale = s;

            go.GetComponent<MeshRenderer>().sharedMaterial = GetMat(r);
        }

        Material GetMat(MeshRec r)
        {
            int key = r.c ^ (r.e << 3) ^ (Mathf.RoundToInt(r.o * 100) << 7);
            if (matCache.TryGetValue(key, out var m)) return m;

            m = new Material(litShader);
            Color c = WorldBuilder.HexColor(r.c);
            if (r.o < 0.99f)
            {
                c.a = r.o;
                if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 1f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.renderQueue = 3000;
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
            }
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.15f);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0f);
            if (r.g > 0.01f && r.e != 0)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor"))
                    m.SetColor("_EmissionColor", WorldBuilder.HexColor(r.e) * Mathf.Min(r.g * 1.6f, 3f));
            }
            m.enableInstancing = true;
            matCache[key] = m;
            return m;
        }

        // Коллайдеры интерьера: в вебе это были прямоугольники, которые
        // проверялись перебором. Здесь — обычные боксы, физику считает Unity.
        void BuildColliders(ColliderRec[] cols, int floor, string type)
        {
            if (cols == null) return;
            float y = (type == "mall") ? FloorY(floor) : 0f;
            var holder = new GameObject("Colliders");
            holder.transform.SetParent(root.transform, false);

            foreach (var c in cols)
            {
                var go = new GameObject("Col");
                go.transform.SetParent(holder.transform, false);
                float cx = (c.minX + c.maxX) * 0.5f;
                float cz = (c.minZ + c.maxZ) * 0.5f;
                float w = Mathf.Max(0.1f, c.maxX - c.minX);
                float d = Mathf.Max(0.1f, c.maxZ - c.minZ);
                go.transform.localPosition = new Vector3(cx, y + 1.6f, cz);
                var bc = go.AddComponent<BoxCollider>();
                bc.size = new Vector3(w, 3.2f, d);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  СТЕНЫ, ПОТОЛОК И ДВЕРЬ ВЫХОДА
        //
        //  В веб-версии интерьеры домов — это пол-плоскость плюс мебель.
        //  Стен и потолка в захваченных данных НЕТ (проверено: у дома
        //  0 стен из 197 мешей), поэтому игрок видел «комнату» посреди
        //  пустоты и мог уйти за её край.
        //  Строим коробку сами, по размерам зала и цветам из
        //  INTERIOR_CONFIGS веб-версии.
        // ═══════════════════════════════════════════════════════════════
        struct RoomStyle
        {
            public Color wall, ceiling, floor;
            public float w, d, h;
        }

        RoomStyle GetStyle(string type)
        {
            // Цвета взяты из INTERIOR_CONFIGS в index.html.
            switch (type)
            {
                case "mall":      return New(0xbdbbbb, 0xf5f5f5, 44f, 36f, 5.5f);
                case "house":     return New(0xc9a87c, 0xe8d5b7, 40f, 30f, 4.2f);
                case "apartment": return New(0x8a9bb0, 0xd4cfc7, 30f, 24f, 3.6f);
                case "office":    return New(0x6b8cae, 0xe0e8f0, 30f, 24f, 3.8f);
                case "club":      return New(0x1a0030, 0x1a0030, 30f, 24f, 4.5f);
                case "bank":      return New(0x1c2e40, 0xc8b8a0, 30f, 24f, 4.2f);
                case "hospital":  return New(0xf0f0f0, 0xffffff, 30f, 24f, 3.8f);
                case "police":    return New(0x2a3a55, 0xd8dce4, 30f, 24f, 3.8f);
                case "shop":      return New(0xa8b0bd, 0xeeeae2, 30f, 24f, 3.6f);
                default:          return New(0x9aa0a8, 0xe4e0d8, 30f, 24f, 3.8f);
            }
        }

        RoomStyle New(int wall, int floorCol, float w, float d, float h)
        {
            return new RoomStyle
            {
                wall = WorldBuilder.HexColor(wall),
                floor = WorldBuilder.HexColor(floorCol),
                ceiling = WorldBuilder.HexColor(wall) * 1.15f,
                w = w, d = d, h = h
            };
        }

        void BuildShell(int floor, string type)
        {
            var st = GetStyle(type);
            float y = (type == "mall") ? FloorY(floor) : 0f;
            float hw = st.w * 0.5f, hd = st.d * 0.5f;

            var shell = new GameObject("Shell");
            shell.transform.SetParent(root.transform, false);

            var wallMat = SolidMat(st.wall, 0.08f);
            var ceilMat = SolidMat(st.ceiling, 0.05f);
            var floorMat = SolidMat(st.floor, 0.12f);

            // ── ПОЛ ──
            Slab(shell.transform, new Vector3(0f, y - 0.06f, 0f),
                 new Vector3(st.w, 0.12f, st.d), floorMat, true);

            // ── ПОТОЛОК ──
            Slab(shell.transform, new Vector3(0f, y + st.h, 0f),
                 new Vector3(st.w, 0.12f, st.d), ceilMat, true);

            // ── ЧЕТЫРЕ СТЕНЫ ──
            // В южной стене оставляем проём под дверь, поэтому она
            // собирается из двух кусков и перемычки.
            const float doorW = 3.2f, doorH = 2.8f;

            Slab(shell.transform, new Vector3(0f, y + st.h * 0.5f, -hd),
                 new Vector3(st.w, st.h, 0.3f), wallMat, true);                 // север
            Slab(shell.transform, new Vector3(-hw, y + st.h * 0.5f, 0f),
                 new Vector3(0.3f, st.h, st.d), wallMat, true);                 // запад
            Slab(shell.transform, new Vector3(hw, y + st.h * 0.5f, 0f),
                 new Vector3(0.3f, st.h, st.d), wallMat, true);                 // восток

            float side = (st.w - doorW) * 0.5f;
            Slab(shell.transform, new Vector3(-(doorW * 0.5f + side * 0.5f), y + st.h * 0.5f, hd),
                 new Vector3(side, st.h, 0.3f), wallMat, true);
            Slab(shell.transform, new Vector3(doorW * 0.5f + side * 0.5f, y + st.h * 0.5f, hd),
                 new Vector3(side, st.h, 0.3f), wallMat, true);
            Slab(shell.transform, new Vector3(0f, y + doorH + (st.h - doorH) * 0.5f, hd),
                 new Vector3(doorW, st.h - doorH, 0.3f), wallMat, true);

            // ── ДВЕРЬ ВЫХОДА ──
            // Заметная зелёная рамка со светом: раньше выйти было
            // вообще нечем — точки exit не существовало ни на одном этаже.
            var frameMat = SolidMat(new Color(0.18f, 0.55f, 0.32f), 0.3f, true);
            Slab(shell.transform, new Vector3(0f, y + doorH * 0.5f, hd - 0.16f),
                 new Vector3(doorW, 0.14f, 0.12f), frameMat, false);
            Slab(shell.transform, new Vector3(0f, y + doorH, hd - 0.16f),
                 new Vector3(doorW, 0.16f, 0.12f), frameMat, false);
            foreach (float sx in new[] { -doorW * 0.5f, doorW * 0.5f })
                Slab(shell.transform, new Vector3(sx, y + doorH * 0.5f, hd - 0.16f),
                     new Vector3(0.16f, doorH, 0.12f), frameMat, false);

            var exitLight = new GameObject("ExitLight");
            exitLight.transform.SetParent(shell.transform, false);
            exitLight.transform.localPosition = new Vector3(0f, y + doorH + 0.4f, hd - 1.2f);
            var el = exitLight.AddComponent<Light>();
            el.type = LightType.Point;
            el.color = new Color(0.4f, 1f, 0.6f);
            el.range = 9f;
            el.intensity = 1.4f;
            el.shadows = LightShadows.None;

            // ── ОСВЕЩЕНИЕ ЗАЛА ──
            // Без него интерьер чёрный: свет города сюда не достаёт.
            int lampsX = Mathf.Max(2, Mathf.RoundToInt(st.w / 14f));
            int lampsZ = Mathf.Max(2, Mathf.RoundToInt(st.d / 14f));
            for (int ix = 0; ix < lampsX; ix++)
                for (int iz = 0; iz < lampsZ; iz++)
                {
                    float lx = -hw + st.w * (ix + 0.5f) / lampsX;
                    float lz = -hd + st.d * (iz + 0.5f) / lampsZ;
                    var lampGO = new GameObject("Lamp");
                    lampGO.transform.SetParent(shell.transform, false);
                    lampGO.transform.localPosition = new Vector3(lx, y + st.h - 0.4f, lz);
                    var l = lampGO.AddComponent<Light>();
                    l.type = LightType.Point;
                    l.color = new Color(1f, 0.95f, 0.85f);
                    l.range = 20f;
                    l.intensity = Application.isMobilePlatform ? 1.1f : 1.5f;
                    l.shadows = LightShadows.None;
                }

            // ── ТОЧКА ВЫХОДА ──
            exitPoint = new InterRec
            {
                x = 0f, y = y, z = hd - 2.2f,
                type = "exit", name = "🚪 Выйти на улицу", range = 3.4f
            };
        }

        InterRec exitPoint;

        // Плита с коллайдером: используется для стен, пола и потолка.
        void Slab(Transform parent, Vector3 pos, Vector3 size, Material mat, bool collide)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "Slab";
            var col = go.GetComponent<Collider>();
            if (!collide && col != null) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        Material SolidMat(Color c, float smooth, bool glow = false)
        {
            var m = new Material(litShader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0f);
            if (glow)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", c * 1.6f);
            }
            return m;
        }

        // Пол: без него игрок провалится — коллайдеры есть только у стен.
        void BuildFloorPlane(int floor, string type)
        {
            float y = (type == "mall") ? FloorY(floor) : 0f;
            var go = new GameObject("FloorPlane");
            go.transform.SetParent(root.transform, false);
            go.transform.localPosition = new Vector3(0f, y - 0.5f, 0f);
            var bc = go.AddComponent<BoxCollider>();
            bc.size = new Vector3(60f, 1f, 50f);
            go.transform.localPosition = new Vector3(0f, y - 0.9f, 0f);  // ниже настоящего пола

            // и потолок-ограничитель, чтобы не улететь на этаж выше
            var ceil = new GameObject("Ceiling");
            ceil.transform.SetParent(root.transform, false);
            float fh = GameData.I != null ? GameData.I.World.mallFloorHeight : 5.5f;
            ceil.transform.localPosition = new Vector3(0f, y + fh + 0.5f, 0f);
            var cbc = ceil.AddComponent<BoxCollider>();
            cbc.size = new Vector3(60f, 1f, 50f);
        }

        readonly List<InterRec> active = new List<InterRec>();
        public List<InterRec> ActiveInteractables => active;

        void RegisterInteractables(InterRec[] ints)
        {
            active.Clear();
            if (ints != null) active.AddRange(ints);
            // Точка выхода добавляется ВСЕГДА. В захваченных данных её
            // не было ни на одном этаже — игрок заходил в здание и
            // не мог выбраться иначе как кнопкой в углу экрана.
            if (exitPoint != null) active.Add(exitPoint);
        }

        void Clear()
        {
            if (root != null) Destroy(root);
            root = null;
            active.Clear();
        }

        // ── ЗАТЕМНЕНИЕ ─────────────────────────────────────────────────────
        // То же решение, что в вебе v52: перестройка геометрии прячется
        // за короткой чёрной вспышкой, иначе смена этажа выглядит рывком.
        CanvasGroup fade;

        CanvasGroup EnsureFade()
        {
            if (fade != null) return fade;
            var go = new GameObject("FadeCanvas");
            go.transform.SetParent(transform, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 9000;
            fade = go.AddComponent<CanvasGroup>();
            fade.blocksRaycasts = false;
            fade.alpha = 0f;

            var img = new GameObject("Black");
            img.transform.SetParent(go.transform, false);
            var rt = img.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            var im = img.AddComponent<UnityEngine.UI.Image>();
            im.color = Color.black;
            return fade;
        }

        IEnumerator Fade(bool toBlack)
        {
            var f = EnsureFade();
            float from = f.alpha, to = toBlack ? 1f : 0f, t = 0f;
            const float dur = 0.22f;
            while (t < dur)
            {
                t += Time.deltaTime;
                f.alpha = Mathf.Lerp(from, to, t / dur);
                yield return null;
            }
            f.alpha = to;
        }
    }
}
