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
            if (spawnLights) BuildLights();
            if (spawnGround) BuildGround();
            if (spawnPlayer) BuildPlayer();
            if (buildWorld) BuildWorldSystems();
            if (spawnUI) BuildUI();
            if (connectToServer) BuildNet();

            if (!string.IsNullOrEmpty(testCosmetic) && player != null)
            {
                // ждём загрузки данных, потом надеваем
                if (GameData.I.Ready) EquipTest();
                else GameData.I.OnReady += EquipTest;
            }
        }

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

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.42f, 0.47f, 0.62f);
            RenderSettings.ambientEquatorColor = new Color(0.30f, 0.32f, 0.40f);
            RenderSettings.ambientGroundColor = new Color(0.16f, 0.15f, 0.13f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.55f, 0.60f, 0.72f);
            RenderSettings.fogStartDistance = 120f;
            RenderSettings.fogEndDistance = 420f;
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
            if (camGO.GetComponent<Camera>() == null) camGO.AddComponent<Camera>();
            camGO.tag = "MainCamera";
            if (camGO.GetComponent<AudioListener>() == null) camGO.AddComponent<AudioListener>();

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
            // чат общий с веб-игроками — они на том же сервере
            if (connectToServer && ChatUI.I == null)
            {
                var go = new GameObject("Chat");
                go.AddComponent<ChatUI>();
            }
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
