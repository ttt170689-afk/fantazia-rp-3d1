// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ИГРОВОЕ МЕНЮ (Tab)
//
//  Одно окно с вкладками вместо россыпи кнопок по углам экрана:
//  Персонаж, Магазин, Квесты, Работа, Питомцы, Банк, Пропуск.
//
//  Строится кодом — префабы снаружи редактора не сгенерировать.
//  Вкладки создаются лениво: содержимое собирается при первом открытии,
//  иначе старт игры проседал бы на семь панелей сразу.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.Core;

namespace Fantazia.UI
{
    public class GameMenu : MonoBehaviour
    {
        public static GameMenu I { get; private set; }

        Canvas canvas;
        GameObject window;
        RectTransform tabBar, content;
        readonly Dictionary<string, GameObject> pages = new Dictionary<string, GameObject>();
        readonly Dictionary<string, Image> tabButtons = new Dictionary<string, Image>();
        string currentTab = "";
        Font font;
        bool open;

        static readonly Color BG     = new Color(0.045f, 0.04f, 0.10f, 0.985f);
        static readonly Color PANEL  = new Color(0.09f, 0.08f, 0.17f, 1f);
        static readonly Color ACCENT = new Color(0.45f, 0.35f, 0.95f, 1f);
        static readonly Color TXT    = new Color(0.93f, 0.92f, 1f, 1f);
        static readonly Color DIM    = new Color(0.62f, 0.60f, 0.78f, 1f);

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font == null) font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        void Start() { Build(); Close(); }

        // ── ХЕЛПЕРЫ ────────────────────────────────────────────────────────
        RectTransform Rect(string n, Transform p, Vector2 pos, Vector2 size)
        {
            var go = new GameObject(n);
            go.transform.SetParent(p, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        Image Box(string n, Transform p, Vector2 pos, Vector2 size, Color c)
        {
            var rt = Rect(n, p, pos, size);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = c;
            return img;
        }

        Text Label(string n, Transform p, Vector2 pos, Vector2 size, string text,
                   int fs, Color c, TextAnchor a = TextAnchor.MiddleLeft, FontStyle st = FontStyle.Normal)
        {
            var rt = Rect(n, p, pos, size);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = font; t.fontSize = fs; t.color = c; t.text = text;
            t.alignment = a; t.fontStyle = st;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        Button Btn(string label, Transform p, Vector2 pos, Vector2 size,
                   Color bg, int fs, UnityEngine.Events.UnityAction cb)
        {
            var img = Box("B_" + label, p, pos, size, bg);
            var b = img.gameObject.AddComponent<Button>();
            b.targetGraphic = img;
            if (cb != null) b.onClick.AddListener(cb);
            var col = b.colors;
            col.highlightedColor = new Color(bg.r * 1.4f + 0.05f, bg.g * 1.4f + 0.05f, bg.b * 1.4f + 0.05f, 1f);
            col.pressedColor = new Color(bg.r * 0.7f, bg.g * 0.7f, bg.b * 0.7f, 1f);
            b.colors = col;
            Label("L", img.transform, Vector2.zero, size, label, fs, TXT, TextAnchor.MiddleCenter);
            return b;
        }

        // ── КАРКАС ─────────────────────────────────────────────────────────
        void Build()
        {
            var go = new GameObject("GameMenuCanvas");
            go.transform.SetParent(transform, false);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 200;
            go.AddComponent<GraphicRaycaster>();
            var sc = go.AddComponent<CanvasScaler>();
            sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            sc.referenceResolution = new Vector2(1920, 1080);
            sc.matchWidthOrHeight = 0.5f;

            // затемнение фона
            var dim = Box("Dim", canvas.transform, Vector2.zero, Vector2.zero,
                          new Color(0f, 0f, 0f, 0.65f));
            dim.rectTransform.anchorMin = Vector2.zero;
            dim.rectTransform.anchorMax = Vector2.one;
            dim.rectTransform.offsetMin = Vector2.zero;
            dim.rectTransform.offsetMax = Vector2.zero;

            window = Box("Window", canvas.transform, Vector2.zero,
                         new Vector2(1280f, 760f), BG).gameObject;

            // шапка с градиентной полосой
            Box("HeadBar", window.transform, new Vector2(0f, 340f),
                new Vector2(1280f, 80f), new Color(0.16f, 0.12f, 0.34f, 1f));
            Box("HeadLine", window.transform, new Vector2(0f, 300f),
                new Vector2(1280f, 3f), ACCENT);
            Label("Title", window.transform, new Vector2(-520f, 340f), new Vector2(500f, 50f),
                  "FANTAZIA RP", 30, TXT, TextAnchor.MiddleLeft, FontStyle.Bold);

            // деньги и монеты в шапке
            moneyLabel = Label("Money", window.transform, new Vector2(330f, 340f),
                               new Vector2(240f, 40f), "", 22, new Color(0.55f, 1f, 0.7f),
                               TextAnchor.MiddleRight);
            coinsLabel = Label("Coins", window.transform, new Vector2(520f, 340f),
                               new Vector2(200f, 40f), "", 22, new Color(1f, 0.85f, 0.45f),
                               TextAnchor.MiddleRight);

            Btn("✕", window.transform, new Vector2(608f, 340f), new Vector2(48f, 48f),
                new Color(0.5f, 0.2f, 0.25f, 1f), 24, Close);

            // вкладки слева
            tabBar = Rect("TabBar", window.transform, new Vector2(-530f, -30f),
                          new Vector2(200f, 620f));

            string[,] tabs = {
                { "char",  "👤  Персонаж" },
                { "shop",  "🛍  Магазин" },
                { "quest", "⚡  Квесты" },
                { "job",   "💼  Работа" },
                { "pet",   "🐾  Питомцы" },
                { "bank",  "🏦  Банк" },
                { "pass",  "🏆  Пропуск" }
            };
            for (int i = 0; i < tabs.GetLength(0); i++)
            {
                string id = tabs[i, 0];
                var img = Box("Tab_" + id, tabBar, new Vector2(0f, 260f - i * 74f),
                              new Vector2(200f, 64f), PANEL);
                var b = img.gameObject.AddComponent<Button>();
                b.targetGraphic = img;
                b.onClick.AddListener(() => ShowTab(id));
                Label("L", img.transform, new Vector2(6f, 0f), new Vector2(190f, 64f),
                      tabs[i, 1], 19, TXT, TextAnchor.MiddleLeft);
                tabButtons[id] = img;
            }

            content = Rect("Content", window.transform, new Vector2(120f, -30f),
                           new Vector2(1000f, 620f));

            ShowTab("char");
        }

        Text moneyLabel, coinsLabel;

        // ── ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ───────────────────────────────────────────
        void ShowTab(string id)
        {
            currentTab = id;
            foreach (var kv in pages) kv.Value.SetActive(kv.Key == id);
            foreach (var kv in tabButtons)
                kv.Value.color = (kv.Key == id) ? ACCENT : PANEL;

            if (!pages.ContainsKey(id))
            {
                // Собираем страницу при первом показе: строить все семь
                // сразу — лишняя работа на старте.
                var page = Rect("Page_" + id, content, Vector2.zero, new Vector2(1000f, 620f)).gameObject;
                pages[id] = page;
                switch (id)
                {
                    case "char":  BuildChar(page.transform);  break;
                    case "shop":  BuildShop(page.transform);  break;
                    case "quest": BuildQuests(page.transform); break;
                    case "job":   BuildJobs(page.transform);  break;
                    case "pet":   BuildPets(page.transform);  break;
                    case "bank":  BuildBank(page.transform);  break;
                    case "pass":  BuildPass(page.transform);  break;
                }
            }
            else Refresh(id);
        }

        // ── ВКЛАДКА: ПЕРСОНАЖ ──────────────────────────────────────────────
        void BuildChar(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "ВНЕШНОСТЬ ПЕРСОНАЖА", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);

            string[,] rows = {
                { "skin",  "Цвет кожи" },
                { "hair",  "Волосы" },
                { "shirt", "Рубашка" },
                { "pants", "Брюки" }
            };
            for (int i = 0; i < rows.GetLength(0); i++)
            {
                string key = rows[i, 0];
                float y = 170f - i * 82f;
                Box("Row", p, new Vector2(0f, y), new Vector2(760f, 68f), PANEL);
                Label("N", p, new Vector2(-320f, y), new Vector2(300f, 40f),
                      rows[i, 1], 21, TXT);
                Btn("◀", p, new Vector2(120f, y), new Vector2(60f, 48f),
                    new Color(0.2f, 0.18f, 0.35f), 22, () => Cycle(key, -1));
                var sw = Box("SW_" + key, p, new Vector2(210f, y), new Vector2(110f, 48f), Color.white);
                swatches[key] = sw;
                Btn("▶", p, new Vector2(300f, y), new Vector2(60f, 48f),
                    new Color(0.2f, 0.18f, 0.35f), 22, () => Cycle(key, 1));
            }

            Label("Stats", p, new Vector2(0f, -190f), new Vector2(900f, 120f),
                  "", 19, DIM, TextAnchor.UpperCenter);
            charStats = p.Find("Stats").GetComponent<Text>();
            RefreshChar();
        }

        readonly Dictionary<string, Image> swatches = new Dictionary<string, Image>();
        Text charStats;

        void Cycle(string what, int dir)
        {
            AppearanceSystem.I?.Cycle(what, dir);
            AudioFX.Play("buttonClick");
            RefreshChar();
        }

        void RefreshChar()
        {
            var a = AppearanceSystem.I;
            if (a == null) return;
            if (swatches.TryGetValue("skin", out var s1))  s1.color = AppearanceSystem.Skins[a.skinIdx];
            if (swatches.TryGetValue("hair", out var s2))  s2.color = AppearanceSystem.Hairs[a.hairIdx];
            if (swatches.TryGetValue("shirt", out var s3)) s3.color = AppearanceSystem.Shirts[a.shirtIdx];
            if (swatches.TryGetValue("pants", out var s4)) s4.color = AppearanceSystem.Pants[a.pantsIdx];

            var pr = PlayerProfile.I;
            if (charStats != null && pr != null)
                charStats.text =
                    $"Уровень {pr.level}   ·   опыт {pr.exp}/{pr.ExpForNext}\n" +
                    $"Работа: {pr.jobTitle}\n" +
                    $"Косметики собрано: {pr.ownedCosmetics.Count} из {GameData.I?.Cosmetics.Count ?? 0}";
        }

        // ── ВКЛАДКА: МАГАЗИН ───────────────────────────────────────────────
        RectTransform shopList;
        int shopPage;
        Text shopPageLabel;

        void BuildShop(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "МАГАЗИН КОСМЕТИКИ", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);

            shopList = Rect("List", p, new Vector2(0f, -10f), new Vector2(940f, 480f));

            Btn("◀ Назад", p, new Vector2(-200f, -272f), new Vector2(170f, 46f),
                new Color(0.2f, 0.18f, 0.35f), 18, () => { shopPage = Mathf.Max(0, shopPage - 1); RefreshShop(); });
            shopPageLabel = Label("PG", p, new Vector2(0f, -272f), new Vector2(220f, 40f),
                  "", 19, DIM, TextAnchor.MiddleCenter);
            Btn("Вперёд ▶", p, new Vector2(200f, -272f), new Vector2(170f, 46f),
                new Color(0.2f, 0.18f, 0.35f), 18, () => { shopPage++; RefreshShop(); });

            Btn("🎁 Открыть коробку — 150 монет", p, new Vector2(0f, 232f),
                new Vector2(420f, 50f), new Color(0.45f, 0.25f, 0.6f), 18, OpenBox);

            RefreshShop();
        }

        void OpenBox()
        {
            LootboxSystem.I?.Open();
            RefreshShop();
        }

        const int PER_PAGE = 12;

        void RefreshShop()
        {
            if (shopList == null || GameData.I == null) return;
            foreach (Transform t in shopList) Destroy(t.gameObject);

            var items = GameData.I.Cosmetics;
            int total = Mathf.CeilToInt(items.Count / (float)PER_PAGE);
            shopPage = Mathf.Clamp(shopPage, 0, Mathf.Max(0, total - 1));
            if (shopPageLabel != null) shopPageLabel.text = $"{shopPage + 1} / {total}";

            int start = shopPage * PER_PAGE;
            for (int i = 0; i < PER_PAGE; i++)
            {
                int idx = start + i;
                if (idx >= items.Count) break;
                var it = items[idx];

                int col = i % 2, row = i / 2;
                float x = col == 0 ? -235f : 235f;
                float y = 205f - row * 78f;

                Color rc = new Color(0.5f, 0.5f, 0.6f);
                if (GameData.I.Rarities.TryGetValue(it.rarity, out var rd))
                    ColorUtility.TryParseHtmlString(rd.color, out rc);

                bool owned = PlayerProfile.I != null && PlayerProfile.I.Owns(it.id);
                var card = Box("Card", shopList, new Vector2(x, y), new Vector2(450f, 70f),
                    new Color(rc.r * 0.22f, rc.g * 0.22f, rc.b * 0.22f, 0.95f));

                // цветная полоска редкости слева
                Box("Rar", card.transform, new Vector2(-218f, 0f), new Vector2(8f, 70f), rc);

                Label("N", card.transform, new Vector2(-30f, 12f), new Vector2(380f, 30f),
                      $"{it.emoji}  {it.name}", 18, TXT);
                Label("R", card.transform, new Vector2(-30f, -14f), new Vector2(380f, 26f),
                      it.rarity + (owned ? "   ·   куплено" : $"   ·   {it.coinPrice} 🪙"),
                      15, owned ? new Color(0.5f, 1f, 0.65f) : DIM);

                var b = card.gameObject.AddComponent<Button>();
                b.targetGraphic = card;
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
                    RefreshShop();
                });
            }
        }

        // ── ВКЛАДКА: КВЕСТЫ ────────────────────────────────────────────────
        RectTransform questList;

        void BuildQuests(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "КВЕСТЫ И СЮЖЕТ", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);
            questList = Rect("List", p, new Vector2(0f, -20f), new Vector2(940f, 520f));
            RefreshQuests();
        }

        void RefreshQuests()
        {
            if (questList == null) return;
            foreach (Transform t in questList) Destroy(t.gameObject);

            float y = 230f;

            // сюжетная линия сверху — она главная
            var chain = QuestChain.I;
            if (chain != null)
            {
                var card = Box("Story", questList, new Vector2(0f, y), new Vector2(900f, 96f),
                               new Color(0.22f, 0.14f, 0.30f, 0.95f));
                Label("N", card.transform, new Vector2(-260f, 26f), new Vector2(600f, 30f),
                      "📜  СЮЖЕТ: Дневник смотрителя", 21, new Color(1f, 0.85f, 0.5f));
                string state = chain.bossDead ? "Завершён"
                             : chain.boardsBroken ? "Спуститесь к боссу в ТЦ"
                             : chain.hasAxe ? "Сломайте доски на 1 этаже GRAND MALL"
                             : chain.NotesFound >= 6 ? "Найдите топор в офисной башне"
                             : $"Найдено записок: {chain.NotesFound} из 6";
                Label("S", card.transform, new Vector2(-260f, -10f), new Vector2(600f, 26f),
                      state, 17, DIM);
                y -= 112f;
            }

            if (QuestSystem.I == null) return;
            foreach (var q in QuestSystem.I.quests)
            {
                bool ready = !q.done && q.progress >= q.target;
                var card = Box("Q", questList, new Vector2(0f, y), new Vector2(900f, 78f),
                    q.done  ? new Color(0.10f, 0.26f, 0.15f, 0.9f)
                  : ready   ? new Color(0.32f, 0.26f, 0.08f, 0.95f)
                            : PANEL);

                Label("N", card.transform, new Vector2(-250f, 18f), new Vector2(580f, 28f),
                      q.name, 20, TXT);
                Label("D", card.transform, new Vector2(-250f, -12f), new Vector2(580f, 24f),
                      $"{q.desc}   ·   {q.progress}/{q.target}", 16, DIM);
                Label("R", card.transform, new Vector2(300f, 0f), new Vector2(200f, 30f),
                      $"+{q.rewardXp} XP  +{q.rewardCoins}🪙", 16,
                      new Color(1f, 0.85f, 0.45f), TextAnchor.MiddleRight);

                if (ready)
                {
                    var b = card.gameObject.AddComponent<Button>();
                    b.targetGraphic = card;
                    string id = q.id;
                    b.onClick.AddListener(() => { QuestSystem.I.Claim(id); RefreshQuests(); });
                }
                y -= 90f;
            }
        }

        // ── ВКЛАДКА: РАБОТА ────────────────────────────────────────────────
        RectTransform jobList;

        void BuildJobs(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "БИРЖА ТРУДА", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);
            jobList = Rect("List", p, new Vector2(0f, -10f), new Vector2(940f, 500f));
            Btn("Уволиться", p, new Vector2(0f, -272f), new Vector2(240f, 48f),
                new Color(0.45f, 0.2f, 0.22f), 18, () => { JobService.I?.Quit(); RefreshJobs(); });
            RefreshJobs();
        }

        void RefreshJobs()
        {
            if (jobList == null || JobService.I == null) return;
            foreach (Transform t in jobList) Destroy(t.gameObject);

            float y = 210f;
            foreach (var kv in JobService.I.Jobs)
            {
                bool active = JobService.I.CurrentJob == kv.Key;
                var card = Box("J", jobList, new Vector2(0f, y), new Vector2(880f, 74f),
                               active ? new Color(0.14f, 0.30f, 0.20f, 0.95f) : PANEL);

                Color jc = Color.white;
                if (!string.IsNullOrEmpty(kv.Value.color))
                    ColorUtility.TryParseHtmlString(kv.Value.color, out jc);
                Box("C", card.transform, new Vector2(-425f, 0f), new Vector2(10f, 74f), jc);

                Label("N", card.transform, new Vector2(-240f, 14f), new Vector2(560f, 28f),
                      kv.Value.title + (active ? "   ·   вы здесь работаете" : ""), 20, TXT);
                Label("S", card.transform, new Vector2(-240f, -14f), new Vector2(560f, 24f),
                      $"{kv.Value.salary}$ за смену (30 секунд)", 16, DIM);

                if (!active)
                {
                    var b = card.gameObject.AddComponent<Button>();
                    b.targetGraphic = card;
                    string id = kv.Key;
                    b.onClick.AddListener(() => { JobService.I.Take(id); RefreshJobs(); });
                }
                y -= 84f;
            }
        }

        // ── ВКЛАДКА: ПИТОМЦЫ ───────────────────────────────────────────────
        RectTransform petList;

        void BuildPets(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "ПИТОМЦЫ", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);
            petList = Rect("List", p, new Vector2(0f, -10f), new Vector2(940f, 500f));
            RefreshPets();
        }

        void RefreshPets()
        {
            if (petList == null || PetService.I == null) return;
            foreach (Transform t in petList) Destroy(t.gameObject);

            float y = 200f;
            foreach (var pet in PetService.I.Types)
            {
                bool owned = PetService.I.OwnedType == pet.type;
                var card = Box("P", petList, new Vector2(0f, y), new Vector2(880f, 78f),
                               owned ? new Color(0.14f, 0.28f, 0.22f, 0.95f) : PANEL);

                Color pc = Color.gray;
                if (!string.IsNullOrEmpty(pet.color)) ColorUtility.TryParseHtmlString(pet.color, out pc);
                Box("C", card.transform, new Vector2(-425f, 0f), new Vector2(10f, 78f), pc);

                Label("N", card.transform, new Vector2(-240f, 16f), new Vector2(560f, 28f),
                      pet.name + (owned ? "   ·   с вами" : ""), 20, TXT);
                Label("S", card.transform, new Vector2(-240f, -14f), new Vector2(560f, 24f),
                      $"{pet.price}$", 16, DIM);

                if (!owned)
                {
                    var b = card.gameObject.AddComponent<Button>();
                    b.targetGraphic = card;
                    string tp = pet.type;
                    b.onClick.AddListener(() => { PetService.I.Adopt(tp); RefreshPets(); });
                }
                y -= 88f;
            }
        }

        // ── ВКЛАДКА: БАНК ──────────────────────────────────────────────────
        Text bankInfo;

        void BuildBank(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "БАНК", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);

            Box("Card", p, new Vector2(0f, 130f), new Vector2(700f, 130f), PANEL);
            bankInfo = Label("Info", p, new Vector2(0f, 130f), new Vector2(680f, 110f),
                  "", 21, TXT, TextAnchor.MiddleCenter);

            int[] sums = { 100, 500, 1000 };
            for (int i = 0; i < sums.Length; i++)
            {
                int v = sums[i];
                Btn($"Вложить {v}$", p, new Vector2(-230f + i * 230f, 10f),
                    new Vector2(210f, 52f), new Color(0.18f, 0.35f, 0.24f), 18,
                    () => { BankSystem.I?.Deposit(v); RefreshBank(); });
                Btn($"Снять {v}$", p, new Vector2(-230f + i * 230f, -60f),
                    new Vector2(210f, 52f), new Color(0.35f, 0.24f, 0.18f), 18,
                    () => { BankSystem.I?.Withdraw(v); RefreshBank(); });
            }

            Label("H2", p, new Vector2(0f, -140f), new Vector2(900f, 40f),
                  "СПОРТЗАЛ", 24, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);
            Btn("💪 Тренироваться  (+25 опыта)", p, new Vector2(0f, -200f),
                new Vector2(420f, 54f), new Color(0.32f, 0.22f, 0.45f), 19,
                () => GymSystem.I?.Workout());

            RefreshBank();
        }

        void RefreshBank()
        {
            if (bankInfo == null) return;
            int dep = BankSystem.I != null ? BankSystem.I.deposit : 0;
            bankInfo.text = $"На счету: {dep}$\nНачисляется 1% каждую минуту";
        }

        // ── ВКЛАДКА: ПРОПУСК ───────────────────────────────────────────────
        Text passInfo;
        RectTransform passBar;

        void BuildPass(Transform p)
        {
            Label("H", p, new Vector2(0f, 270f), new Vector2(900f, 44f),
                  "FANTAZIA PASS", 26, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);

            Box("Card", p, new Vector2(0f, 150f), new Vector2(760f, 150f),
                new Color(0.20f, 0.13f, 0.34f, 1f));
            passInfo = Label("Info", p, new Vector2(0f, 168f), new Vector2(720f, 60f),
                  "", 24, TXT, TextAnchor.MiddleCenter, FontStyle.Bold);

            var bg = Box("BarBG", p, new Vector2(0f, 112f), new Vector2(640f, 20f),
                         new Color(1f, 1f, 1f, 0.10f));
            var fill = Box("BarFill", bg.transform, Vector2.zero, Vector2.zero, ACCENT);
            passBar = fill.rectTransform;
            passBar.anchorMin = new Vector2(0f, 0f);
            passBar.anchorMax = new Vector2(0f, 1f);
            passBar.pivot = new Vector2(0f, 0.5f);
            passBar.anchoredPosition = Vector2.zero;

            Btn("🎁 Забрать ежедневную награду", p, new Vector2(0f, 10f),
                new Vector2(460f, 56f), new Color(0.45f, 0.32f, 0.18f), 19,
                () => { ProgressionSystem.I?.ClaimDaily(); RefreshPass(); });

            Label("Hint", p, new Vector2(0f, -90f), new Vector2(860f, 120f),
                  "Опыт пропуска даётся за квесты, находки и ежедневный вход.\n" +
                  "Каждый уровень — 25 монет.", 18, DIM, TextAnchor.UpperCenter);

            RefreshPass();
        }

        void RefreshPass()
        {
            var pg = ProgressionSystem.I;
            if (pg == null || passInfo == null) return;
            passInfo.text = $"Уровень {pg.passLevel}   ·   {pg.passXp} / {pg.XpPerLevel} XP" +
                            (pg.claimedToday ? "" : "\nЕсть неполученная награда!");
            if (passBar != null)
                passBar.sizeDelta = new Vector2(640f * (pg.passXp / (float)pg.XpPerLevel), 0f);
        }

        // ── ОБЩЕЕ ──────────────────────────────────────────────────────────
        void Refresh(string tab)
        {
            switch (tab)
            {
                case "char":  RefreshChar();   break;
                case "shop":  RefreshShop();   break;
                case "quest": RefreshQuests(); break;
                case "job":   RefreshJobs();   break;
                case "pet":   RefreshPets();   break;
                case "bank":  RefreshBank();   break;
                case "pass":  RefreshPass();   break;
            }
        }

        public void Open()
        {
            open = true;
            canvas.gameObject.SetActive(true);
            UIState.Open("gamemenu");
            Refresh(currentTab);
            UpdateHeader();
        }

        public void Close()
        {
            open = false;
            canvas.gameObject.SetActive(false);
            UIState.Close("gamemenu");
        }

        public void Toggle() { if (open) Close(); else Open(); }

        void UpdateHeader()
        {
            var pr = PlayerProfile.I;
            if (pr == null) return;
            if (moneyLabel != null) moneyLabel.text = pr.money + " $";
            if (coinsLabel != null) coinsLabel.text = pr.coins + " 🪙";
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Tab)) Toggle();
            if (open && Input.GetKeyDown(KeyCode.Escape)) Close();
            if (open) UpdateHeader();
        }
    }
}
