// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ПОСТРОИТЕЛЬ МИРА
//
//  Воссоздаёт город из JSON, снятого с работающей веб-версии
//  (tools/capture-world.js записал КАЖДЫЙ меш: позицию, поворот,
//  размер, тип примитива, цвет). Это не «похожий» город, а тот же самый.
//
//  ПРОИЗВОДИТЕЛЬНОСТЬ — главная забота: 7045 мешей по отдельности
//  дали бы 7045 draw call и убили бы даже ПК, не говоря о телефоне.
//  Решение:
//   1. Меши группируются по материалу и склеиваются в общий меш
//      (StaticBatchingUtility + ручное объединение через CombineMeshes).
//   2. Мир режется на сетку чанков; дальние чанки выключаются целиком.
//   3. Коллайдеры ставятся только на здания (379 боксов), а не на
//      каждую декоративную деталь.
//
//  Порядок вершин у Unity и three.js совпадает для примитивов, поэтому
//  геометрия переносится один в один. Единственная поправка — плоскости:
//  в three.js PlaneGeometry вертикальна, в Unity Plane лежит, поэтому
//  плоскости строятся как тонкие боксы.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;
using Fantazia.Core;

namespace Fantazia.World
{
    // ── Одна запись из JSON ────────────────────────────────────────────────
    [Serializable]
    public class MeshRec
    {
        public string k;                 // box, sphere, cylinder, cone, plane, torus
        public float x, y, z;            // мировая позиция
        public float sx, sy, sz;         // габариты
        public float rx, ry, rz;         // поворот в градусах
        public int c;                    // цвет
        public int e;                    // emissive
        public float g;                  // сила свечения
        public float o;                  // прозрачность
    }
    [Serializable] public class MeshList { public MeshRec[] items; }

    [Serializable]
    public class BuildingRec
    {
        public float x, z, w, h, d;
        public string name, type;
    }
    [Serializable] public class BuildingList { public BuildingRec[] items; }

    [Serializable]
    public class InterRec
    {
        public float x, y, z;
        public string type, name;
        public float range;
    }
    [Serializable] public class InterList { public InterRec[] items; }

    [Serializable] public class CityIndex { public int parts; public int total; }

    // ═══════════════════════════════════════════════════════════════════════
    public class WorldBuilder : MonoBehaviour
    {
        public static WorldBuilder I { get; private set; }

        [Header("Что строить")]
        public bool buildCity = true;
        public bool buildColliders = true;

        [Header("Оптимизация")]
        [Tooltip("Размер чанка в метрах. Дальние чанки выключаются целиком.")]
        public float chunkSize = 120f;
        [Tooltip("Дистанция видимости чанка. На телефоне ставится меньше.")]
        public float viewDistance = 320f;
        [Tooltip("Склеивать меши одного цвета в один — резко меньше draw call")]
        public bool combineMeshes = true;

        [Header("Состояние")]
        public int meshesBuilt;
        public int chunksBuilt;
        public bool Done { get; private set; }

        // Сколько объектов создаём за один кадр. 7045 подряд подвешивали
        // игру на несколько секунд — выглядело как «игра не работает».
        // 250 за кадр даёт ~28 кадров загрузки при 60 FPS: полсекунды,
        // и всё это время крутится полоса прогресса.
        [Tooltip("Объектов за кадр при загрузке города")]
        public int spawnPerFrame = 250;

        public float Progress { get; private set; }
        int totalToBuild = 1;

        readonly Dictionary<int, Material> matCache = new Dictionary<int, Material>();
        readonly Dictionary<Vector2Int, GameObject> chunks = new Dictionary<Vector2Int, GameObject>();
        readonly List<InterRec> interactables = new List<InterRec>();

        Transform player;
        Shader litShader;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            litShader = Shader.Find("Universal Render Pipeline/Lit");
            if (litShader == null) litShader = Shader.Find("Standard");
        }

        void Start()
        {
            if (Application.isMobilePlatform) viewDistance = 200f;
            // применяем сохранённую настройку дальности
            if (PlayerPrefs.HasKey("fz_viewdist"))
                viewDistance = PlayerPrefs.GetFloat("fz_viewdist");
            if (Application.isMobilePlatform) spawnPerFrame = 150;
            StartCoroutine(BuildAll());
        }

        IEnumerator BuildAll()
        {
            float t0 = Time.realtimeSinceStartup;

            if (buildCity)
            {
                CityIndex idx = null;
                yield return Read("city_index.json", txt =>
                {
                    if (!string.IsNullOrEmpty(txt)) idx = JsonUtility.FromJson<CityIndex>(txt);
                });

                int parts = idx != null ? idx.parts : 1;
                totalToBuild = idx != null && idx.total > 0 ? idx.total : 1;

                for (int p = 0; p < parts; p++)
                {
                    MeshRec[] recs = null;
                    yield return Read($"city_part{p}.json", txt =>
                    {
                        if (string.IsNullOrEmpty(txt)) return;
                        var list = JsonUtility.FromJson<MeshList>("{\"items\":" + txt + "}");
                        recs = list?.items;
                    });
                    if (recs == null) continue;
                    // строим порциями, отдавая кадр — иначе игра замирает
                    yield return SpawnStreamed(recs);
                }
            }

            if (buildColliders)
            {
                yield return Read("city_colliders.json", txt =>
                {
                    if (string.IsNullOrEmpty(txt)) return;
                    var list = JsonUtility.FromJson<BuildingList>("{\"items\":" + txt + "}");
                    if (list?.items != null) SpawnColliders(list.items);
                });
            }

            yield return Read("city_interactables.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                var list = JsonUtility.FromJson<InterList>("{\"items\":" + txt + "}");
                if (list?.items != null) interactables.AddRange(list.items);
            });

            if (combineMeshes) CombineChunks();

            Progress = 1f;
            Done = true;
            float dt = Time.realtimeSinceStartup - t0;
            Debug.Log($"[World] Город построен: {meshesBuilt} мешей, {chunksBuilt} чанков, " +
                      $"{interactables.Count} точек взаимодействия за {dt:0.0} c");
        }

        // ── СОЗДАНИЕ МЕШЕЙ ─────────────────────────────────────────────────
        // Порциями с паузой на кадр: 7045 объектов за раз замораживали
        // игру, и это читалось как «ничего не работает».
        IEnumerator SpawnStreamed(MeshRec[] recs)
        {
            int inFrame = 0;
            for (int i = 0; i < recs.Length; i++)
            {
                var r = recs[i];
                var chunk = GetChunk(r.x, r.z);
                var go = MakePrimitive(r);
                if (go != null)
                {
                    go.transform.SetParent(chunk.transform, true);
                    meshesBuilt++;
                }
                Progress = Mathf.Clamp01(meshesBuilt / (float)totalToBuild);

                if (++inFrame >= spawnPerFrame)
                {
                    inFrame = 0;
                    yield return null;
                }
            }
        }

        void SpawnBatch(MeshRec[] recs)
        {
            foreach (var r in recs)
            {
                var chunk = GetChunk(r.x, r.z);
                var go = MakePrimitive(r);
                if (go == null) continue;
                go.transform.SetParent(chunk.transform, true);
                meshesBuilt++;
            }
        }


        // ── КОНУС ──
        // У Unity нет примитива-конуса, а в городе это крыши, ёлки и
        // дорожные конусы — цилиндром они выглядели неправильно.
        // Строим меш один раз и переиспользуем.
        static Mesh coneMesh;
        public static Mesh GetConeMeshPublic() { return GetConeMesh(); }

        static Mesh GetConeMesh()
        {
            if (coneMesh != null) return coneMesh;
            const int seg = 12;
            var verts = new List<Vector3>();
            var tris = new List<int>();

            verts.Add(new Vector3(0f, 0.5f, 0f));          // вершина
            for (int i = 0; i < seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                verts.Add(new Vector3(Mathf.Cos(a) * 0.5f, -0.5f, Mathf.Sin(a) * 0.5f));
            }
            verts.Add(new Vector3(0f, -0.5f, 0f));          // центр донышка
            int centerIdx = verts.Count - 1;

            for (int i = 0; i < seg; i++)
            {
                int a = 1 + i, b = 1 + (i + 1) % seg;
                tris.Add(0); tris.Add(b); tris.Add(a);           // бок
                tris.Add(centerIdx); tris.Add(a); tris.Add(b);   // низ
            }

            coneMesh = new Mesh();
            coneMesh.SetVertices(verts);
            coneMesh.SetTriangles(tris, 0);
            coneMesh.RecalculateNormals();
            coneMesh.RecalculateBounds();
            return coneMesh;
        }

        GameObject MakePrimitive(MeshRec r)
        {
            // конус собираем своим мешем
            if (r.k == "cone")
            {
                var cone = new GameObject("Cone");
                cone.AddComponent<MeshFilter>().sharedMesh = GetConeMesh();
                cone.AddComponent<MeshRenderer>().sharedMaterial = GetMat(r);
                cone.transform.position = new Vector3(r.x, r.y, r.z);
                cone.transform.eulerAngles = new Vector3(r.rx, r.ry, r.rz);
                cone.transform.localScale = new Vector3(r.sx, r.sy, r.sz);
                cone.isStatic = true;
                return cone;
            }

            PrimitiveType pt;
            switch (r.k)
            {
                case "sphere": pt = PrimitiveType.Sphere; break;
                case "cylinder": pt = PrimitiveType.Cylinder; break;
                case "torus": pt = PrimitiveType.Cylinder; break;  // тор приблизим диском
                default: pt = PrimitiveType.Cube; break;           // box и plane
            }

            var go = GameObject.CreatePrimitive(pt);
            // коллайдеры на декоре не нужны: они есть только у зданий
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);

            go.transform.position = new Vector3(r.x, r.y, r.z);
            go.transform.eulerAngles = new Vector3(r.rx, r.ry, r.rz);

            // Unity: Cube 1×1×1, Sphere Ø1, Cylinder высотой 2 — учитываем
            Vector3 s = new Vector3(r.sx, r.sy, r.sz);
            if (pt == PrimitiveType.Cylinder) s.y *= 0.5f;
            if (r.k == "plane") s.y = Mathf.Max(s.y, 0.02f);
            go.transform.localScale = s;

            go.GetComponent<MeshRenderer>().sharedMaterial = GetMat(r);
            go.isStatic = true;
            return go;
        }

        // Материалы кэшируются по (цвет + свечение + прозрачность):
        // из 7045 мешей уникальных материалов всего несколько десятков.
        Material GetMat(MeshRec r)
        {
            int key = r.c ^ (r.e << 3) ^ (Mathf.RoundToInt(r.o * 100) << 7);
            if (matCache.TryGetValue(key, out var m)) return m;

            m = new Material(litShader);
            Color c = HexColor(r.c);

            if (r.o < 0.99f)
            {
                c.a = r.o;
                // прозрачность в URP включается набором флагов
                if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 1f);
                if (m.HasProperty("_Blend")) m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.renderQueue = 3000;
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_ALPHAPREMULTIPLY_ON");
            }

            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.12f);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.12f);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0f);

            if (r.g > 0.01f && r.e != 0)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor"))
                    m.SetColor("_EmissionColor", HexColor(r.e) * Mathf.Min(r.g * 1.6f, 3f));
            }

            m.enableInstancing = true;
            matCache[key] = m;
            return m;
        }

        public static Color HexColor(int hex)
        {
            return new Color(((hex >> 16) & 0xFF) / 255f,
                             ((hex >> 8) & 0xFF) / 255f,
                             (hex & 0xFF) / 255f);
        }

        // ── ЧАНКИ ──────────────────────────────────────────────────────────
        GameObject GetChunk(float x, float z)
        {
            var key = new Vector2Int(Mathf.FloorToInt(x / chunkSize),
                                     Mathf.FloorToInt(z / chunkSize));
            if (chunks.TryGetValue(key, out var go)) return go;

            go = new GameObject($"Chunk_{key.x}_{key.y}");
            go.transform.SetParent(transform, false);
            go.isStatic = true;
            chunks[key] = go;
            chunksBuilt++;
            return go;
        }

        // Склейка мешей одного материала внутри чанка.
        // Это главная оптимизация: вместо тысяч draw call — десятки.
        void CombineChunks()
        {
            int before = meshesBuilt, after = 0;

            foreach (var kv in chunks)
            {
                var chunk = kv.Value;
                var byMat = new Dictionary<Material, List<MeshFilter>>();

                foreach (var mf in chunk.GetComponentsInChildren<MeshFilter>())
                {
                    var mr = mf.GetComponent<MeshRenderer>();
                    if (mr == null) continue;
                    var mat = mr.sharedMaterial;
                    if (!byMat.TryGetValue(mat, out var list))
                        byMat[mat] = list = new List<MeshFilter>();
                    list.Add(mf);
                }

                foreach (var pair in byMat)
                {
                    var list = pair.Value;
                    if (list.Count < 2) { after += list.Count; continue; }

                    // Меш в Unity держит не больше 65535 вершин на 16-битном
                    // индексе. Ставим 32-битный, иначе крупные чанки обрежутся.
                    var combines = new CombineInstance[list.Count];
                    for (int i = 0; i < list.Count; i++)
                    {
                        combines[i].mesh = list[i].sharedMesh;
                        combines[i].transform = list[i].transform.localToWorldMatrix;
                    }

                    var merged = new Mesh();
                    merged.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
                    merged.CombineMeshes(combines, true, true);
                    merged.RecalculateBounds();

                    var go = new GameObject("Merged");
                    go.transform.SetParent(chunk.transform, false);
                    go.AddComponent<MeshFilter>().sharedMesh = merged;
                    go.AddComponent<MeshRenderer>().sharedMaterial = pair.Key;
                    go.isStatic = true;
                    after++;

                    foreach (var mf in list) Destroy(mf.gameObject);
                }
            }

            Debug.Log($"[World] Склейка: {before} мешей → {after} объектов рендера");
        }

        // ── КОЛЛАЙДЕРЫ ЗДАНИЙ ──────────────────────────────────────────────
        // Ставим боксы только на здания. Раньше в вебе коллизия считалась
        // перебором прямоугольников на CPU; в Unity этим займётся физика.
        void SpawnColliders(BuildingRec[] recs)
        {
            var root = new GameObject("BuildingColliders");
            root.transform.SetParent(transform, false);

            foreach (var b in recs)
            {
                var go = new GameObject(string.IsNullOrEmpty(b.name) ? "Building" : b.name);
                go.transform.SetParent(root.transform, false);
                go.transform.position = new Vector3(b.x, b.h * 0.5f, b.z);
                var bc = go.AddComponent<BoxCollider>();
                bc.size = new Vector3(b.w + 1f, b.h, b.d + 1f);
                go.isStatic = true;
                go.layer = 0;
            }
            Debug.Log($"[World] Коллайдеры зданий: {recs.Length}");
        }

        // ── ВИДИМОСТЬ ЧАНКОВ ───────────────────────────────────────────────
        float cullTimer;
        void Update()
        {
            if (!Done) return;

            // раз в 0.4 с — этого хватает, каждый кадр не нужно
            cullTimer += Time.deltaTime;
            if (cullTimer < 0.4f) return;
            cullTimer = 0f;

            if (player == null)
            {
                var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc != null) player = pc.transform;
                if (player == null) return;
            }

            Vector3 p = player.position;
            float d2 = viewDistance * viewDistance;

            foreach (var kv in chunks)
            {
                var c = kv.Key;
                float cx = (c.x + 0.5f) * chunkSize;
                float cz = (c.y + 0.5f) * chunkSize;
                float dx = cx - p.x, dz = cz - p.z;
                bool vis = (dx * dx + dz * dz) < d2;
                if (kv.Value.activeSelf != vis) kv.Value.SetActive(vis);
            }
        }

        // ── ЧТЕНИЕ ФАЙЛОВ ──────────────────────────────────────────────────
        public static IEnumerator Read(string file, Action<string> done)
        {
            string path = Path.Combine(Application.streamingAssetsPath, file);

            // на Android StreamingAssets лежит внутри APK — только через сеть
            if (path.Contains("://") || path.Contains(":///"))
            {
                using (var req = UnityWebRequest.Get(path))
                {
                    yield return req.SendWebRequest();
                    done(req.result == UnityWebRequest.Result.Success
                        ? req.downloadHandler.text : null);
                }
            }
            else
            {
                done(File.Exists(path) ? File.ReadAllText(path) : null);
            }
        }

        public List<InterRec> Interactables => interactables;
    }
}
