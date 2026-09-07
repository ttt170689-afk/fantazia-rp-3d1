// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ГЛАВНОЕ МЕНЮ
//
//  Повторяет экран из веб-версии: тёмный неоновый фон, крупный титул
//  FANTAZIA RP, подпись «3D · ONLINE», счётчики и кнопка ИГРАТЬ.
//
//  Почему меню отдельной сценой не сделано: .unity-сцену снаружи
//  редактора надёжно не сгенерировать. Поэтому меню строится кодом
//  поверх игры, а мир начинает грузиться только после нажатия ИГРАТЬ —
//  так первый кадр появляется мгновенно, а не через несколько секунд
//  чёрного экрана.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.Core;

namespace Fantazia.UI
{
    public class MainMenu : MonoBehaviour
    {
        public static MainMenu I { get; private set; }
        public static bool GameStarted { get; private set; }

        Canvas canvas;
        GameObject root;
        Text statusText, progressText;
        Slider progressBar;
        Font font;

        // фон: силуэты города, которые медленно едут
        readonly List<RectTransform> skyline = new List<RectTransform>();
        readonly List<Image> stars = new List<Image>();

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
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        // ── ХЕЛПЕРЫ ────────────────────────────────────────────────────────
        RectTransform Rect(string name, Transform parent, Vector2 aMin, Vector2 aMax,
                           Vector2 oMin, Vector2 oMax)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = aMin; rt.anchorMax = aMax;
            rt.offsetMin = oMin; rt.offsetMax = oMax;
            return rt;
        }

        Image Panel(string name, Transform parent, Vector2 aMin, Vector2 aMax,
                    Vector2 oMin, Vector2 oMax, Color color)
        {
            var rt = Rect(name, parent, aMin, aMax, oMin, oMax);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            return img;
        }

        Text Label(string name, Transform parent, string text, int size, Color color,
                   TextAnchor anchor, Vector2 pos, Vector2 sizeDelta, FontStyle style = FontStyle.Normal)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = sizeDelta;
            var t = go.AddComponent<Text>();
            t.font = font; t.fontSize = size; t.color = color;
            t.alignment = anchor; t.text = text; t.fontStyle = style;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        Button Btn(string label, Transform parent, Vector2 pos, Vector2 size,
                   Color bg, Color fg, int fontSize, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject("Btn_" + label);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = bg;
            var b = go.AddComponent<Button>();
            b.targetGraphic = img;
            if (onClick != null) b.onClick.AddListener(onClick);

            var colors = b.colors;
            colors.highlightedColor = new Color(bg.r * 1.35f, bg.g * 1.35f, bg.b * 1.35f, 1f);
            colors.pressedColor = new Color(bg.r * 0.75f, bg.g * 0.75f, bg.b * 0.75f, 1f);
            b.colors = colors;

            Label("Label", go.transform, label, fontSize, fg, TextAnchor.MiddleCenter,
                  Vector2.zero, size);
            return b;
        }

        // ── ПОСТРОЙКА МЕНЮ ─────────────────────────────────────────────────
        void Build()
        {
            var go = new GameObject("MainMenuCanvas");
            go.transform.SetParent(transform, false);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 1000;      // поверх всего
            go.AddComponent<GraphicRaycaster>();

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;

            if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() == null)
            {
                var es = new GameObject("EventSystem");
                es.AddComponent<UnityEngine.EventSystems.EventSystem>();
                es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
            }

            root = new GameObject("Root");
            root.transform.SetParent(canvas.transform, false);
            var rrt = root.AddComponent<RectTransform>();
            rrt.anchorMin = Vector2.zero; rrt.anchorMax = Vector2.one;
            rrt.offsetMin = Vector2.zero; rrt.offsetMax = Vector2.zero;

            BuildBackground();
            BuildHero();
            BuildStats();
            BuildButtons();
            BuildLoading();
        }

        // Тёмный градиент + звёзды + силуэты города. Как в вебе, только
        // на UI-элементах: рисовать canvas-текстуру в рантайме дороже.
        void BuildBackground()
        {
            Panel("BG", root.transform, Vector2.zero, Vector2.one,
                  Vector2.zero, Vector2.zero, new Color(0.02f, 0.01f, 0.06f, 1f));

            // фиолетовое зарево снизу
            Panel("Glow", root.transform, new Vector2(0f, 0f), new Vector2(1f, 0.55f),
                  Vector2.zero, Vector2.zero, new Color(0.42f, 0.24f, 0.9f, 0.13f));

            // звёзды
            for (int i = 0; i < 90; i++)
            {
                float s = Random.Range(1.5f, 3.5f);
                var img = Panel("Star", root.transform,
                    new Vector2(0f, 0f), new Vector2(0f, 0f),
                    Vector2.zero, Vector2.zero,
                    new Color(0.85f, 0.88f, 1f, Random.Range(0.15f, 0.6f)));
                var rt = img.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(Random.value, Random.Range(0.45f, 1f));
                rt.sizeDelta = new Vector2(s, s);
                stars.Add(img);
            }

            // силуэты домов
            float x = -60f;
            while (x < 2100f)
            {
                float w = Random.Range(50f, 130f);
                float h = Random.Range(90f, 340f);
                var img = Panel("Building", root.transform,
                    new Vector2(0f, 0f), new Vector2(0f, 0f),
                    Vector2.zero, Vector2.zero,
                    new Color(0.05f, 0.04f, 0.12f, 1f));
                var rt = img.rectTransform;
                rt.pivot = new Vector2(0f, 0f);
                rt.anchoredPosition = new Vector2(x, 0f);
                rt.sizeDelta = new Vector2(w, h);
                skyline.Add(rt);

                // светящиеся окна
                int rows = Mathf.Min(7, Mathf.FloorToInt(h / 42f));
                for (int r = 0; r < rows; r++)
                    for (int c = 0; c < 3; c++)
                        if (Random.value < 0.42f)
                        {
                            var win = Panel("W", img.transform,
                                new Vector2(0f, 0f), new Vector2(0f, 0f),
                                Vector2.zero, Vector2.zero,
                                new Color(1f, 0.82f, 0.45f, Random.Range(0.25f, 0.7f)));
                            var wrt = win.rectTransform;
                            wrt.pivot = new Vector2(0f, 0f);
                            wrt.anchoredPosition = new Vector2(12f + c * (w / 3.4f), 20f + r * 40f);
                            wrt.sizeDelta = new Vector2(9f, 13f);
                        }
                x += w + Random.Range(6f, 18f);
            }
        }

        void BuildHero()
        {
            // ⚡ как в вебе
            Label("Bolt", root.transform, "⚡", 88, new Color(0.75f, 0.72f, 1f),
                  TextAnchor.MiddleCenter, new Vector2(0f, 300f), new Vector2(200f, 120f));

            // FANTAZIA RP — двойной слой даёт неоновое свечение
            Label("TitleGlow", root.transform, "FANTAZIA RP", 96,
                  new Color(0.55f, 0.42f, 1f, 0.45f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 186f), new Vector2(1400f, 150f), FontStyle.Bold);
            Label("Title", root.transform, "FANTAZIA RP", 92, Color.white,
                  TextAnchor.MiddleCenter, new Vector2(0f, 190f),
                  new Vector2(1400f, 150f), FontStyle.Bold);

            Label("Sub", root.transform, "3 D   ·   O N L I N E", 22,
                  new Color(0.64f, 0.61f, 1f, 0.75f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 116f), new Vector2(900f, 50f));

            Label("Tagline", root.transform,
                  "Открытый мир  ·  Живые игроки  ·  Твои правила", 24,
                  new Color(1f, 1f, 1f, 0.55f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 72f), new Vector2(1100f, 50f));

            // индикатор «сервер онлайн»
            var badge = Panel("Live", root.transform,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, Vector2.zero, new Color(0.08f, 0.94f, 0.55f, 0.10f));
            badge.rectTransform.anchoredPosition = new Vector2(0f, 372f);
            badge.rectTransform.sizeDelta = new Vector2(300f, 40f);
            statusText = Label("LiveText", badge.transform, "● ОДИНОЧНАЯ ИГРА", 15,
                  new Color(0.49f, 1f, 0.75f), TextAnchor.MiddleCenter,
                  Vector2.zero, new Vector2(300f, 40f));
        }

        void BuildStats()
        {
            // счётчики из реальных данных игры, а не выдуманные
            string[,] data = {
                { "8",    "ЭТАЖЕЙ ТЦ" },
                { "379",  "ЗДАНИЙ" },
                { "206",  "ПРЕДМЕТОВ" },
                { "6",    "ЗАПИСОК" }
            };
            float startX = -390f;
            for (int i = 0; i < data.GetLength(0); i++)
            {
                float x = startX + i * 260f;
                Label("StatNum" + i, root.transform, data[i, 0], 44, Color.white,
                      TextAnchor.MiddleCenter, new Vector2(x, -196f),
                      new Vector2(240f, 60f), FontStyle.Bold);
                Label("StatCap" + i, root.transform, data[i, 1], 14,
                      new Color(0.64f, 0.61f, 1f, 0.6f), TextAnchor.MiddleCenter,
                      new Vector2(x, -238f), new Vector2(240f, 30f));
            }
        }

        void BuildButtons()
        {
            Btn("▶   И Г Р А Т Ь", root.transform, new Vector2(0f, -40f),
                new Vector2(420f, 82f),
                new Color(0.42f, 0.36f, 0.91f, 1f), Color.white, 30, StartGame);

            Btn("НАСТРОЙКИ", root.transform, new Vector2(-140f, -122f),
                new Vector2(260f, 54f),
                new Color(0.16f, 0.14f, 0.3f, 0.9f), new Color(0.84f, 0.82f, 1f), 19,
                ToggleSettings);

            Btn("ВЫЙТИ", root.transform, new Vector2(140f, -122f),
                new Vector2(260f, 54f),
                new Color(0.3f, 0.14f, 0.18f, 0.9f), new Color(1f, 0.82f, 0.84f), 19,
                Quit);

            Label("Hint", root.transform,
                  "WASD — ходьба   ·   E — взаимодействие   ·   F — машина   ·   B — магазин   ·   Q — квесты",
                  16, new Color(1f, 1f, 1f, 0.32f), TextAnchor.MiddleCenter,
                  new Vector2(0f, -320f), new Vector2(1500f, 40f));

            Label("Ver", root.transform, "v1.0  ·  порт с веб-версии", 14,
                  new Color(1f, 1f, 1f, 0.22f), TextAnchor.MiddleCenter,
                  new Vector2(0f, -352f), new Vector2(600f, 30f));
        }

        // Экран загрузки: без него игра «висит» на несколько секунд, пока
        // строится город, и кажется, что она сломалась.
        void BuildLoading()
        {
            var panel = Panel("Loading", canvas.transform,
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero,
                new Color(0.02f, 0.01f, 0.06f, 1f));
            panel.gameObject.SetActive(false);
            loadingPanel = panel.gameObject;

            Label("LoadTitle", panel.transform, "FANTAZIA RP", 64, Color.white,
                  TextAnchor.MiddleCenter, new Vector2(0f, 120f),
                  new Vector2(1200f, 100f), FontStyle.Bold);

            progressText = Label("LoadStatus", panel.transform, "Загрузка...", 22,
                  new Color(0.72f, 0.7f, 1f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 20f), new Vector2(1200f, 40f));

            // полоса прогресса
            var barBg = Panel("BarBG", panel.transform,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, Vector2.zero, new Color(1f, 1f, 1f, 0.09f));
            barBg.rectTransform.anchoredPosition = new Vector2(0f, -34f);
            barBg.rectTransform.sizeDelta = new Vector2(620f, 14f);

            var fill = Panel("BarFill", barBg.transform,
                new Vector2(0f, 0f), new Vector2(0f, 1f),
                Vector2.zero, Vector2.zero, new Color(0.48f, 0.4f, 1f, 1f));
            fill.rectTransform.pivot = new Vector2(0f, 0.5f);
            fill.rectTransform.anchoredPosition = Vector2.zero;
            fill.rectTransform.sizeDelta = new Vector2(0f, 0f);
            barFill = fill.rectTransform;
        }

        GameObject loadingPanel;
        RectTransform barFill;

        // ── ЗАПУСК ИГРЫ ────────────────────────────────────────────────────
        void StartGame()
        {
            if (GameStarted) return;
            GameStarted = true;
            StartCoroutine(LoadWorld());
        }

        IEnumerator LoadWorld()
        {
            root.SetActive(false);
            loadingPanel.SetActive(true);

            SetProgress(0.05f, "Подготовка мира...");
            yield return null;

            // Bootstrap ждёт этого флага и строит мир по частям
            var boot = FindObjectOfType<Bootstrap>();
            if (boot != null) boot.BeginWorld();

            // ждём, пока город достроится, и показываем реальный прогресс
            float t = 0f;
            while (t < 60f)
            {
                t += Time.deltaTime;
                var wb = Fantazia.World.WorldBuilder.I;
                if (wb != null)
                {
                    float p = wb.Progress;
                    SetProgress(0.05f + p * 0.9f,
                        p < 0.98f ? $"Строим город... {wb.meshesBuilt} объектов"
                                  : "Почти готово...");
                    if (wb.Done) break;
                }
                yield return null;
            }

            SetProgress(1f, "Готово!");
            yield return new WaitForSeconds(0.35f);

            loadingPanel.SetActive(false);
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        void SetProgress(float p, string text)
        {
            p = Mathf.Clamp01(p);
            if (barFill != null) barFill.sizeDelta = new Vector2(620f * p, 0f);
            if (progressText != null) progressText.text = text;
        }

        // ── НАСТРОЙКИ ──────────────────────────────────────────────────────
        GameObject settingsPanel;

        void ToggleSettings()
        {
            if (settingsPanel != null)
            {
                settingsPanel.SetActive(!settingsPanel.activeSelf);
                return;
            }

            var p = Panel("Settings", root.transform,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, Vector2.zero, new Color(0.04f, 0.03f, 0.1f, 0.97f));
            p.rectTransform.sizeDelta = new Vector2(560f, 400f);
            settingsPanel = p.gameObject;

            Label("SetTitle", p.transform, "НАСТРОЙКИ", 28, Color.white,
                  TextAnchor.MiddleCenter, new Vector2(0f, 158f),
                  new Vector2(500f, 50f), FontStyle.Bold);

            // качество: главный рычаг для слабых телефонов
            Label("QLabel", p.transform, "Качество графики", 18,
                  new Color(0.78f, 0.76f, 1f), TextAnchor.MiddleLeft,
                  new Vector2(-110f, 92f), new Vector2(300f, 34f));

            string[] q = { "Низкое", "Среднее", "Высокое" };
            for (int i = 0; i < 3; i++)
            {
                int lvl = i;
                Btn(q[i], p.transform, new Vector2(-150f + i * 150f, 46f),
                    new Vector2(140f, 44f),
                    QualitySettings.GetQualityLevel() == lvl
                        ? new Color(0.42f, 0.36f, 0.91f) : new Color(0.15f, 0.14f, 0.26f),
                    Color.white, 17, () => SetQuality(lvl));
            }

            Label("VLabel", p.transform, "Дальность прорисовки", 18,
                  new Color(0.78f, 0.76f, 1f), TextAnchor.MiddleLeft,
                  new Vector2(-110f, -14f), new Vector2(300f, 34f));

            string[] v = { "Близко", "Средне", "Далеко" };
            float[] dist = { 140f, 240f, 380f };
            for (int i = 0; i < 3; i++)
            {
                float d = dist[i];
                Btn(v[i], p.transform, new Vector2(-150f + i * 150f, -60f),
                    new Vector2(140f, 44f),
                    new Color(0.15f, 0.14f, 0.26f), Color.white, 17,
                    () => SetViewDistance(d));
            }

            Btn("ЗАКРЫТЬ", p.transform, new Vector2(0f, -152f),
                new Vector2(240f, 48f), new Color(0.22f, 0.2f, 0.34f),
                Color.white, 18, () => settingsPanel.SetActive(false));
        }

        void SetQuality(int level)
        {
            QualitySettings.SetQualityLevel(level, true);
            PlayerPrefs.SetInt("fz_quality", level);
            // на низком качестве отключаем тени — это самое дорогое
            foreach (var l in FindObjectsOfType<Light>())
                if (l.type == LightType.Directional)
                    l.shadows = level == 0 ? LightShadows.None : LightShadows.Soft;
        }

        void SetViewDistance(float d)
        {
            PlayerPrefs.SetFloat("fz_viewdist", d);
            var wb = Fantazia.World.WorldBuilder.I;
            if (wb != null) wb.viewDistance = d;
            RenderSettings.fogEndDistance = d;
        }

        void Quit()
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        // ── АНИМАЦИЯ ФОНА ──────────────────────────────────────────────────
        float t2;
        void Update()
        {
            if (GameStarted && (loadingPanel == null || !loadingPanel.activeSelf)) return;

            t2 += Time.deltaTime;

            // город медленно едет вбок
            for (int i = 0; i < skyline.Count; i++)
            {
                var rt = skyline[i];
                var p = rt.anchoredPosition;
                p.x -= Time.deltaTime * 7f;
                if (p.x < -220f) p.x += 2200f;
                rt.anchoredPosition = p;
            }

            // звёзды мерцают
            for (int i = 0; i < stars.Count; i++)
            {
                var c = stars[i].color;
                c.a = 0.18f + 0.42f * Mathf.Abs(Mathf.Sin(t2 * 1.1f + i * 0.7f));
                stars[i].color = c;
            }

            // статус сервера
            if (statusText != null && Fantazia.Net.NetClient.I != null)
            {
                statusText.text = Fantazia.Net.NetClient.I.Connected
                    ? "● СЕРВЕР ОНЛАЙН" : "● ОДИНОЧНАЯ ИГРА";
            }
        }
    }
}
