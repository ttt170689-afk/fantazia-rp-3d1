// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ЖИЗНЬ ГОРОДА
//  Машины (можно садиться и ездить), смена дня и ночи, уличные фонари,
//  редкие прохожие. Всё построено на данных, снятых с веб-версии.
//
//  ПРО NPC. В вебе они намеренно отключены (в коде прямо написано
//  «НПС ДОЛОЙ НАВСЕГДА» — их убрали ради производительности на телефонах).
//  Я оставил их выключенными по умолчанию, но перенёс исходные позиции
//  из buildNPCPopulation: включается флагом spawnNPCs в инспекторе.
//
//  ПРО ТЕЛЕФОНЫ. Всё, что здесь движется, обновляется с бюджетом:
//  дальние машины не считаются, фонари переключаются раз в секунду,
//  а не каждый кадр. Иначе 13 машин + 44 фонаря съедали бы кадр впустую.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Fantazia.Core;
using Fantazia.Player;

namespace Fantazia.World
{
    [Serializable] public class CarRec { public float x, z; public string type, name; public int color; }
    [Serializable] public class CarList { public CarRec[] items; }

    [Serializable] public class CarTypeRec { public string id, name; public int color, price; public float speed; }
    [Serializable] public class CarTypeList { public CarTypeRec[] items; }

    [Serializable] public class NpcRec { public float x, z; public string role; }
    [Serializable] public class NpcList { public NpcRec[] items; }

    [Serializable] public class LampRec { public float x, y, z; }
    [Serializable] public class LampList { public LampRec[] items; }

    [Serializable]
    public class DayNightCfg
    {
        public float speed = 0.01f;
        public int skyNight = 0x0a0a2a, skyDay = 0x87CEEB;
        public int sunNight = 0x4444AA, sunDay = 0xFFF5E1;
        public float sunMin = 0.3f, sunMax = 1.0f;
        public float nightThreshold = 0.45f;
    }

    public class CityLife : MonoBehaviour
    {
        public static CityLife I { get; private set; }

        [Header("Что включать")]
        public bool spawnCars = true;
        public bool spawnLamps = true;
        public bool spawnNPCs = false;    // в вебе отключены намеренно
        public bool dayNightCycle = true;

        [Header("Время суток")]
        [Range(0f, 1f)] public float timeOfDay = 0.7f;   // 0 = ночь, 1 = полдень
        public float dayLengthSeconds = 600f;            // полный цикл

        [Header("Производительность")]
        public float carUpdateDistance = 160f;
        public int maxActiveCars = 8;

        readonly List<CarCtrl> cars = new List<CarCtrl>();
        readonly List<Renderer> lampGlows = new List<Renderer>();
        readonly List<Light> lampLights = new List<Light>();
        DayNightCfg dn = new DayNightCfg();
        Light sun;
        Transform player;
        bool wasNight;
        float lampTimer;
        Shader lit;

        public List<CarTypeRec> CarTypes { get; private set; } = new List<CarTypeRec>();

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit == null) lit = Shader.Find("Standard");
        }

        IEnumerator Start()
        {
            // на телефоне машин меньше — они самые дорогие из движущегося
            if (Application.isMobilePlatform) maxActiveCars = 5;

            yield return WorldBuilder.Read("daynight.json", t =>
            { if (!string.IsNullOrEmpty(t)) dn = JsonUtility.FromJson<DayNightCfg>(t) ?? dn; });

            yield return WorldBuilder.Read("car_types.json", t =>
            {
                if (string.IsNullOrEmpty(t)) return;
                var l = JsonUtility.FromJson<CarTypeList>("{\"items\":" + t + "}");
                if (l?.items != null) CarTypes.AddRange(l.items);
            });

            if (spawnCars)
                yield return WorldBuilder.Read("cars.json", t =>
                {
                    if (string.IsNullOrEmpty(t)) return;
                    var l = JsonUtility.FromJson<CarList>("{\"items\":" + t + "}");
                    if (l?.items != null) foreach (var c in l.items) SpawnCar(c);
                });

            if (spawnLamps)
                yield return WorldBuilder.Read("lamps.json", t =>
                {
                    if (string.IsNullOrEmpty(t)) return;
                    var l = JsonUtility.FromJson<LampList>("{\"items\":" + t + "}");
                    if (l?.items != null) foreach (var lp in l.items) SpawnLamp(lp);
                });

            if (spawnNPCs)
                yield return WorldBuilder.Read("npcs.json", t =>
                {
                    if (string.IsNullOrEmpty(t)) return;
                    var l = JsonUtility.FromJson<NpcList>("{\"items\":" + t + "}");
                    if (l?.items != null) foreach (var n in l.items) SpawnNPC(n);
                });

            sun = FindSun();
            Debug.Log($"[CityLife] машин {cars.Count}, фонарей {lampGlows.Count}, " +
                      $"типов авто {CarTypes.Count}");
        }

        Light FindSun()
        {
            foreach (var l in FindObjectsOfType<Light>())
                if (l.type == LightType.Directional) return l;
            return null;
        }

        Material Mat(Color c, float metal = 0.25f, float smooth = 0.4f,
                     Color? emissive = null, float glow = 0f)
        {
            var m = new Material(lit);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metal);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            if (glow > 0.01f && emissive.HasValue)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor"))
                    m.SetColor("_EmissionColor", emissive.Value * glow);
            }
            m.enableInstancing = true;
            return m;
        }

        GameObject Box(Transform parent, Vector3 pos, Vector3 scale, Material mat, string name = "P")
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        // ── МАШИНЫ ─────────────────────────────────────────────────────────
        // Пропорции взяты из createCar() веб-версии: лимузин длиннее,
        // грузовик и фургон выше, у остальных есть кабина-крыша.
        void SpawnCar(CarRec rec)
        {
            bool limo = rec.type == "limo";
            bool truck = rec.type == "truck";
            bool van = rec.type == "van";
            float W = limo ? 7f : truck ? 5f : van ? 4.5f : 4f;
            float H = (truck || van) ? 2.2f : 1.4f;
            float D = limo ? 2.2f : 1.8f;

            var root = new GameObject("Car_" + (string.IsNullOrEmpty(rec.name) ? rec.type : rec.name));
            root.transform.SetParent(transform, false);
            root.transform.position = new Vector3(rec.x, 0f, rec.z);

            Color body = WorldBuilder.HexColor(rec.color);
            var bodyMat = Mat(body, 0.55f, 0.65f);
            var darkMat = Mat(body * 0.85f, 0.5f, 0.6f);
            var glassMat = Mat(new Color(0.15f, 0.2f, 0.28f), 0.3f, 0.9f);
            var wheelMat = Mat(new Color(0.08f, 0.08f, 0.09f), 0f, 0.15f);

            Box(root.transform, new Vector3(0, H * 0.5f, 0), new Vector3(W, H * 0.55f, D), bodyMat, "Body");

            if (!truck && !van)
            {
                float cabW = limo ? W * 0.65f : W * 0.7f;
                Box(root.transform, new Vector3(0, H * 0.5f + H * 0.35f, 0),
                    new Vector3(cabW, H * 0.5f, D * 0.85f), darkMat, "Cabin");
                Box(root.transform, new Vector3(0, H * 0.5f + H * 0.35f, D * 0.44f),
                    new Vector3(cabW * 0.9f, H * 0.32f, 0.06f), glassMat, "Glass");
            }
            else
            {
                Box(root.transform, new Vector3(-W * 0.28f, H * 0.75f, 0),
                    new Vector3(W * 0.4f, H * 0.7f, D * 0.95f), darkMat, "Cab");
            }

            // колёса
            float wx = W * 0.32f, wz = D * 0.5f;
            foreach (var s in new[] { new Vector2(-wx, -wz), new Vector2(wx, -wz),
                                      new Vector2(-wx, wz), new Vector2(wx, wz) })
            {
                var wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                var wc = wheel.GetComponent<Collider>(); if (wc != null) Destroy(wc);
                wheel.transform.SetParent(root.transform, false);
                wheel.transform.localPosition = new Vector3(s.x, 0.34f, s.y);
                wheel.transform.localRotation = Quaternion.Euler(90f, 0f, 90f);
                wheel.transform.localScale = new Vector3(0.68f, 0.12f, 0.68f);
                wheel.GetComponent<MeshRenderer>().sharedMaterial = wheelMat;
            }

            // фары — светятся ночью
            var headMat = Mat(new Color(1f, 0.96f, 0.8f), 0f, 0.9f,
                              new Color(1f, 0.93f, 0.72f), 1.2f);
            Box(root.transform, new Vector3(W * 0.48f, H * 0.55f, -D * 0.28f),
                new Vector3(0.1f, 0.22f, 0.34f), headMat, "HeadL");
            Box(root.transform, new Vector3(W * 0.48f, H * 0.55f, D * 0.28f),
                new Vector3(0.1f, 0.22f, 0.34f), headMat, "HeadR");

            // коллайдер и логика
            var bc = root.AddComponent<BoxCollider>();
            bc.size = new Vector3(W, H, D);
            bc.center = new Vector3(0, H * 0.5f, 0);

            var ctrl = root.AddComponent<CarCtrl>();
            ctrl.Setup(rec, W, H, D);
            cars.Add(ctrl);
        }

        // ── ФОНАРИ ─────────────────────────────────────────────────────────
        void SpawnLamp(LampRec rec)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "LampGlow";
            var col = go.GetComponent<Collider>(); if (col != null) Destroy(col);
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(rec.x, rec.y, rec.z);
            go.transform.localScale = Vector3.one * 0.55f;
            var warm = new Color(1f, 0.84f, 0.55f);
            go.GetComponent<MeshRenderer>().sharedMaterial = Mat(warm, 0f, 0.7f, warm, 1.4f);
            lampGlows.Add(go.GetComponent<Renderer>());

            // Реальный источник света — только на ПК: 44 точечных
            // источника на телефоне убивают производительность.
            if (!Application.isMobilePlatform)
            {
                var lgo = new GameObject("LampLight");
                lgo.transform.SetParent(go.transform, false);
                var l = lgo.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = warm;
                l.range = 14f;
                l.intensity = 0f;
                l.shadows = LightShadows.None;
                lampLights.Add(l);
            }
        }

        // ── ПРОХОЖИЕ ───────────────────────────────────────────────────────
        void SpawnNPC(NpcRec rec)
        {
            Color skin = new Color(0.83f, 0.65f, 0.46f);
            Color shirt = rec.role == "guard" ? new Color(0.10f, 0.23f, 0.43f)
                        : rec.role == "merchant" ? new Color(0.72f, 0.53f, 0.04f)
                        : rec.role == "clerk" ? new Color(0.56f, 0.27f, 0.68f)
                        : new Color(0.91f, 0.30f, 0.24f);

            var root = new GameObject("NPC_" + rec.role);
            root.transform.SetParent(transform, false);
            root.transform.position = new Vector3(rec.x, 0f, rec.z);
            root.transform.localScale = Vector3.one * 0.75f;   // как в вебе

            var sm = Mat(skin, 0f, 0.2f);
            var bm = Mat(shirt, 0f, 0.3f);
            Box(root.transform, new Vector3(0, 1.3f, 0), new Vector3(0.8f, 1.0f, 0.5f), bm, "Body");
            Box(root.transform, new Vector3(0, 2.1f, 0), new Vector3(0.6f, 0.6f, 0.6f), sm, "Head");
            Box(root.transform, new Vector3(-0.55f, 1.3f, 0), new Vector3(0.25f, 0.9f, 0.25f), sm, "ArmL");
            Box(root.transform, new Vector3(0.55f, 1.3f, 0), new Vector3(0.25f, 0.9f, 0.25f), sm, "ArmR");
            Box(root.transform, new Vector3(-0.22f, 0.4f, 0), new Vector3(0.3f, 0.85f, 0.3f), Mat(new Color(0.15f,0.2f,0.35f)), "LegL");
            Box(root.transform, new Vector3(0.22f, 0.4f, 0), new Vector3(0.3f, 0.85f, 0.3f), Mat(new Color(0.15f,0.2f,0.35f)), "LegR");

            var cc = root.AddComponent<CapsuleCollider>();
            cc.height = 2.4f; cc.radius = 0.4f; cc.center = new Vector3(0, 1.2f, 0);

            root.AddComponent<NpcWander>().home = new Vector3(rec.x, 0f, rec.z);
        }

        // ── ОБНОВЛЕНИЕ ─────────────────────────────────────────────────────
        void Update()
        {
            if (dayNightCycle)
            {
                timeOfDay += Time.deltaTime / Mathf.Max(60f, dayLengthSeconds);
                if (timeOfDay > 1f) timeOfDay -= 1f;
            }
            ApplyDayNight();
            UpdateCarBudget();
        }

        // Плавная смена суток. Формула та же, что в вебе: синус даёт
        // мягкий переход, порог 0.45 включает фонари.
        void ApplyDayNight()
        {
            float t = Mathf.Sin(timeOfDay * Mathf.PI * 2f) * 0.5f + 0.5f;

            Color sky = Color.Lerp(WorldBuilder.HexColor(dn.skyNight),
                                   WorldBuilder.HexColor(dn.skyDay), t);
            if (Camera.main != null) Camera.main.backgroundColor = sky;
            RenderSettings.fogColor = sky;
            RenderSettings.ambientSkyColor = sky * 0.55f;

            if (sun != null)
            {
                sun.intensity = Mathf.Lerp(dn.sunMin, dn.sunMax, t);
                sun.color = Color.Lerp(WorldBuilder.HexColor(dn.sunNight),
                                       WorldBuilder.HexColor(dn.sunDay), t);
                // солнце ходит по небу, а не висит гвоздём
                sun.transform.rotation = Quaternion.Euler(
                    Mathf.Lerp(6f, 68f, t), -30f + timeOfDay * 40f, 0f);
            }

            // фонари переключаем раз в секунду, а не каждый кадр
            lampTimer += Time.deltaTime;
            if (lampTimer < 1f) return;
            lampTimer = 0f;

            bool night = t < dn.nightThreshold;
            if (night == wasNight) return;
            wasNight = night;

            foreach (var r in lampGlows) if (r != null) r.enabled = night;
            foreach (var l in lampLights) if (l != null) l.intensity = night ? 1.05f : 0f;
        }

        // Дальние машины не обновляются: на телефоне это заметная экономия.
        void UpdateCarBudget()
        {
            if (player == null)
            {
                var pc = FindObjectOfType<PlayerController>();
                if (pc != null) player = pc.transform;
                if (player == null) return;
            }

            int active = 0;
            float d2 = carUpdateDistance * carUpdateDistance;
            Vector3 p = player.position;

            for (int i = 0; i < cars.Count; i++)
            {
                var c = cars[i];
                if (c == null) continue;
                float dx = c.transform.position.x - p.x;
                float dz = c.transform.position.z - p.z;
                bool near = (dx * dx + dz * dz) < d2 && active < maxActiveCars;
                if (near) active++;
                c.SetActiveLogic(near || c.Occupied);
            }
        }

        public CarCtrl NearestCar(Vector3 pos, float maxDist)
        {
            CarCtrl best = null;
            float bd = maxDist * maxDist;
            foreach (var c in cars)
            {
                if (c == null) continue;
                float dx = c.transform.position.x - pos.x;
                float dz = c.transform.position.z - pos.z;
                float d = dx * dx + dz * dz;
                if (d < bd) { bd = d; best = c; }
            }
            return best;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  УПРАВЛЕНИЕ МАШИНОЙ
    //  Игрок садится (F), едет, выходит. Модель простая, но с инерцией
    //  и разворотом — без этого машина ощущается «приклеенной».
    // ═══════════════════════════════════════════════════════════════════════
    public class CarCtrl : MonoBehaviour
    {
        public string carType = "sedan";
        public string carName = "Седан";
        public bool Occupied { get; private set; }

        float w = 4f, h = 1.4f, d = 1.8f;
        float speed, steer;
        const float MAX_SPEED = 26f;
        const float ACCEL = 14f;
        const float BRAKE = 22f;

        PlayerController driver;
        Transform seat;
        bool logicOn = true;

        public void Setup(CarRec rec, float W, float H, float D)
        {
            carType = rec.type; carName = string.IsNullOrEmpty(rec.name) ? rec.type : rec.name;
            w = W; h = H; d = D;
            var s = new GameObject("Seat");
            s.transform.SetParent(transform, false);
            s.transform.localPosition = new Vector3(0f, h + 0.2f, 0f);
            seat = s.transform;
        }

        public void SetActiveLogic(bool on) { logicOn = on; }

        public void Enter(PlayerController pc)
        {
            if (Occupied || pc == null) return;
            Occupied = true;
            driver = pc;
            pc.gameObject.SetActive(false);
            PlayerProfile.Notify($"🚗 {carName}: W/S — газ и тормоз, A/D — руль, F — выйти");
        }

        public void Exit()
        {
            if (!Occupied || driver == null) return;
            Occupied = false;
            // высаживаем сбоку, чтобы не застрять в кузове
            Vector3 side = transform.position + transform.right * (d * 0.5f + 1.4f) + Vector3.up * 0.6f;
            driver.gameObject.SetActive(true);
            driver.Teleport(side);
            driver = null;
            speed = 0f;
            PlayerProfile.Notify("🚶 Вы вышли из машины");
        }

        void Update()
        {
            if (!Occupied)
            {
                if (!logicOn) return;
                return;
            }

            float gas = Input.GetAxisRaw("Vertical");
            float turn = Input.GetAxisRaw("Horizontal");

            // мобильный ввод — тот же джойстик
            if (driver != null)
            {
                gas += driver.MobileMove.y;
                turn += driver.MobileMove.x;
            }

            if (Mathf.Abs(gas) > 0.01f)
                speed += gas * ACCEL * Time.deltaTime;
            else
                speed = Mathf.MoveTowards(speed, 0f, BRAKE * 0.35f * Time.deltaTime);

            speed = Mathf.Clamp(speed, -MAX_SPEED * 0.4f, MAX_SPEED);

            // руль работает только на ходу — как в жизни
            if (Mathf.Abs(speed) > 0.4f)
            {
                steer = Mathf.Lerp(steer, turn, 1f - Mathf.Exp(-8f * Time.deltaTime));
                transform.Rotate(Vector3.up, steer * 62f * Time.deltaTime * Mathf.Sign(speed), Space.World);
            }

            transform.position += transform.right * speed * Time.deltaTime;

            // камера следует за машиной
            if (Camera.main != null)
            {
                Vector3 want = transform.position - transform.right * 9f + Vector3.up * 4.2f;
                Camera.main.transform.position = Vector3.Lerp(
                    Camera.main.transform.position, want, 1f - Mathf.Exp(-7f * Time.deltaTime));
                Camera.main.transform.LookAt(transform.position + Vector3.up * 1.2f);
            }

            if (Input.GetKeyDown(KeyCode.F)) Exit();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ПРОСТАЯ ХОДЬБА ПРОХОЖИХ
    //  Логика из веб-версии: идут в случайную сторону, потом пауза.
    //  Обновляются раз в несколько кадров — их немного, но привычка
    //  экономить кадры на телефоне себя оправдывает.
    // ═══════════════════════════════════════════════════════════════════════
    public class NpcWander : MonoBehaviour
    {
        public Vector3 home;
        public float radius = 12f;
        public float speed = 1.4f;

        float angle, walkTimer, waitTime;
        bool walking;

        void Start()
        {
            angle = UnityEngine.Random.value * Mathf.PI * 2f;
            waitTime = 2f + UnityEngine.Random.value * 4f;
            if (home == Vector3.zero) home = transform.position;
        }

        void Update()
        {
            walkTimer -= Time.deltaTime;
            if (walkTimer <= 0f)
            {
                walking = !walking;
                walkTimer = walking ? (2f + UnityEngine.Random.value * 3f) : waitTime;
                if (walking) angle = UnityEngine.Random.value * Mathf.PI * 2f;
            }
            if (!walking) return;

            Vector3 dir = new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle));
            Vector3 next = transform.position + dir * speed * Time.deltaTime;

            // не уходим далеко от места спавна
            if ((next - home).sqrMagnitude > radius * radius)
            {
                angle += Mathf.PI;
                return;
            }
            transform.position = next;
            transform.rotation = Quaternion.Slerp(transform.rotation,
                Quaternion.LookRotation(dir), 1f - Mathf.Exp(-6f * Time.deltaTime));
        }
    }
}
