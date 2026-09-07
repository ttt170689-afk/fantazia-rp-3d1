// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — СБОРЩИК КОСМЕТИКИ (206 предметов)
//
//  Тот же подход, что в веб-версии: не 206 префабов и не 206 веток кода,
//  а 24 ПРОЦЕДУРНЫХ АРХЕТИПА, параметризованных цветом, размером,
//  свечением и мелкими деталями. Данные берутся из cosmetics.json,
//  который сгенерирован из рабочей JS-игры.
//
//  Почему не префабы: 206 префабов пришлось бы делать руками в редакторе
//  и держать в сборке. Процедурная сборка занимает один файл, а новые
//  предметы добавляются правкой JSON без открытия Unity.
//
//  Координаты подобраны под модель ростом ~1.8 м с головой на y≈1.62.
//  Если модель другая — поменяйте HEAD_Y и TORSO_Y ниже.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using UnityEngine;
using Fantazia.Core;

namespace Fantazia.Cosmetics
{
    public class CosmeticBuilder : MonoBehaviour
    {
        // Опорные точки на модели. Веб-версия использовала голову на 2.35
        // при росте 2.5 — здесь пересчитано под стандартные 1.8 м.
        const float HEAD_Y = 1.62f;
        const float TORSO_Y = 1.15f;
        const float SCALE = 0.72f;   // общий коэффициент: веб-модель крупнее

        [Header("Куда вешать предметы")]
        public Transform headAnchor;
        public Transform bodyAnchor;
        public Transform backAnchor;
        public Transform handAnchor;

        readonly Dictionary<string, GameObject> equipped = new Dictionary<string, GameObject>();

        Material MakeMat(Color c, float metal, float rough, Color emissive, float glow, float alpha)
        {
            // URP Lit, с откатом на встроенный шейдер — чтобы проект
            // открылся и в Built-in, и в URP без правок.
            Shader sh = Shader.Find("Universal Render Pipeline/Lit");
            if (sh == null) sh = Shader.Find("Standard");
            var m = new Material(sh);

            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", Mathf.Clamp01(metal));
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 1f - Mathf.Clamp01(rough));
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 1f - Mathf.Clamp01(rough));

            if (glow > 0.001f)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor"))
                    m.SetColor("_EmissionColor", emissive * glow * 2f);
            }

            if (alpha < 0.999f)
            {
                // прозрачность в URP включается набором флагов
                if (m.HasProperty("_Surface")) m.SetFloat("_Surface", 1f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.renderQueue = 3000;
                var col = c; col.a = alpha;
                if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", col);
                if (m.HasProperty("_Color")) m.SetColor("_Color", col);
            }
            return m;
        }

        GameObject Prim(PrimitiveType t, Transform parent, Vector3 pos,
                        Vector3 scale, Material mat, Vector3? rot = null)
        {
            var go = GameObject.CreatePrimitive(t);
            // коллайдеры на украшениях не нужны — они мешают ходьбе
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            if (rot.HasValue) go.transform.localEulerAngles = rot.Value;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        // ═══════════════════════════════════════════════════════════════════
        //  ГЛАВНЫЙ МЕТОД: надеть предмет
        // ═══════════════════════════════════════════════════════════════════
        public GameObject Equip(string itemId)
        {
            if (GameData.I == null) return null;
            var it = GameData.I.GetCosmetic(itemId);
            if (it == null) { Debug.LogWarning($"[Cosmetics] нет предмета {itemId}"); return null; }

            Unequip(it.slot);

            Transform anchor = it.slot switch
            {
                "back" => backAnchor != null ? backAnchor : transform,
                "gear" => handAnchor != null ? handAnchor : transform,
                "body" => bodyAnchor != null ? bodyAnchor : transform,
                "aura" => transform,
                _ => headAnchor != null ? headAnchor : transform
            };

            var root = new GameObject("Cosmetic_" + it.id);
            root.transform.SetParent(anchor, false);

            Build(root.transform, it);

            equipped[it.slot] = root;
            return root;
        }

        public void Unequip(string slot)
        {
            if (equipped.TryGetValue(slot, out var go) && go != null) Destroy(go);
            equipped.Remove(slot);
        }

        public void UnequipAll()
        {
            foreach (var kv in equipped) if (kv.Value != null) Destroy(kv.Value);
            equipped.Clear();
        }

        // ═══════════════════════════════════════════════════════════════════
        //  АРХЕТИПЫ
        // ═══════════════════════════════════════════════════════════════════
        void Build(Transform g, CosmeticItem it)
        {
            Color c = it.UnityColor;
            Color em = it.emissive != 0 ? it.EmissiveColor : c;
            float metal = it.metal >= 0f ? it.metal : 0.3f;
            float s = it.size * SCALE;
            float alpha = it.opacity > 0.001f ? it.opacity : 1f;
            Material m = MakeMat(c, metal, 0.5f, em, it.glow, alpha);

            switch (it.type)
            {
                case "hat": BuildHat(g, it, m, s); break;
                case "cap": BuildCap(g, it, m, s); break;
                case "crown": BuildCrown(g, it, m, s); break;
                case "helmet": BuildHelmet(g, it, m, s); break;
                case "beanie": BuildBeanie(g, it, m, s); break;
                case "glasses": BuildGlasses(g, it, m, s); break;
                case "visorGlass": BuildVisor(g, it, m, s); break;
                case "mask": BuildMask(g, it, m, s); break;
                case "earrings": BuildEarrings(g, it, m, s); break;
                case "necklace": BuildNecklace(g, it, m, s); break;
                case "watch": BuildWatch(g, it, m, s); break;
                case "wings": BuildWings(g, it, m, s); break;
                case "cape": BuildCape(g, it, m, s); break;
                case "backpack": BuildBackpack(g, it, m, s); break;
                case "halo": BuildHalo(g, it, m, s); break;
                case "aura": BuildAura(g, it, m, s); break;
                case "horns": BuildHorns(g, it, m, s); break;
                case "ears": BuildEars(g, it, m, s); break;
                case "tail": BuildTail(g, it, m, s); break;
                case "handItem": BuildHandItem(g, it, m, s); break;
                case "shoulder": BuildShoulder(g, it, m, s); break;
                case "belt": BuildBelt(g, it, m, s); break;
                case "scarf": BuildScarf(g, it, m, s); break;
                case "trail": BuildTrail(g, it, m, s); break;
                default: Debug.LogWarning($"[Cosmetics] неизвестный архетип {it.type}"); break;
            }
        }

        Material Sub(int hex, float metal, float glow)
        {
            Color c = CosmeticItem.IntToColor(hex);
            return MakeMat(c, metal, 0.4f, c, glow, 1f);
        }

        void BuildHat(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0.20f, 0),
                 new Vector3(0.46f * s, 0.018f, 0.46f * s), m);
            Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0.34f, 0),
                 new Vector3(0.30f * s, 0.21f * s, 0.30f * s), m);
            if (it.band != 0)
                Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0.24f, 0),
                     new Vector3(0.315f * s, 0.035f, 0.315f * s), Sub(it.band, 0.6f, 0f));
        }

        void BuildCap(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Sphere, g, new Vector3(0, 0.17f, 0),
                 new Vector3(0.37f * s, 0.28f * s, 0.37f * s), m);
            Prim(PrimitiveType.Cube, g, new Vector3(0, 0.14f, 0.24f * s),
                 new Vector3(0.42f * s, 0.03f, 0.28f * s), m);
            if (it.accent != 0)
                Prim(PrimitiveType.Sphere, g, new Vector3(0, 0.32f, 0),
                     new Vector3(0.05f, 0.05f, 0.05f), Sub(it.accent, 0.8f, 0f));
        }

        void BuildCrown(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0.20f, 0),
                 new Vector3(0.35f * s, 0.06f, 0.35f * s), m);
            int pts = it.points > 0 ? it.points : 5;
            for (int i = 0; i < pts; i++)
            {
                float a = (i / (float)pts) * Mathf.PI * 2f;
                var p = new Vector3(Mathf.Cos(a) * 0.32f * s, 0.31f, Mathf.Sin(a) * 0.32f * s);
                var cone = Prim(PrimitiveType.Cylinder, g, p,
                                new Vector3(0.05f * s, 0.10f * s, 0.05f * s), m);
                cone.name = "Spike";
                if (it.gem != 0)
                    Prim(PrimitiveType.Sphere, g, p + Vector3.up * 0.11f,
                         new Vector3(0.05f * s, 0.05f * s, 0.05f * s), Sub(it.gem, 0.2f, 0.5f));
            }
        }

        void BuildHelmet(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Sphere, g, new Vector3(0, 0.06f, 0),
                 new Vector3(0.42f * s, 0.42f * s, 0.46f * s), m);
            if (it.visor != 0)
                Prim(PrimitiveType.Cube, g, new Vector3(0, 0.02f, 0.20f * s),
                     new Vector3(0.36f * s, 0.09f, 0.05f),
                     MakeMat(CosmeticItem.IntToColor(it.visor), 0.4f, 0.05f,
                             CosmeticItem.IntToColor(it.visor), 0.4f, 0.8f));
            if (it.crest != 0)
                Prim(PrimitiveType.Cube, g, new Vector3(0, 0.28f, 0),
                     new Vector3(0.035f, 0.13f * s, 0.36f * s), Sub(it.crest, 0.7f, 0f));
        }

        void BuildBeanie(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Sphere, g, new Vector3(0, 0.14f, 0),
                 new Vector3(0.38f * s, 0.30f * s, 0.38f * s), m);
            Prim(PrimitiveType.Cylinder, g, new Vector3(0, 0.06f, 0),
                 new Vector3(0.39f * s, 0.05f, 0.39f * s), m);
            if (it.pom != 0)
                Prim(PrimitiveType.Sphere, g, new Vector3(0, 0.36f, 0),
                     new Vector3(0.10f * s, 0.10f * s, 0.10f * s), Sub(it.pom, 0f, 0f));
        }

        void BuildGlasses(Transform g, CosmeticItem it, Material m, float s)
        {
            Color lens = it.lens != 0 ? CosmeticItem.IntToColor(it.lens) : Color.black;
            var lm = MakeMat(lens, 0.1f, 0.05f, lens, it.glow,
                             it.opacity > 0.001f ? it.opacity : 0.72f);
            foreach (float x in new[] { -0.11f, 0.11f })
            {
                Prim(PrimitiveType.Cylinder, g, new Vector3(x, 0.02f, 0.155f),
                     new Vector3(0.09f * s, 0.008f, 0.09f * s), lm,
                     new Vector3(90f, 0f, 0f));
                Prim(PrimitiveType.Cylinder, g, new Vector3(x, 0.02f, 0.15f),
                     new Vector3(0.10f * s, 0.006f, 0.10f * s), m,
                     new Vector3(90f, 0f, 0f));
            }
            Prim(PrimitiveType.Cube, g, new Vector3(0, 0.02f, 0.155f),
                 new Vector3(0.07f, 0.012f, 0.012f), m);
            foreach (float x in new[] { -0.20f, 0.20f })
                Prim(PrimitiveType.Cube, g, new Vector3(x, 0.02f, 0.05f),
                     new Vector3(0.012f, 0.012f, 0.20f), m);
        }

        void BuildVisor(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Cube, g, new Vector3(0, 0.03f, 0.16f),
                 new Vector3(0.40f * s, 0.09f, 0.04f), m);
            if (it.frame != 0)
                Prim(PrimitiveType.Cube, g, new Vector3(0, 0.09f, 0.16f),
                     new Vector3(0.42f * s, 0.022f, 0.05f), Sub(it.frame, 0.8f, 0f));
        }

        void BuildMask(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Sphere, g, new Vector3(0, 0f, 0.06f),
                 new Vector3(0.34f * s, 0.34f * s, 0.22f * s), m);
            if (it.eyes != 0)
                foreach (float x in new[] { -0.09f, 0.09f })
                    Prim(PrimitiveType.Sphere, g, new Vector3(x, 0.04f, 0.17f),
                         new Vector3(0.05f, 0.05f, 0.03f), Sub(it.eyes, 0f, 0.9f));
        }

        void BuildEarrings(Transform g, CosmeticItem it, Material m, float s)
        {
            foreach (float x in new[] { -0.19f, 0.19f })
            {
                Prim(PrimitiveType.Cylinder, g, new Vector3(x, -0.06f, 0),
                     new Vector3(0.045f * s, 0.008f, 0.045f * s), m,
                     new Vector3(0f, 0f, 90f));
                if (it.gem != 0)
                    Prim(PrimitiveType.Sphere, g, new Vector3(x, -0.12f, 0),
                         new Vector3(0.035f * s, 0.045f * s, 0.035f * s), Sub(it.gem, 0.2f, 0.5f));
            }
        }

        void BuildNecklace(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Necklace").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, TORSO_Y - 0.72f, 0.04f);
            int seg = 14;
            for (int i = 0; i < seg; i++)
            {
                float a = Mathf.PI * (0.12f + 0.76f * i / (seg - 1f));
                Prim(PrimitiveType.Sphere, root,
                     new Vector3(Mathf.Cos(a) * 0.15f * s, -Mathf.Sin(a) * 0.06f * s, 0.02f),
                     new Vector3(0.022f, 0.022f, 0.022f), m);
            }
            if (it.pendant != 0)
                Prim(PrimitiveType.Sphere, root, new Vector3(0, -0.10f, 0.05f),
                     new Vector3(0.05f * s, 0.06f * s, 0.05f * s), Sub(it.pendant, 0.25f, 0.5f));
        }

        void BuildWatch(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Watch").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0.22f, TORSO_Y - 0.42f, 0.02f);
            Prim(PrimitiveType.Cylinder, root, Vector3.zero,
                 new Vector3(0.05f, 0.012f, 0.05f),
                 it.band != 0 ? Sub(it.band, 0.2f, 0f) : m, new Vector3(0f, 0f, 90f));
            Prim(PrimitiveType.Cylinder, root, new Vector3(0.015f, 0, 0),
                 new Vector3(0.04f * s, 0.008f, 0.04f * s), m, new Vector3(0f, 0f, 90f));
        }

        void BuildWings(Transform g, CosmeticItem it, Material m, float s)
        {
            int seg = it.segments > 0 ? it.segments : 3;
            foreach (int sign in new[] { -1, 1 })
                for (int i = 0; i < seg; i++)
                {
                    float len = (0.5f - i * 0.09f) * s;
                    var go = Prim(PrimitiveType.Cube, g,
                        new Vector3(sign * (0.16f + len * 0.5f), 0.32f - i * 0.15f, -0.12f),
                        new Vector3(len, 0.045f, 0.02f), m);
                    go.transform.localEulerAngles =
                        new Vector3(0f, sign * 18f, sign * (24f - i * 9f));
                }
        }

        void BuildCape(Transform g, CosmeticItem it, Material m, float s)
        {
            var go = Prim(PrimitiveType.Cube, g, new Vector3(0, -0.1f, -0.16f),
                          new Vector3(0.5f * s, 0.85f * s, 0.03f), m);
            go.transform.localEulerAngles = new Vector3(-5f, 0f, 0f);
            if (it.collar != 0)
                Prim(PrimitiveType.Cube, g, new Vector3(0, 0.34f, -0.12f),
                     new Vector3(0.4f, 0.1f, 0.07f), Sub(it.collar, 0.4f, 0f));
        }

        void BuildBackpack(Transform g, CosmeticItem it, Material m, float s)
        {
            Prim(PrimitiveType.Cube, g, new Vector3(0, 0.05f, -0.20f),
                 new Vector3(0.34f * s, 0.42f * s, 0.18f * s), m);
            if (it.accent != 0)
            {
                Prim(PrimitiveType.Cube, g, new Vector3(0, -0.06f, -0.30f),
                     new Vector3(0.24f * s, 0.16f * s, 0.08f), Sub(it.accent, 0f, 0f));
                foreach (float x in new[] { -0.13f, 0.13f })
                    Prim(PrimitiveType.Cube, g, new Vector3(x, 0.14f, -0.10f),
                         new Vector3(0.05f, 0.34f, 0.03f), Sub(it.accent, 0f, 0f));
            }
        }

        void BuildHalo(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Halo").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, 0.42f, 0);
            int seg = 20;
            for (int i = 0; i < seg; i++)
            {
                float a = (i / (float)seg) * Mathf.PI * 2f;
                Prim(PrimitiveType.Sphere, root,
                     new Vector3(Mathf.Cos(a) * 0.26f * s, 0f, Mathf.Sin(a) * 0.26f * s),
                     new Vector3(0.035f, 0.02f, 0.035f), m);
            }
            var spin = root.gameObject.AddComponent<CosmeticSpin>();
            spin.speed = it.spin > 0.001f ? it.spin * 40f : 24f;
            spin.floatAmp = 0.02f;
        }

        void BuildAura(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Aura").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, 0.9f, 0);

            var sphereMat = MakeMat(it.UnityColor, 0f, 0.6f,
                it.emissive != 0 ? it.EmissiveColor : it.UnityColor,
                it.glow > 0.001f ? it.glow : 0.7f,
                it.opacity > 0.001f ? it.opacity : 0.16f);
            var sph = Prim(PrimitiveType.Sphere, root, Vector3.zero,
                           Vector3.one * 1.5f * s, sphereMat);
            sph.AddComponent<CosmeticPulse>().amp = 0.06f;

            int rings = it.rings > 0 ? it.rings : 2;
            for (int r = 0; r < rings; r++)
            {
                var ring = new GameObject("Ring" + r).transform;
                ring.SetParent(root, false);
                ring.localPosition = new Vector3(0, -0.7f + r * 0.45f, 0);
                int seg = 18;
                for (int i = 0; i < seg; i++)
                {
                    float a = (i / (float)seg) * Mathf.PI * 2f;
                    float rad = (0.5f + r * 0.18f) * s;
                    Prim(PrimitiveType.Sphere, ring,
                         new Vector3(Mathf.Cos(a) * rad, 0f, Mathf.Sin(a) * rad),
                         new Vector3(0.03f, 0.03f, 0.03f), sphereMat);
                }
                var sp = ring.gameObject.AddComponent<CosmeticSpin>();
                sp.speed = (r % 2 == 0 ? 30f : -30f) * (it.spin > 0.001f ? it.spin : 1f);
            }
        }

        void BuildHorns(Transform g, CosmeticItem it, Material m, float s)
        {
            foreach (int sign in new[] { -1, 1 })
            {
                var p = new Vector3(sign * 0.15f, 0.24f, 0);
                var cone = Prim(PrimitiveType.Cylinder, g, p,
                                new Vector3(0.05f * s, 0.13f * s, 0.05f * s), m);
                cone.transform.localEulerAngles = new Vector3(0f, 0f, sign * -24f);
                if (it.tips != 0)
                    Prim(PrimitiveType.Sphere, g, p + new Vector3(sign * 0.06f, 0.13f, 0),
                         new Vector3(0.032f, 0.032f, 0.032f), Sub(it.tips, 0f, 0.8f));
            }
        }

        void BuildEars(Transform g, CosmeticItem it, Material m, float s)
        {
            foreach (int sign in new[] { -1, 1 })
            {
                var p = new Vector3(sign * 0.14f, 0.24f, 0);
                var e = Prim(PrimitiveType.Cylinder, g, p,
                             new Vector3(0.09f * s, 0.11f * s, 0.06f * s), m);
                e.transform.localEulerAngles = new Vector3(0f, 0f, sign * -12f);
                if (it.inner != 0)
                    Prim(PrimitiveType.Cylinder, g, p + new Vector3(0, 0, 0.03f),
                         new Vector3(0.05f * s, 0.08f * s, 0.03f), Sub(it.inner, 0f, 0f));
            }
        }

        void BuildTail(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Tail").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, TORSO_Y - 0.55f, -0.18f);
            int seg = it.segments > 0 ? it.segments : 5;
            for (int i = 0; i < seg; i++)
            {
                float t = i / (float)seg;
                var node = Prim(PrimitiveType.Sphere, root,
                    new Vector3(0, -t * 0.22f, -t * 0.34f),
                    Vector3.one * (0.09f - t * 0.045f) * s * 2f, m);
                var w = node.AddComponent<CosmeticWag>();
                w.amp = 0.03f + t * 0.06f;
                w.phase = t * 1.4f;
            }
        }

        void BuildHandItem(Transform g, CosmeticItem it, Material m, float s)
        {
            PrimitiveType pt = it.shape == "sphere" ? PrimitiveType.Sphere
                             : it.shape == "cone" ? PrimitiveType.Cylinder
                             : PrimitiveType.Cube;
            Vector3 sc = it.shape == "sphere" ? Vector3.one * 0.14f * s
                       : it.shape == "cone" ? new Vector3(0.05f * s, 0.2f * s, 0.05f * s)
                       : new Vector3(0.06f * s, 0.3f * s, 0.06f * s);
            var go = Prim(pt, g, new Vector3(0.04f, -0.05f, 0.06f), sc, m);
            go.transform.localEulerAngles = new Vector3(12f, 0f, -10f);
        }

        void BuildShoulder(Transform g, CosmeticItem it, Material m, float s)
        {
            foreach (int sign in new[] { -1, 1 })
            {
                var p = new Vector3(sign * 0.26f, TORSO_Y - 0.62f, 0);
                Prim(PrimitiveType.Sphere, g, p,
                     new Vector3(0.17f * s, 0.13f * s, 0.17f * s), m);
                if (it.spike != 0)
                {
                    var sp = Prim(PrimitiveType.Cylinder, g, p + new Vector3(sign * 0.04f, 0.09f, 0),
                                  new Vector3(0.035f * s, 0.07f * s, 0.035f * s), Sub(it.spike, 0.9f, 0f));
                    sp.transform.localEulerAngles = new Vector3(0f, 0f, sign * -20f);
                }
            }
        }

        void BuildBelt(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Belt").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, TORSO_Y - 1.05f, 0);
            Prim(PrimitiveType.Cylinder, root, Vector3.zero,
                 new Vector3(0.3f * s, 0.04f, 0.22f * s), m);
            if (it.buckle != 0)
                Prim(PrimitiveType.Cube, root, new Vector3(0, 0, 0.2f * s),
                     new Vector3(0.09f, 0.07f, 0.03f), Sub(it.buckle, 0.95f, 0f));
        }

        void BuildScarf(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Scarf").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, TORSO_Y - 0.55f, 0);
            int seg = 12;
            for (int i = 0; i < seg; i++)
            {
                float a = (i / (float)seg) * Mathf.PI * 2f;
                Prim(PrimitiveType.Sphere, root,
                     new Vector3(Mathf.Cos(a) * 0.16f * s, 0f, Mathf.Sin(a) * 0.13f * s),
                     new Vector3(0.06f, 0.05f, 0.06f), m);
            }
            Prim(PrimitiveType.Cube, root, new Vector3(0.08f, -0.22f, 0.1f),
                 new Vector3(0.1f, 0.36f * s, 0.04f), m);
        }

        void BuildTrail(Transform g, CosmeticItem it, Material m, float s)
        {
            var root = new GameObject("Trail").transform;
            root.SetParent(g, false);
            root.localPosition = new Vector3(0, 0.25f, 0);
            var tm = MakeMat(it.UnityColor, 0f, 0.4f,
                it.emissive != 0 ? it.EmissiveColor : it.UnityColor,
                it.glow > 0.001f ? it.glow : 0.8f, 0.55f);
            for (int i = 0; i < 6; i++)
            {
                var p = Prim(PrimitiveType.Sphere, root, Vector3.zero,
                             Vector3.one * (0.08f - i * 0.008f) * s * 2f, tm);
                var o = p.AddComponent<CosmeticOrbit>();
                o.radius = 0.3f;
                o.angle = (i / 6f) * Mathf.PI * 2f;
                o.speed = 1.3f;
            }
        }
    }

    // ── Мелкие аниматоры: крутится, пульсирует, виляет, летает по орбите ──
    public class CosmeticSpin : MonoBehaviour
    {
        public float speed = 30f;
        public float floatAmp = 0f;
        float baseY;
        void Start() { baseY = transform.localPosition.y; }
        void Update()
        {
            transform.Rotate(Vector3.up, speed * Time.deltaTime, Space.Self);
            if (floatAmp > 0f)
            {
                var p = transform.localPosition;
                p.y = baseY + Mathf.Sin(Time.time * 2.2f) * floatAmp;
                transform.localPosition = p;
            }
        }
    }

    public class CosmeticPulse : MonoBehaviour
    {
        public float amp = 0.06f;
        Vector3 baseScale;
        void Start() { baseScale = transform.localScale; }
        void Update()
        {
            transform.localScale = baseScale * (1f + Mathf.Sin(Time.time * 1.8f) * amp);
        }
    }

    public class CosmeticWag : MonoBehaviour
    {
        public float amp = 0.05f, phase = 0f;
        Vector3 basePos;
        void Start() { basePos = transform.localPosition; }
        void Update()
        {
            var p = basePos;
            p.x += Mathf.Sin(Time.time * 3.4f + phase) * amp;
            transform.localPosition = p;
        }
    }

    public class CosmeticOrbit : MonoBehaviour
    {
        public float radius = 0.3f, angle = 0f, speed = 1.3f;
        void Update()
        {
            float t = Time.time * speed + angle;
            transform.localPosition = new Vector3(
                Mathf.Cos(t) * radius, 0f, Mathf.Sin(t) * radius * 0.5f - 0.2f);
        }
    }
}
