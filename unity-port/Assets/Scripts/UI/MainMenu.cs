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
            Core.UIState.CloseAll();   // мир загружен — отдаём управление
        }

        void SetProgress(float p, string text)
        {
            p = Mathf.Clamp01(p);
            if (barFill != null) barFill.sizeDelta = new Vector2(620f * p, 0f);
            if (progressText != null) progressText.text = text;
        }

        // ── НАСТРОЙКИ ──────────────────────────────────────────────────────
        GameObject settingsPanel;
        readonly List<Image> qualityBtns = new List<Image>();
        readonly List<Image> distBtns = new List<Image>();
        Text qualityHint;

        // Настройки строятся на canvas, а НЕ внутри root: root скрывается
        // при запуске игры, и панель вместе с ним исчезала — из-за этого
        // «графику нельзя было выбрать» после старта.
        void ToggleSettings()
        {
            if (settingsPanel != null)
            {
                bool on = !settingsPanel.activeSelf;
                settingsPanel.SetActive(on);
                Core.UIState.Toggle("settings", on);
                if (on) RefreshSettingsUI();
                return;
            }
            BuildSettings();
            Core.UIState.Open("settings");
            RefreshSettingsUI();
        }

        void BuildSettings()
        {
            var p = Panel("Settings", canvas.transform,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, Vector2.zero, new Color(0.04f, 0.03f, 0.1f, 0.98f));
            p.rectTransform.sizeDelta = new Vector2(640f, 520f);
            settingsPanel = p.gameObject;

            Label("SetTitle", p.transform, "НАСТРОЙКИ", 30, Color.white,
                  TextAnchor.MiddleCenter, new Vector2(0f, 216f),
                  new Vector2(560f, 50f), FontStyle.Bold);

            // ── КАЧЕСТВО ──
            Label("QLabel", p.transform, "Качество графики", 19,
                  new Color(0.78f, 0.76f, 1f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 152f), new Vector2(560f, 34f));

            string[] q = { "Низкое", "Среднее", "Высокое" };
            qualityBtns.Clear();
            for (int i = 0; i < 3; i++)
            {
                int lvl = i;
                var b = Btn(q[i], p.transform, new Vector2(-170f + i * 170f, 104f),
                    new Vector2(158f, 50f), new Color(0.15f, 0.14f, 0.26f),
                    Color.white, 18, () => SetQuality(lvl));
                qualityBtns.Add(b.targetGraphic as Image);
            }

            qualityHint = Label("QHint", p.transform, "", 15,
                  new Color(0.6f, 0.6f, 0.75f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 64f), new Vector2(580f, 30f));

            // ── ДАЛЬНОСТЬ ──
            Label("VLabel", p.transform, "Дальность прорисовки", 19,
                  new Color(0.78f, 0.76f, 1f), TextAnchor.MiddleCenter,
                  new Vector2(0f, 16f), new Vector2(560f, 34f));

            string[] v = { "Близко", "Средне", "Далеко" };
            float[] dist = { 140f, 240f, 380f };
            distBtns.Clear();
            for (int i = 0; i < 3; i++)
            {
                float d = dist[i];
                var b = Btn(v[i], p.transform, new Vector2(-170f + i * 170f, -32f),
                    new Vector2(158f, 50f), new Color(0.15f, 0.14f, 0.26f),
                    Color.white, 18, () => SetViewDistance(d));
                distBtns.Add(b.targetGraphic as Image);
            }

            // ── ТЕНИ ──
            Label("SLabel", p.transform, "Тени", 19,
                  new Color(0.78f, 0.76f, 1f), TextAnchor.MiddleCenter,
                  new Vector2(-150f, -104f), new Vector2(220f, 34f));
            Btn("ВКЛ / ВЫКЛ", p.transform, new Vector2(120f, -104f),
                new Vector2(220f, 46f), new Color(0.2f, 0.18f, 0.32f),
                Color.white, 17, ToggleShadows);

            Btn("ЗАКРЫТЬ", p.transform, new Vector2(0f, -196f),
                new Vector2(280f, 52f), new Color(0.32f, 0.28f, 0.5f),
                Color.white, 19, () => { settingsPanel.SetActive(false);
                                         Core.UIState.Close("settings"); });
        }

        // Подсветка выбранного варианта: без неё непонятно, сработало ли
        // нажатие — именно поэтому казалось, что «графика не выбирается».
        void RefreshSettingsUI()
        {
            int lvl = PlayerPrefs.GetInt("fz_quality", QualitySettings.GetQualityLevel());
            for (int i = 0; i < qualityBtns.Count; i++)
                if (qualityBtns[i] != null)
                    qualityBtns[i].color = (i == lvl)
                        ? new Color(0.42f, 0.36f, 0.91f)
                        : new Color(0.15f, 0.14f, 0.26f);

            float d = PlayerPrefs.GetFloat("fz_viewdist", 240f);
            int di = d < 180f ? 0 : (d < 310f ? 1 : 2);
            for (int i = 0; i < distBtns.Count; i++)
                if (distBtns[i] != null)
                    distBtns[i].color = (i == di)
                        ? new Color(0.42f, 0.36f, 0.91f)
                        : new Color(0.15f, 0.14f, 0.26f);

            if (qualityHint != null)
            {
                string[] hints = {
                    "Тени выключены, дальность меньше — для слабых телефонов",
                    "Баланс качества и скорости",
                    "Тени и полная детализация — для ПК"
                };
                qualityHint.text = hints[Mathf.Clamp(lvl, 0, 2)];
            }
        }

        void SetQuality(int level)
        {
            level = Mathf.Clamp(level, 0, 2);
            PlayerPrefs.SetInt("fz_quality", level);
            PlayerPrefs.Save();

            // Уровни Unity могут не совпадать по числу с нашими тремя,
            // поэтому применяем настройки руками, а не полагаемся на
            // QualitySettings.SetQualityLevel.
            int count = QualitySettings.names.Length;
            if (count > 0)
                QualitySettings.SetQualityLevel(
                    Mathf.Clamp(Mathf.RoundToInt(level / 2f * (count - 1)), 0, count - 1), true);

            // тени — самое дорогое на мобильных
            foreach (var l in FindObjectsOfType<Light>())
                if (l.type == LightType.Directional)
                    l.shadows = level == 0 ? LightShadows.None
                              : level == 1 ? LightShadows.Hard
                                           : LightShadows.Soft;

            QualitySettings.shadowDistance = level == 0 ? 0f : (level == 1 ? 40f : 90f);
            QualitySettings.pixelLightCount = level == 0 ? 1 : (level == 1 ? 2 : 4);
            QualitySettings.antiAliasing = level == 2 ? 2 : 0;
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = level == 0 ? 30 : 60;

            // разрешение рендера: главный рычаг для слабых телефонов
            float scale = level == 0 ? 0.75f : (level == 1 ? 1f : 1f);
            if (Application.isMobilePlatform)
                Screen.SetResolution(Mathf.RoundToInt(Screen.width * scale),
                                     Mathf.RoundToInt(Screen.height * scale), true);

            RefreshSettingsUI();
            Core.PlayerProfile.Notify("Качество: " +
                (level == 0 ? "низкое" : level == 1 ? "среднее" : "высокое"));
        }

        void SetViewDistance(float d)
        {
            PlayerPrefs.SetFloat("fz_viewdist", d);
            PlayerPrefs.Save();
            var wb = Fantazia.World.WorldBuilder.I;
            if (wb != null) wb.viewDistance = d;
            RenderSettings.fogEndDistance = d;
            RenderSettings.fogStartDistance = d * 0.35f;
            if (Camera.main != null) Camera.main.farClipPlane = d + 120f;
            RefreshSettingsUI();
            Core.PlayerProfile.Notify("Дальность: " + Mathf.RoundToInt(d) + " м");
        }

        void ToggleShadows()
        {
            bool on = PlayerPrefs.GetInt("fz_shadows", 1) == 1;
            on = !on;
            PlayerPrefs.SetInt("fz_shadows", on ? 1 : 0);
            foreach (var l in FindObjectsOfType<Light>())
                if (l.type == LightType.Directional)
                    l.shadows = on ? LightShadows.Soft : LightShadows.None;
            Core.PlayerProfile.Notify("Тени: " + (on ? "включены" : "выключены"));
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
            // Esc во время игры открывает настройки — иначе после старта
            // до них было не добраться вообще.
            if (GameStarted && Input.GetKeyDown(KeyCode.F1)) ToggleSettings();

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
