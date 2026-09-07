// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ДОПОЛНЕНИЯ
//  Миникарта, компас, счётчик FPS, экранные подсказки и указатель цели.
//  Всё строится кодом и работает без единого ассета.
//
//  Каждый элемент дёшев по кадру: миникарта рисуется точками на UI
//  (не второй камерой — она удвоила бы нагрузку на телефоне),
//  подсказки обновляются раз в полсекунды, а не каждый кадр.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.Core;
using Fantazia.World;

namespace Fantazia.UI
{
    public class Extras : MonoBehaviour
    {
        public static Extras I { get; private set; }

        [Header("Миникарта")]
        public float mapRange = 160f;      // сколько метров попадает в круг
        public int maxDots = 90;           // потолок точек, чтобы не тормозило

        Canvas canvas;
        RectTransform mapRoot, playerArrow;
        readonly List<Image> dots = new List<Image>();
        Text fpsText, compassText, hintText;
        Transform player;
        Font font;

        float fpsAccum;
        int fpsFrames;
        float mapTimer, hintTimer;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font == null) font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        void Start()
        {
            Build();
        }

        // ── ХЕЛПЕРЫ ────────────────────────────────────────────────────────
        Image Box(string name, Transform parent, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = c;
            img.raycastTarget = false;
            return img;
        }

        Text Txt(string name, Transform parent, Vector2 pos, Vector2 size,
                 string text, int fontSize, Color c, TextAnchor anchor)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var t = go.AddComponent<Text>();
            t.font = font; t.fontSize = fontSize; t.color = c;
            t.text = text; t.alignment = anchor;
            t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            return t;
        }

        void Build()
        {
            var go = new GameObject("ExtrasCanvas");
            go.transform.SetParent(transform, false);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 95;      // под окнами, над игрой

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;

            // ── МИНИКАРТА в правом верхнем углу ──
            var holder = new GameObject("MiniMap");
            holder.transform.SetParent(canvas.transform, false);
            mapRoot = holder.AddComponent<RectTransform>();
            mapRoot.anchorMin = mapRoot.anchorMax = new Vector2(1f, 1f);
            mapRoot.anchoredPosition = new Vector2(-160f, -170f);
            mapRoot.sizeDelta = new Vector2(260f, 260f);
            var bg = holder.AddComponent<Image>();
            bg.color = new Color(0.03f, 0.04f, 0.09f, 0.72f);
            bg.raycastTarget = false;

            // рамка
            Box("MapEdgeT", mapRoot, new Vector2(0f, 130f), new Vector2(260f, 3f),
                new Color(0.45f, 0.4f, 0.85f, 0.7f));
            Box("MapEdgeB", mapRoot, new Vector2(0f, -130f), new Vector2(260f, 3f),
                new Color(0.45f, 0.4f, 0.85f, 0.7f));
            Box("MapEdgeL", mapRoot, new Vector2(-130f, 0f), new Vector2(3f, 260f),
                new Color(0.45f, 0.4f, 0.85f, 0.7f));
            Box("MapEdgeR", mapRoot, new Vector2(130f, 0f), new Vector2(3f, 260f),
                new Color(0.45f, 0.4f, 0.85f, 0.7f));

            // игрок в центре
            playerArrow = Box("You", mapRoot, Vector2.zero, new Vector2(11f, 11f),
                new Color(0.4f, 1f, 0.55f, 1f)).rectTransform;

            compassText = Txt("Compass", mapRoot, new Vector2(0f, 112f),
                new Vector2(250f, 26f), "С", 17, new Color(0.85f, 0.85f, 1f),
                TextAnchor.MiddleCenter);

            // ── FPS ──
            fpsText = Txt("FPS", canvas.transform, Vector2.zero, new Vector2(180f, 28f),
                "", 16, new Color(0.55f, 1f, 0.7f), TextAnchor.MiddleLeft);
            var frt = fpsText.rectTransform;
            frt.anchorMin = frt.anchorMax = new Vector2(0f, 1f);
            frt.anchoredPosition = new Vector2(110f, -22f);

            // ── ПОДСКАЗКА снизу ──
            hintText = Txt("Hint", canvas.transform, Vector2.zero, new Vector2(1200f, 30f),
                "", 18, new Color(1f, 1f, 1f, 0.55f), TextAnchor.MiddleCenter);
            var hrt = hintText.rectTransform;
            hrt.anchorMin = hrt.anchorMax = new Vector2(0.5f, 0f);
            hrt.anchoredPosition = new Vector2(0f, 42f);
        }

        // ── ПОДСКАЗКИ ──────────────────────────────────────────────────────
        // Меняются по кругу: игрок не запомнит десяток клавиш сразу.
        static readonly string[] HINTS = {
            "E — войти в здание, поехать на лифте, поднять записку",
            "F — сесть в машину, F ещё раз — выйти",
            "B — магазин косметики, там 206 предметов",
            "Q — квесты и награды",
            "V — вид от первого лица",
            "F1 — настройки графики, если тормозит",
            "Ctrl — присесть, Shift — бежать",
            "Найди 6 записок дневника, чтобы открыть путь к боссу",
            "Enter — чат"
        };
        int hintIdx;

        void Update()
        {
            // FPS усредняем за полсекунды — иначе цифра прыгает
            fpsAccum += Time.unscaledDeltaTime;
            fpsFrames++;
            if (fpsAccum >= 0.5f)
            {
                int fps = Mathf.RoundToInt(fpsFrames / fpsAccum);
                if (fpsText != null)
                {
                    fpsText.text = fps + " FPS";
                    fpsText.color = fps >= 50 ? new Color(0.5f, 1f, 0.65f)
                                  : fps >= 28 ? new Color(1f, 0.85f, 0.4f)
                                              : new Color(1f, 0.45f, 0.45f);
                }
                fpsAccum = 0f; fpsFrames = 0;
            }

            // подсказка меняется раз в 9 секунд
            hintTimer += Time.deltaTime;
            if (hintTimer >= 9f)
            {
                hintTimer = 0f;
                hintIdx = (hintIdx + 1) % HINTS.Length;
                if (hintText != null) hintText.text = HINTS[hintIdx];
            }

            if (player == null)
            {
                var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc != null) player = pc.transform;
                return;
            }

            // компас
            if (compassText != null)
            {
                float yaw = player.eulerAngles.y;
                string dir = yaw < 45f || yaw >= 315f ? "С"
                           : yaw < 135f ? "В"
                           : yaw < 225f ? "Ю" : "З";
                compassText.text = dir + "  " + Mathf.RoundToInt(yaw) + "°";
            }

            // Миникарта обновляется 4 раза в секунду. Каждый кадр —
            // расточительство: точек до 90, и все они пересчитываются.
            mapTimer += Time.deltaTime;
            if (mapTimer < 0.25f) return;
            mapTimer = 0f;
            UpdateMap();
        }

        void UpdateMap()
        {
            if (mapRoot == null || WorldBuilder.I == null) return;

            // в интерьере карта города бесполезна — прячем
            bool inside = InteriorManager.I != null && InteriorManager.I.inside;
            mapRoot.gameObject.SetActive(!inside);
            if (inside) return;

            var buildings = WorldBuilder.I.Interactables;
            if (buildings == null) return;

            Vector3 p = player.position;
            float yaw = player.eulerAngles.y * Mathf.Deg2Rad;
            float cos = Mathf.Cos(-yaw), sin = Mathf.Sin(-yaw);
            float scale = 118f / mapRange;

            int used = 0;
            for (int i = 0; i < buildings.Count && used < maxDots; i++)
            {
                var b = buildings[i];
                float dx = b.x - p.x, dz = b.z - p.z;
                if (dx * dx + dz * dz > mapRange * mapRange) continue;

                // поворачиваем карту вместе с игроком
                float rx = dx * cos - dz * sin;
                float rz = dx * sin + dz * cos;

                Image dot;
                if (used < dots.Count) dot = dots[used];
                else
                {
                    dot = Box("Dot", mapRoot, Vector2.zero, new Vector2(7f, 7f), Color.white);
                    dots.Add(dot);
                }
                dot.gameObject.SetActive(true);
                dot.rectTransform.anchoredPosition = new Vector2(rx * scale, rz * scale);
                dot.color = ColorFor(b.type);
                used++;
            }
            for (int i = used; i < dots.Count; i++) dots[i].gameObject.SetActive(false);
        }

        static Color ColorFor(string type)
        {
            if (string.IsNullOrEmpty(type)) return new Color(0.7f, 0.7f, 0.75f, 0.8f);
            if (type.Contains("mall")) return new Color(1f, 0.55f, 0.9f);
            if (type.Contains("house") || type.Contains("apart")) return new Color(0.55f, 0.85f, 1f);
            if (type.Contains("office")) return new Color(0.6f, 0.7f, 1f);
            if (type.Contains("shop")) return new Color(1f, 0.85f, 0.4f);
            if (type.Contains("job")) return new Color(0.5f, 1f, 0.6f);
            if (type.Contains("club") || type.Contains("cinema")) return new Color(0.85f, 0.5f, 1f);
            if (type.Contains("bank")) return new Color(1f, 0.9f, 0.5f);
            if (type.Contains("hospital")) return new Color(1f, 0.5f, 0.5f);
            return new Color(0.75f, 0.75f, 0.8f, 0.85f);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ВЫНОСЛИВОСТЬ
    //  Бег не бесконечный: полоска тратится на спринте и восстанавливается
    //  в покое. Без неё Shift просто зажимался навсегда.
    // ═══════════════════════════════════════════════════════════════════════
    public class Stamina : MonoBehaviour
    {
        public static Stamina I { get; private set; }

        public float max = 100f;
        public float current = 100f;
        public float drainPerSec = 18f;
        public float regenPerSec = 12f;
        public float regenDelay = 1.2f;

        float idleTimer;
        Image barFill;
        RectTransform barRoot;
        Fantazia.Player.PlayerController pc;

        public bool CanSprint => current > 5f;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        void Start() { Build(); }

        void Build()
        {
            var go = new GameObject("StaminaCanvas");
            go.transform.SetParent(transform, false);
            var c = go.AddComponent<Canvas>();
            c.renderMode = RenderMode.ScreenSpaceOverlay;
            c.sortingOrder = 94;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);

            var bgGO = new GameObject("BarBG");
            bgGO.transform.SetParent(go.transform, false);
            barRoot = bgGO.AddComponent<RectTransform>();
            barRoot.anchorMin = barRoot.anchorMax = new Vector2(0.5f, 0f);
            barRoot.anchoredPosition = new Vector2(0f, 96f);
            barRoot.sizeDelta = new Vector2(320f, 12f);
            var bgImg = bgGO.AddComponent<Image>();
            bgImg.color = new Color(0f, 0f, 0f, 0.45f);
            bgImg.raycastTarget = false;

            var fillGO = new GameObject("Fill");
            fillGO.transform.SetParent(bgGO.transform, false);
            var frt = fillGO.AddComponent<RectTransform>();
            frt.anchorMin = new Vector2(0f, 0f); frt.anchorMax = new Vector2(0f, 1f);
            frt.pivot = new Vector2(0f, 0.5f);
            frt.anchoredPosition = Vector2.zero;
            frt.sizeDelta = new Vector2(320f, 0f);
            barFill = fillGO.AddComponent<Image>();
            barFill.color = new Color(0.45f, 0.9f, 1f, 0.9f);
            barFill.raycastTarget = false;

            barRoot.gameObject.SetActive(false);
        }

        void Update()
        {
            if (pc == null)
            {
                pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc == null) return;
            }

            bool sprinting = pc.IsRunning && pc.IsMoving;
            if (sprinting && current > 0f)
            {
                current -= drainPerSec * Time.deltaTime;
                idleTimer = 0f;
                if (current <= 0f)
                {
                    current = 0f;
                    // выдохся — сбрасываем спринт, иначе бежал бы на нуле
                    pc.MobileSprint = false;
                }
            }
            else
            {
                idleTimer += Time.deltaTime;
                if (idleTimer > regenDelay && current < max)
                    current = Mathf.Min(max, current + regenPerSec * Time.deltaTime);
            }

            // полоску показываем только когда она не полная
            bool show = current < max - 0.5f;
            if (barRoot != null && barRoot.gameObject.activeSelf != show)
                barRoot.gameObject.SetActive(show);

            if (barFill != null)
            {
                barFill.rectTransform.sizeDelta = new Vector2(320f * (current / max), 0f);
                barFill.color = current < 25f
                    ? new Color(1f, 0.5f, 0.4f, 0.9f)
                    : new Color(0.45f, 0.9f, 1f, 0.9f);
            }
        }
    }
}
