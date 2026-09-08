// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — АВТОСБОРКА СЦЕНЫ
//
//  Зачем: Unity-сцены хранятся в бинарно-подобном YAML, который нельзя
//  надёжно сгенерировать текстом снаружи редактора. Поэтому вместо
//  готовой .unity-сцены проект собирает себя сам при запуске: создаёт
//  игрока, камеру, свет, землю и UI.
//
//  Как пользоваться: создайте пустую сцену, повесьте этот скрипт на
//  пустой GameObject и нажмите Play. Всё остальное появится само.
//  Дальше можно заменять примитивы на свои модели.
// ═══════════════════════════════════════════════════════════════════════════
using UnityEngine;
using Fantazia.Player;
using Fantazia.Cosmetics;
using Fantazia.Net;
using Fantazia.World;
using Fantazia.UI;

namespace Fantazia.Core
{
    public class Bootstrap : MonoBehaviour
    {
        [Header("Что создавать")]
        public bool spawnPlayer = true;
        public bool spawnGround = true;
        public bool spawnLights = true;
        public bool buildWorld = true;         // город из захваченных данных
        public bool spawnUI = true;            // HUD, магазин, квесты, лифт
        public bool connectToServer = false;   // включите, когда сервер запущен

        [Header("Сервер")]
        public string serverHost = "localhost";
        public int serverPort = 3000;

        [Header("Меню")]
        [Tooltip("Показать главное меню при запуске. Выключите, чтобы сразу в игру.")]
        public bool showMainMenu = true;

        [Header("Тест косметики")]
        [Tooltip("Наденет предмет по id при старте, например crown_god")]
        public string testCosmetic = "";

        GameObject player;

        void Awake()
        {
            // Данные игры — первым делом, остальное на них опирается
            if (GameData.I == null)
            {
                var go = new GameObject("GameData");
                go.AddComponent<GameData>();
            }
        }

        void Start()
        {
            // Свет, земля и игрок — дёшево, создаём сразу.
            if (spawnLights) BuildLights();
            if (spawnGround) BuildGround();
            if (spawnPlayer) BuildPlayer();

            if (showMainMenu)
            {
                // Мир НЕ строим, пока не нажали ИГРАТЬ: 7045 объектов
                // на старте давали несколько секунд чёрного экрана.
                var menuGO = new GameObject("MainMenu");
                menuGO.AddComponent<UI.MainMenu>();
                // игрока замораживаем, чтобы он не падал под меню
                if (player != null)
                {
                    var pc0 = player.GetComponent<PlayerController>();
                    if (pc0 != null) pc0.enabled = false;
                }
                return;
            }

            BeginWorld();

            if (!string.IsNullOrEmpty(testCosmetic) && player != null)
            {
                // ждём загрузки данных, потом надеваем
                if (GameData.I.Ready) EquipTest();
                else GameData.I.OnReady += EquipTest;
            }
        }

        // Вызывается из меню по кнопке ИГРАТЬ.
        public void BeginWorld()
        {
            if (worldStarted) return;
            worldStarted = true;

            if (buildWorld) BuildWorldSystems();
            if (spawnUI) BuildUI();
            if (connectToServer) BuildNet();

            // возвращаем управление игроку
            if (player != null)
            {
                var pc1 = player.GetComponent<PlayerController>();
                if (pc1 != null) pc1.enabled = true;
            }

            if (!string.IsNullOrEmpty(testCosmetic) && player != null && GameData.I != null)
            {
                if (GameData.I.Ready) EquipTest();
                else GameData.I.OnReady += EquipTest;
            }
        }

        bool worldStarted;

        void EquipTest()
        {
            var b = player != null ? player.GetComponentInChildren<CosmeticBuilder>() : null;
            if (b != null) b.Equip(testCosmetic);
        }

        // ── СВЕТ ───────────────────────────────────────────────────────────
        // Настройки взяты из веб-версии ПОСЛЕ фикса пересвета (v53):
        // солнце — главный источник, заливка приглушена. Если сделать
        // ярче, повторится та же засветка, что была на скриншоте игрока.
        void BuildLights()
        {
            var sunGO = new GameObject("Sun");
            var sun = sunGO.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.96f, 0.88f);
            sun.intensity = 0.95f;
            sun.shadows = Application.isMobilePlatform
                ? LightShadows.None : LightShadows.Soft;
            sunGO.transform.rotation = Quaternion.Euler(48f, -30f, 0f);

            // Небо из веб-версии: там scene.background = 0x87CEEB.
            // Стандартный серый скайбокс Unity делал картинку тусклой —
            // именно это видно на скриншоте пользователя.
            Color sky = new Color(0.53f, 0.81f, 0.92f);   // #87CEEB
            RenderSettings.skybox = null;                 // сплошной цвет, как в вебе

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.55f, 0.62f, 0.74f);
            RenderSettings.ambientEquatorColor = new Color(0.42f, 0.44f, 0.50f);
            RenderSettings.ambientGroundColor = new Color(0.22f, 0.21f, 0.19f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = sky;                // туман в цвет неба
            RenderSettings.fogStartDistance = 150f;
            RenderSettings.fogEndDistance = 460f;
        }

        // ── ЗЕМЛЯ ──────────────────────────────────────────────────────────
        void BuildGround()
        {
            // Земля нужна как подложка: в захваченном городе она есть,
            // но плоскость снизу страхует от проваливания на краях карты.
            float size = GameData.I != null ? GameData.I.World.worldSize : 1200f;
            var g = GameObject.CreatePrimitive(PrimitiveType.Plane);
            g.name = "Ground";
            g.transform.localScale = new Vector3(size / 10f, 1f, size / 10f);
            // Чуть ниже нуля: дороги города лежат на y=0.01-0.02, и при
            // совпадении высот они мерцали бы (z-fighting).
            g.transform.position = new Vector3(0f, -0.05f, 0f);
            var mr = g.GetComponent<MeshRenderer>();
            var sh = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var mat = new Material(sh);
            var col = new Color(0.42f, 0.46f, 0.40f);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", col);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", col);
            mr.sharedMaterial = mat;
        }

        // ── ИГРОК ──────────────────────────────────────────────────────────
        void BuildPlayer()
        {
            player = new GameObject("Player");
            var spawn = GameData.I != null && GameData.I.World.spawn != null
                ? GameData.I.World.spawn.V : new Vector3(17f, 2f, 21f);
            player.transform.position = spawn + Vector3.up * 2f;

            var cc = player.AddComponent<CharacterController>();
            cc.height = 1.8f;
            cc.radius = 0.32f;
            cc.center = new Vector3(0f, 0.9f, 0f);
            cc.slopeLimit = 50f;
            cc.stepOffset = 0.4f;

            // ── ДЕТАЛИЗИРОВАННАЯ МОДЕЛЬ ──
            // Раньше здесь была капсула. Теперь настоящий скелет:
            // плечо → локоть → кисть → пальцы, бедро → колено → стопа.
            // Косметика цепляется к костям и едет вместе с телом.
            var modelGO = new GameObject("Model");
            modelGO.transform.SetParent(player.transform, false);
            var model = modelGO.AddComponent<PlayerModel>();

            var cos = player.AddComponent<CosmeticBuilder>();
            cos.headAnchor = model.headAnchor;
            cos.bodyAnchor = model.bodyAnchor;
            cos.backAnchor = model.backAnchor;
            cos.handAnchor = model.handAnchor;

            // камера
            var camGO = Camera.main != null ? Camera.main.gameObject : new GameObject("Main Camera");
            var camComp = camGO.GetComponent<Camera>();
            if (camComp == null) camComp = camGO.AddComponent<Camera>();
            camGO.tag = "MainCamera";
            if (camGO.GetComponent<AudioListener>() == null) camGO.AddComponent<AudioListener>();

            // Заливаем небо цветом, а не серым скайбоксом по умолчанию.
            camComp.clearFlags = CameraClearFlags.SolidColor;
            camComp.backgroundColor = new Color(0.53f, 0.81f, 0.92f);
            camComp.farClipPlane = 600f;   // дальше всё равно скрыто туманом

            var pc = player.AddComponent<PlayerController>();
            pc.cameraRig = camGO.transform;
        }

        void Paint(GameObject go, Color c)
        {
            var sh = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var m = new Material(sh);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        // ── МИР И СИСТЕМЫ ──────────────────────────────────────────────────
        void BuildWorldSystems()
        {
            // город из JSON, снятого с работающей веб-версии
            if (WorldBuilder.I == null)
            {
                var go = new GameObject("World");
                go.AddComponent<WorldBuilder>();
            }
            // интерьеры: 8 этажей ТЦ и здания
            if (InteriorManager.I == null)
            {
                var go = new GameObject("Interiors");
                go.AddComponent<InteriorManager>();
            }
            // жизнь города: машины, фонари, смена суток
            if (CityLife.I == null)
            {
                var go = new GameObject("CityLife");
                go.AddComponent<CityLife>();
            }
            // профиль, квесты, взаимодействие
            if (PlayerProfile.I == null)
            {
                var go = new GameObject("Profile");
                go.AddComponent<PlayerProfile>();
            }
            if (QuestSystem.I == null)
            {
                var go = new GameObject("Quests");
                go.AddComponent<QuestSystem>();
            }
            // сюжетная линия: 6 записок → топор → доски → босс
            if (QuestChain.I == null)
            {
                var go = new GameObject("QuestChain");
                go.AddComponent<QuestChain>();
            }
            // процедурный звук без единого аудиофайла
            if (AudioFX.I == null)
            {
                var go = new GameObject("AudioFX");
                go.AddComponent<AudioFX>();
            }
            // сервисы города: работа, питомцы, квартиры
            if (JobService.I == null)
            {
                var go = new GameObject("Services");
                go.AddComponent<JobService>();
                go.AddComponent<PetService>();
                go.AddComponent<ApartmentService>();
            }
            // системы второй волны: погода, танцы, лутбоксы, прогрессия,
            // банк, спортзал, редактор внешности
            if (WeatherSystem.I == null)
            {
                var go = new GameObject("Systems2");
                go.AddComponent<WeatherSystem>();
                go.AddComponent<DanceSystem>();
                go.AddComponent<LootboxSystem>();
                go.AddComponent<ProgressionSystem>();
                go.AddComponent<BankSystem>();
                go.AddComponent<GymSystem>();
                go.AddComponent<AppearanceSystem>();
            }
            if (Interaction.I == null)
            {
                var go = new GameObject("Interaction");
                go.AddComponent<Interaction>();
                go.AddComponent<ProgressTracker>();
            }
        }

        void BuildUI()
        {
            if (HUD.I == null)
            {
                var go = new GameObject("HUD");
                go.AddComponent<HUD>();
            }
            // игровое меню на Tab: персонаж, магазин, квесты, работа,
            // питомцы, банк, пропуск — вместо кнопок по углам
            if (GameMenu.I == null)
            {
                var gm = new GameObject("GameMenu");
                gm.AddComponent<GameMenu>();
            }

            // миникарта, компас, FPS, подсказки
            if (Extras.I == null)
            {
                var ex = new GameObject("Extras");
                ex.AddComponent<Extras>();
                ex.AddComponent<Stamina>();
            }

            // ── МОБИЛЬНОЕ УПРАВЛЕНИЕ ──
            // Скрипт был написан, но его НИКТО не создавал — на телефоне
            // не появлялось ни джойстика, ни кнопок. Строим UI кодом,
            // потому что префабы снаружи редактора не сделать.
            if (FindObjectOfType<MobileControls>() == null)
                BuildMobileUI();
            // Чат создаём ВСЕГДА, а не только при подключении к серверу:
            // раньше при выключенном Connect To Server его просто не было.
            // Без сервера он работает как локальная консоль сообщений.
            if (ChatUI.I == null)
            {
                var go = new GameObject("Chat");
                go.AddComponent<ChatUI>();
            }
        }

        // ── МОБИЛЬНЫЙ ИНТЕРФЕЙС ────────────────────────────────────────────
        void BuildMobileUI()
        {
            // ТОЛЬКО настоящие телефоны и планшеты.
            // Раньше здесь стояло touch = true под UNITY_EDITOR — из-за
            // этого джойстик и кнопки лезли на экран в редакторе и на ПК,
            // перекрывая обзор. Input.touchSupported тоже не годится:
            // он true на ноутбуках с сенсорным экраном.
            bool mobile = Application.isMobilePlatform;
            if (!mobile) { Debug.Log("[Mobile] ПК — мобильное управление не создаётся"); return; }

            var go = new GameObject("MobileCanvas");
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 120;
            go.AddComponent<UnityEngine.UI.GraphicRaycaster>();

            var scaler = go.AddComponent<UnityEngine.UI.CanvasScaler>();
            scaler.uiScaleMode = UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;

            var mc = go.AddComponent<MobileControls>();
            mc.canvas = canvas;
            mc.player = player != null ? player.GetComponent<PlayerController>() : null;

            // ── ДЖОЙСТИК СЛЕВА ──
            var baseGO = new GameObject("JoystickBase");
            baseGO.transform.SetParent(go.transform, false);
            var brt = baseGO.AddComponent<RectTransform>();
            brt.anchorMin = brt.anchorMax = new Vector2(0f, 0f);
            brt.anchoredPosition = new Vector2(230f, 230f);
            brt.sizeDelta = new Vector2(260f, 260f);
            var bimg = baseGO.AddComponent<UnityEngine.UI.Image>();
            bimg.color = new Color(1f, 1f, 1f, 0.13f);
            bimg.raycastTarget = false;

            var knobGO = new GameObject("JoystickKnob");
            knobGO.transform.SetParent(baseGO.transform, false);
            var krt = knobGO.AddComponent<RectTransform>();
            krt.anchorMin = krt.anchorMax = new Vector2(0.5f, 0.5f);
            krt.sizeDelta = new Vector2(110f, 110f);
            var kimg = knobGO.AddComponent<UnityEngine.UI.Image>();
            kimg.color = new Color(0.55f, 0.48f, 1f, 0.62f);
            kimg.raycastTarget = false;

            mc.joystickBase = brt;
            mc.joystickKnob = krt;
            mc.joystickRadius = 120f;

            // ── КНОПКИ СПРАВА ──
            // Порядок и подписи как в веб-версии.
            MobBtn(go.transform, "E",  new Vector2(-330f, 300f), 130f,
                   new Color(0.25f, 0.55f, 0.35f, 0.75f),
                   () => { var i = Interaction.I; if (i != null && i.Nearest != null) i.Activate(i.Nearest); });

            MobBtn(go.transform, "↑",  new Vector2(-170f, 210f), 145f,
                   new Color(0.3f, 0.35f, 0.7f, 0.75f),
                   () => { if (mc.player != null) mc.player.MobileJumpPressed = true; });

            MobBtn(go.transform, "F",  new Vector2(-330f, 155f), 130f,
                   new Color(0.6f, 0.4f, 0.2f, 0.75f),
                   () => { if (Interaction.I != null) Interaction.I.TryCar(); });

            var sprintBtn = MobBtn(go.transform, "БЕГ", new Vector2(-170f, 380f), 130f,
                   new Color(0.7f, 0.45f, 0.2f, 0.75f), null);
            // бег — удержание, поэтому вешаем на нажатие и отпускание
            var trig = sprintBtn.gameObject.AddComponent<UnityEngine.EventSystems.EventTrigger>();
            var down = new UnityEngine.EventSystems.EventTrigger.Entry
                { eventID = UnityEngine.EventSystems.EventTriggerType.PointerDown };
            down.callback.AddListener(_ => { if (mc.player != null) mc.player.MobileSprint = true; });
            trig.triggers.Add(down);
            var up = new UnityEngine.EventSystems.EventTrigger.Entry
                { eventID = UnityEngine.EventSystems.EventTriggerType.PointerUp };
            up.callback.AddListener(_ => { if (mc.player != null) mc.player.MobileSprint = false; });
            trig.triggers.Add(up);

            MobBtn(go.transform, "B",  new Vector2(-90f, 560f), 110f,
                   new Color(0.4f, 0.3f, 0.6f, 0.7f),
                   () => { if (HUD.I != null) HUD.I.ToggleShop(); });
            MobBtn(go.transform, "Q",  new Vector2(-215f, 560f), 110f,
                   new Color(0.3f, 0.4f, 0.6f, 0.7f),
                   () => { if (HUD.I != null) HUD.I.ToggleQuests(); });
            MobBtn(go.transform, "👁", new Vector2(-340f, 560f), 110f,
                   new Color(0.35f, 0.35f, 0.45f, 0.7f),
                   () => { if (mc.player != null) mc.player.firstPerson = !mc.player.firstPerson; });

            Debug.Log("[Mobile] управление создано: джойстик + 7 кнопок");
        }

        UnityEngine.UI.Button MobBtn(Transform parent, string label, Vector2 pos,
                                     float size, Color color,
                                     UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject("Mob_" + label);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(1f, 0f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = new Vector2(size, size);
            var img = go.AddComponent<UnityEngine.UI.Image>();
            img.color = color;
            var b = go.AddComponent<UnityEngine.UI.Button>();
            b.targetGraphic = img;
            if (onClick != null) b.onClick.AddListener(onClick);

            var txt = new GameObject("Label");
            txt.transform.SetParent(go.transform, false);
            var trt = txt.AddComponent<RectTransform>();
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
            trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
            var t = txt.AddComponent<UnityEngine.UI.Text>();
            var f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (f == null) f = Resources.GetBuiltinResource<Font>("Arial.ttf");
            t.font = f;
            t.fontSize = Mathf.RoundToInt(size * 0.34f);
            t.color = Color.white;
            t.text = label;
            t.alignment = TextAnchor.MiddleCenter;
            t.raycastTarget = false;
            return b;
        }

        // ── СЕТЬ ───────────────────────────────────────────────────────────
        void BuildNet()
        {
            if (NetClient.I != null) return;
            var go = new GameObject("NetClient");
            var net = go.AddComponent<NetClient>();
            net.serverHost = serverHost;
            net.serverPort = serverPort;
            net.autoConnect = true;
            // отображение других игроков — включая тех, кто в браузере
            go.AddComponent<Fantazia.Net.RemotePlayers>();
        }

        void Update()
        {
            // отправка позиции на сервер
            if (NetClient.I != null && NetClient.I.Connected && player != null)
            {
                var pc = player.GetComponent<PlayerController>();
                string anim = pc == null ? "idle"
                    : pc.IsRunning ? "run" : (pc.IsMoving ? "walk" : "idle");
                NetClient.I.SendPosition(player.transform.position,
                                         player.transform.eulerAngles.y, anim);
            }
        }
    }
}
