// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ИНТЕРФЕЙС
//
//  Весь UI строится КОДОМ, без готовых префабов. Причина та же, что со
//  сценой: .prefab снаружи редактора надёжно не сгенерировать, а так
//  проект запускается сразу после копирования файлов.
//
//  Что здесь: полоски денег/монет/уровня, подсказка взаимодействия,
//  уведомления (со схлопыванием дублей, как в вебе v53), панель лифта
//  на 8 этажей, магазин косметики на 206 предметов, список квестов.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.Core;
using Fantazia.World;

namespace Fantazia.UI
{
    public class HUD : MonoBehaviour
    {
        public static HUD I { get; private set; }

        Canvas canvas;
        Text moneyText, coinsText, levelText, floorText, hintText;
        RectTransform toastRoot, elevatorPanel, shopPanel, questPanel;
        readonly List<GameObject> toasts = new List<GameObject>();
        string lastToast = "";
        float lastToastTime;
        int toastRepeat = 1;
        Text lastToastLabel;

        static Font uiFont;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            // LegacyRuntime — единственный шрифт, доступный без импорта
            // ассетов. Работает в любом свежем Unity, включая 6.
            uiFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (uiFont == null) uiFont = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        void Start()
        {
            BuildCanvas();
            BuildTopBar();
            BuildHint();
            BuildToasts();
            BuildElevator();
            BuildShop();
            BuildQuests();

            if (PlayerProfile.I != null)
            {
                PlayerProfile.I.OnChanged += Refresh;
                Refresh();
            }
        }

        // ── КАРКАС ─────────────────────────────────────────────────────────
        void BuildCanvas()
        {
            var go = new GameObject("HUDCanvas");
            go.transform.SetParent(transform, false);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();

            if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() == null)
            {
                var es = new GameObject("EventSystem");
                es.AddComponent<UnityEngine.EventSystems.EventSystem>();
                es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
            }
        }

        // ── ХЕЛПЕРЫ ────────────────────────────────────────────────────────
        RectTransform Panel(Transform parent, Vector2 anchorMin, Vector2 anchorMax,
                            Vector2 offMin, Vector2 offMax, Color color, string name = "Panel")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = anchorMin; rt.anchorMax = anchorMax;
            rt.offsetMin = offMin; rt.offsetMax = offMax;
            var img = go.AddComponent<Image>();
            img.color = color;
            return rt;
        }

        Text Label(Transform parent, string txt, int size, Color color,
                   TextAnchor anchor = TextAnchor.MiddleLeft)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(10, 0); rt.offsetMax = new Vector2(-10, 0);
            var t = go.AddComponent<Text>();
            t.font = uiFont; t.fontSize = size; t.color = color;
            t.alignment = anchor; t.text = txt;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        Button Btn(Transform parent, string txt, Vector2 pos, Vector2 size,
                   Color bg, UnityEngine.Events.UnityAction onClick, int fontSize = 22)
        {
            var go = new GameObject("Btn_" + txt);
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
            Label(go.transform, txt, fontSize, Color.white, TextAnchor.MiddleCenter);
            return b;
        }

        // ── ВЕРХНЯЯ ПАНЕЛЬ ─────────────────────────────────────────────────
        void BuildTopBar()
        {
            var bar = Panel(canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(-460, -74), new Vector2(460, -12),
                new Color(0.06f, 0.05f, 0.12f, 0.82f), "TopBar");

            var m = Panel(bar, new Vector2(0, 0), new Vector2(0.25f, 1), Vector2.zero, Vector2.zero,
                new Color(0.1f, 0.35f, 0.2f, 0.55f), "Money");
            moneyText = Label(m, "1000 $", 26, new Color(0.6f, 1f, 0.7f), TextAnchor.MiddleCenter);

            var c = Panel(bar, new Vector2(0.25f, 0), new Vector2(0.5f, 1), Vector2.zero, Vector2.zero,
                new Color(0.4f, 0.3f, 0.05f, 0.55f), "Coins");
            coinsText = Label(c, "50 🪙", 26, new Color(1f, 0.85f, 0.45f), TextAnchor.MiddleCenter);

            var l = Panel(bar, new Vector2(0.5f, 0), new Vector2(0.72f, 1), Vector2.zero, Vector2.zero,
                new Color(0.25f, 0.2f, 0.45f, 0.55f), "Level");
            levelText = Label(l, "Ур. 1", 26, new Color(0.85f, 0.8f, 1f), TextAnchor.MiddleCenter);

            var f = Panel(bar, new Vector2(0.72f, 0), new Vector2(1f, 1f), Vector2.zero, Vector2.zero,
                new Color(0.15f, 0.15f, 0.25f, 0.55f), "Floor");
            floorText = Label(f, "Город", 22, new Color(0.8f, 0.85f, 1f), TextAnchor.MiddleCenter);

            // боковые кнопки
            Btn(canvas.transform, "🛍 Магазин", new Vector2(-820, 380), new Vector2(190, 54),
                new Color(0.35f, 0.25f, 0.6f, 0.9f), ToggleShop, 20);
            Btn(canvas.transform, "⚡ Квесты", new Vector2(-820, 316), new Vector2(190, 54),
                new Color(0.25f, 0.35f, 0.6f, 0.9f), ToggleQuests, 20);
            Btn(canvas.transform, "🚪 Выйти", new Vector2(-820, 252), new Vector2(190, 54),
                new Color(0.6f, 0.25f, 0.25f, 0.9f), () => InteriorManager.I?.Exit(), 20);
        }

        void BuildHint()
        {
            var p = Panel(canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(-260, 120), new Vector2(260, 176),
                new Color(0f, 0f, 0f, 0.72f), "Hint");
            hintText = Label(p, "", 24, Color.white, TextAnchor.MiddleCenter);
            p.gameObject.SetActive(false);
        }

        void BuildToasts()
        {
            toastRoot = Panel(canvas.transform, new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(-430, -560), new Vector2(-20, -90),
                new Color(0, 0, 0, 0), "Toasts");
            var vlg = toastRoot.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.childAlignment = TextAnchor.UpperRight;
            vlg.spacing = 6;
            vlg.childControlHeight = false; vlg.childForceExpandHeight = false;
        }

        // ── УВЕДОМЛЕНИЯ (с фиксом дублей из v53) ───────────────────────────
        public void Toast(string text)
        {
            if (string.IsNullOrEmpty(text) || toastRoot == null) return;

            // одинаковые схлопываем в счётчик — иначе экран заливает плашками
            if (text == lastToast && Time.time - lastToastTime < 3f && lastToastLabel != null)
            {
                toastRepeat++;
                lastToastLabel.text = text + "  ×" + toastRepeat;
                lastToastTime = Time.time;
                return;
            }

            var go = new GameObject("Toast");
            go.transform.SetParent(toastRoot, false);
            var rt = go.AddComponent<RectTransform>();
            rt.sizeDelta = new Vector2(400, 46);
            var img = go.AddComponent<Image>();
            img.color = new Color(0.07f, 0.06f, 0.14f, 0.9f);
            var t = Label(go.transform, text, 20, Color.white, TextAnchor.MiddleCenter);

            toasts.Add(go);
            lastToast = text; lastToastTime = Time.time;
            toastRepeat = 1; lastToastLabel = t;

            // не больше 5 на экране
            while (toasts.Count > 5)
            {
                if (toasts[0] != null) Destroy(toasts[0]);
                toasts.RemoveAt(0);
            }
            StartCoroutine(RemoveToast(go, 3.2f));
        }

        IEnumerator RemoveToast(GameObject go, float delay)
        {
            yield return new WaitForSeconds(delay);
            toasts.Remove(go);
            if (go != null) Destroy(go);
        }

        // ── ПАНЕЛЬ ЛИФТА: все 8 этажей ─────────────────────────────────────
        void BuildElevator()
        {
            elevatorPanel = Panel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(-190, -280), new Vector2(190, 280),
                new Color(0.05f, 0.05f, 0.1f, 0.95f), "Elevator");

            Label(Panel(elevatorPanel, new Vector2(0, 1), new Vector2(1, 1),
                        new Vector2(0, -56), new Vector2(0, 0),
                        new Color(0.15f, 0.13f, 0.3f, 1f), "Head").transform,
                  "🛗 ЛИФТ", 26, Color.white, TextAnchor.MiddleCenter);

            string[] labels = { "B5", "B4", "B3", "B2", "B1", "1", "2", "3" };
            for (int i = 0; i < 8; i++)
            {
                int floor = 7 - i;             // сверху вниз: 3, 2, 1, B1...
                float y = 190f - i * 56f;
                Btn(elevatorPanel, labels[floor], new Vector2(0, y), new Vector2(300, 48),
                    floor >= 5 ? new Color(0.2f, 0.4f, 0.3f, 0.9f)
                               : new Color(0.4f, 0.2f, 0.2f, 0.9f),
                    () => { InteriorManager.I?.GoToFloor(floor); ToggleElevator(); }, 22);
            }
            Btn(elevatorPanel, "Закрыть", new Vector2(0, -238), new Vector2(300, 44),
                new Color(0.3f, 0.3f, 0.35f, 0.9f), ToggleElevator, 20);

            elevatorPanel.gameObject.SetActive(false);
        }

        public void ToggleElevator()
        {
            if (elevatorPanel == null) return;
            bool on = !elevatorPanel.gameObject.activeSelf;
            elevatorPanel.gameObject.SetActive(on);
            Cursor.lockState = on ? CursorLockMode.None : CursorLockMode.Locked;
        }

        // ── МАГАЗИН КОСМЕТИКИ (206 предметов) ──────────────────────────────
        ScrollRect shopScroll;
        RectTransform shopContent;

        void BuildShop()
        {
            shopPanel = Panel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(-420, -320), new Vector2(420, 320),
                new Color(0.05f, 0.05f, 0.1f, 0.96f), "Shop");

            Label(Panel(shopPanel, new Vector2(0, 1), new Vector2(1, 1),
                        new Vector2(0, -54), new Vector2(0, 0),
                        new Color(0.2f, 0.14f, 0.35f, 1f), "Head").transform,
                  "🛍 КОСМЕТИКА", 26, Color.white, TextAnchor.MiddleCenter);

            var viewport = Panel(shopPanel, new Vector2(0, 0), new Vector2(1, 1),
                new Vector2(8, 56), new Vector2(-8, -58), new Color(0, 0, 0, 0.2f), "Viewport");
            viewport.gameObject.AddComponent<Mask>().showMaskGraphic = false;

            var content = new GameObject("Content");
            content.transform.SetParent(viewport, false);
            shopContent = content.AddComponent<RectTransform>();
            shopContent.anchorMin = new Vector2(0, 1); shopContent.anchorMax = new Vector2(1, 1);
            shopContent.pivot = new Vector2(0.5f, 1f);
            var vlg = content.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = 4; vlg.childControlHeight = false; vlg.childForceExpandHeight = false;
            var fitter = content.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            shopScroll = shopPanel.gameObject.AddComponent<ScrollRect>();
            shopScroll.viewport = viewport;
            shopScroll.content = shopContent;
            shopScroll.horizontal = false;
            shopScroll.scrollSensitivity = 28f;

            Btn(shopPanel, "Закрыть", new Vector2(0, -286), new Vector2(240, 42),
                new Color(0.3f, 0.3f, 0.35f, 0.9f), ToggleShop, 20);

            shopPanel.gameObject.SetActive(false);
        }

        void FillShop()
        {
            if (shopContent == null || GameData.I == null) return;
            foreach (Transform ch in shopContent) Destroy(ch.gameObject);

            // показываем первые 60 — иначе 206 строк создадут заметный фриз
            var items = GameData.I.Cosmetics;
            int shown = Mathf.Min(items.Count, 60);

            for (int i = 0; i < shown; i++)
            {
                var it = items[i];
                var row = new GameObject("Item_" + it.id);
                row.transform.SetParent(shopContent, false);
                var rt = row.AddComponent<RectTransform>();
                rt.sizeDelta = new Vector2(0, 46);
                var img = row.AddComponent<Image>();

                Color rc = new Color(0.6f, 0.6f, 0.65f);
                if (GameData.I.Rarities.TryGetValue(it.rarity, out var rd))
                    ColorUtility.TryParseHtmlString(rd.color, out rc);
                img.color = new Color(rc.r * 0.28f, rc.g * 0.28f, rc.b * 0.28f, 0.85f);

                bool owned = PlayerProfile.I != null && PlayerProfile.I.Owns(it.id);
                string label = $"{it.emoji} {it.name}   [{it.rarity}]   {it.coinPrice}🪙" +
                               (owned ? "   ✓" : "");
                Label(row.transform, label, 18, owned ? new Color(0.6f, 1f, 0.7f) : Color.white);

                var b = row.AddComponent<Button>();
                b.targetGraphic = img;
                string id = it.id;
                b.onClick.AddListener(() =>
                {
                    if (PlayerProfile.I == null) return;
                    if (PlayerProfile.I.Owns(id)) PlayerProfile.I.Equip(id);
                    else if (PlayerProfile.I.Buy(id))
                    {
                        QuestSystem.I?.Progress("style", 1);
                        PlayerProfile.I.Equip(id);
                    }
                    FillShop();
                });
            }
        }

        public void ToggleShop()
        {
            if (shopPanel == null) return;
            bool on = !shopPanel.gameObject.activeSelf;
            shopPanel.gameObject.SetActive(on);
            if (on) FillShop();
            Cursor.lockState = on ? CursorLockMode.None : CursorLockMode.Locked;
        }

        // ── КВЕСТЫ ─────────────────────────────────────────────────────────
        RectTransform questContent;

        void BuildQuests()
        {
            questPanel = Panel(canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f),
                new Vector2(-420, -220), new Vector2(-20, 220),
                new Color(0.05f, 0.05f, 0.12f, 0.94f), "Quests");

            Label(Panel(questPanel, new Vector2(0, 1), new Vector2(1, 1),
                        new Vector2(0, -48), new Vector2(0, 0),
                        new Color(0.18f, 0.16f, 0.34f, 1f), "Head").transform,
                  "⚡ КВЕСТЫ", 24, Color.white, TextAnchor.MiddleCenter);

            var content = new GameObject("Content");
            content.transform.SetParent(questPanel, false);
            questContent = content.AddComponent<RectTransform>();
            questContent.anchorMin = new Vector2(0, 0); questContent.anchorMax = new Vector2(1, 1);
            questContent.offsetMin = new Vector2(8, 46); questContent.offsetMax = new Vector2(-8, -52);
            var vlg = content.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = 5; vlg.childControlHeight = false; vlg.childForceExpandHeight = false;

            Btn(questPanel, "Закрыть", new Vector2(0, -190), new Vector2(240, 40),
                new Color(0.3f, 0.3f, 0.35f, 0.9f), ToggleQuests, 18);

            questPanel.gameObject.SetActive(false);
        }

        void FillQuests()
        {
            if (questContent == null || QuestSystem.I == null) return;
            foreach (Transform ch in questContent) Destroy(ch.gameObject);

            foreach (var q in QuestSystem.I.quests)
            {
                var row = new GameObject("Q_" + q.id);
                row.transform.SetParent(questContent, false);
                var rt = row.AddComponent<RectTransform>();
                rt.sizeDelta = new Vector2(0, 58);
                var img = row.AddComponent<Image>();
                bool ready = !q.done && q.progress >= q.target;
                img.color = q.done ? new Color(0.1f, 0.3f, 0.15f, 0.8f)
                          : ready ? new Color(0.35f, 0.3f, 0.08f, 0.85f)
                                  : new Color(0.12f, 0.12f, 0.2f, 0.8f);

                string status = q.done ? "✅ выполнен" : $"{q.progress}/{q.target}";
                Label(row.transform, $"{q.name}\n{q.desc}  —  {status}", 16, Color.white);

                if (ready)
                {
                    var b = row.AddComponent<Button>();
                    b.targetGraphic = img;
                    string id = q.id;
                    b.onClick.AddListener(() => { QuestSystem.I.Claim(id); FillQuests(); });
                }
            }
        }

        public void ToggleQuests()
        {
            if (questPanel == null) return;
            bool on = !questPanel.gameObject.activeSelf;
            questPanel.gameObject.SetActive(on);
            if (on) FillQuests();
        }

        // ── ОБНОВЛЕНИЕ ─────────────────────────────────────────────────────
        public void Refresh()
        {
            var p = PlayerProfile.I;
            if (p == null) return;
            if (moneyText != null) moneyText.text = p.money + " $";
            if (coinsText != null) coinsText.text = p.coins + " 🪙";
            if (levelText != null) levelText.text = $"Ур. {p.level}  ({p.exp}/{p.ExpForNext})";
        }

        void Update()
        {
            // подсказка взаимодействия
            if (hintText != null && Interaction.I != null)
            {
                var n = Interaction.I.Nearest;
                var panel = hintText.transform.parent.gameObject;
                if (n != null)
                {
                    if (!panel.activeSelf) panel.SetActive(true);
                    hintText.text = $"[E]  {n.name}";
                }
                else if (panel.activeSelf) panel.SetActive(false);
            }

            // где мы находимся
            if (floorText != null && InteriorManager.I != null)
            {
                if (InteriorManager.I.inside)
                {
                    var labels = InteriorManager.I.FloorLabels;
                    int f = InteriorManager.I.currentFloor;
                    floorText.text = InteriorManager.I.buildingType == "mall" && f < labels.Length
                        ? $"🏬 GRAND MALL · {labels[f]}"
                        : "🏠 " + InteriorManager.I.buildingType;
                }
                else floorText.text = "🌆 Город";
            }

            // горячие клавиши
            if (Input.GetKeyDown(KeyCode.B)) ToggleShop();
            if (Input.GetKeyDown(KeyCode.Q)) ToggleQuests();
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                if (shopPanel != null && shopPanel.gameObject.activeSelf) ToggleShop();
                else if (elevatorPanel != null && elevatorPanel.gameObject.activeSelf) ToggleElevator();
            }
        }
    }
}
