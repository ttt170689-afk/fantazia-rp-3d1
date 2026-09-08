// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ИГРОВЫЕ СИСТЕМЫ, ЧАСТЬ 2
//
//  Перенос логики из index.html, которой ещё не было в Unity:
//  редактор внешности, ежедневные награды, FANTAZIA PASS, лутбоксы,
//  танцы и эмоции, погода, банк, спортзал.
//
//  Данные (лутбоксы, награды, танцы) вытащены из веб-версии в JSON,
//  поэтому баланс совпадает до цифры.
//
//  Сетевую часть НЕ трогаю — сервер пользователь делает сам.
//  Всё работает локально через PlayerPrefs.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.World;

namespace Fantazia.Core
{
    // ═══════════════════════════════════════════════════════════════════════
    //  ПОГОДА
    //  В вебе переключалась админкой: ясно, дождь, снег, гроза.
    //  Здесь меняется сама по кругу и влияет на свет, туман и частицы.
    // ═══════════════════════════════════════════════════════════════════════
    public enum WeatherType { Sunny, Cloudy, Rain, Storm, Snow, Fog }

    public class WeatherSystem : MonoBehaviour
    {
        public static WeatherSystem I { get; private set; }

        [Header("Погода")]
        public WeatherType current = WeatherType.Sunny;
        public bool autoChange = true;
        public float changeEvery = 180f;      // 3 минуты на состояние

        ParticleSystem rainPS, snowPS;
        Light sun;
        float timer;
        Color baseFog;
        float baseFogEnd;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        void Start()
        {
            baseFog = RenderSettings.fogColor;
            baseFogEnd = RenderSettings.fogEndDistance;
            foreach (var l in FindObjectsOfType<Light>())
                if (l.type == LightType.Directional) { sun = l; break; }
            BuildParticles();
            Apply(current);
        }

        // Частицы делаем сами: тащить готовые системы из ассетов нельзя,
        // а дождь и снег заметно оживляют город.
        void BuildParticles()
        {
            rainPS = MakeFall("Rain", new Color(0.65f, 0.78f, 1f, 0.55f), 0.035f, 0.5f, 22f, 1400);
            snowPS = MakeFall("Snow", new Color(1f, 1f, 1f, 0.9f), 0.09f, 0.09f, 3.2f, 700);
        }

        ParticleSystem MakeFall(string name, Color c, float size, float sizeY,
                                float speed, int rate)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop();

            var main = ps.main;
            main.startColor = c;
            main.startSize = size;
            main.startSpeed = speed;
            main.startLifetime = 2.2f;
            main.maxParticles = rate;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = 0f;

            var em = ps.emission;
            em.rateOverTime = rate * 0.5f;

            var sh = ps.shape;
            sh.shapeType = ParticleSystemShapeType.Box;
            sh.scale = new Vector3(60f, 0.1f, 60f);

            var rend = go.GetComponent<ParticleSystemRenderer>();
            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader == null) shader = Shader.Find("Particles/Standard Unlit");
            if (shader == null) shader = Shader.Find("Sprites/Default");
            rend.material = new Material(shader);
            if (rend.material.HasProperty("_BaseColor")) rend.material.SetColor("_BaseColor", c);
            if (rend.material.HasProperty("_Color")) rend.material.SetColor("_Color", c);
            rend.renderMode = ParticleSystemRenderMode.Stretch;
            rend.velocityScale = name == "Rain" ? 0.12f : 0f;
            rend.lengthScale = name == "Rain" ? 3.5f : 1f;
            return ps;
        }

        public void Set(WeatherType w) { current = w; Apply(w); }

        void Apply(WeatherType w)
        {
            if (rainPS != null) { if (w == WeatherType.Rain || w == WeatherType.Storm) rainPS.Play(); else rainPS.Stop(); }
            if (snowPS != null) { if (w == WeatherType.Snow) snowPS.Play(); else snowPS.Stop(); }

            float sunMul = 1f;
            Color fog = baseFog;
            float fogEnd = baseFogEnd;

            switch (w)
            {
                case WeatherType.Sunny:  sunMul = 1f;    break;
                case WeatherType.Cloudy: sunMul = 0.62f; fog = baseFog * 0.85f; fogEnd = baseFogEnd * 0.8f; break;
                case WeatherType.Rain:   sunMul = 0.45f; fog = new Color(0.42f, 0.46f, 0.55f); fogEnd = baseFogEnd * 0.55f; break;
                case WeatherType.Storm:  sunMul = 0.28f; fog = new Color(0.28f, 0.30f, 0.38f); fogEnd = baseFogEnd * 0.40f; break;
                case WeatherType.Snow:   sunMul = 0.70f; fog = new Color(0.80f, 0.84f, 0.90f); fogEnd = baseFogEnd * 0.50f; break;
                case WeatherType.Fog:    sunMul = 0.55f; fog = new Color(0.68f, 0.70f, 0.74f); fogEnd = baseFogEnd * 0.30f; break;
            }

            if (sun != null) sun.intensity = Mathf.Max(0.15f, 0.95f * sunMul);
            RenderSettings.fogColor = fog;
            RenderSettings.fogEndDistance = fogEnd;

            string[] names = { "☀️ Ясно", "☁️ Облачно", "🌧 Дождь", "⛈ Гроза", "❄️ Снег", "🌫 Туман" };
            PlayerProfile.Notify("Погода: " + names[(int)w]);
        }

        void Update()
        {
            // частицы летят над игроком, иначе дождь виден только в одной точке
            var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
            if (pc != null)
            {
                Vector3 p = pc.transform.position + Vector3.up * 22f;
                if (rainPS != null) rainPS.transform.position = p;
                if (snowPS != null) snowPS.transform.position = p;
            }

            if (!autoChange) return;
            timer += Time.deltaTime;
            if (timer < changeEvery) return;
            timer = 0f;
            // ясная погода выпадает чаще — постоянный дождь надоедает
            var roll = UnityEngine.Random.value;
            Set(roll < 0.4f ? WeatherType.Sunny
              : roll < 0.6f ? WeatherType.Cloudy
              : roll < 0.75f ? WeatherType.Rain
              : roll < 0.85f ? WeatherType.Fog
              : roll < 0.94f ? WeatherType.Snow
                             : WeatherType.Storm);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ТАНЦЫ И ЭМОЦИИ
    //  В вебе шесть танцев. Здесь они анимируют кости модели напрямую.
    // ═══════════════════════════════════════════════════════════════════════
    public class DanceSystem : MonoBehaviour
    {
        public static DanceSystem I { get; private set; }

        public static readonly string[] Names =
            { "disco", "floss", "latina", "robot", "wave", "headbang" };
        public static readonly string[] Titles =
            { "Диско", "Флосс", "Латина", "Робот", "Волна", "Хедбенг" };

        public int active = -1;      // -1 = не танцует
        float t;
        Fantazia.Player.PlayerModel model;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        public void Toggle(int index)
        {
            if (index < 0 || index >= Names.Length) return;
            active = (active == index) ? -1 : index;
            t = 0f;
            PlayerProfile.Notify(active >= 0 ? "💃 " + Titles[active] : "Танец остановлен");
            if (active >= 0) PlayerProfile.I?.AddCoins(2, "танец", 45f);
        }

        public void Stop() { active = -1; }

        void Update()
        {
            if (active < 0) return;

            // танец прерывается движением — иначе персонаж «уезжает» в позе
            var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
            if (pc != null && pc.IsMoving) { Stop(); return; }

            if (model == null)
            {
                model = FindObjectOfType<Fantazia.Player.PlayerModel>();
                if (model == null) return;
            }

            t += Time.deltaTime;
            float s = Mathf.Sin(t * 6f), s2 = Mathf.Sin(t * 3f), c = Mathf.Cos(t * 6f);

            switch (active)
            {
                case 0: // диско: рука вверх-вниз по диагонали
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(-140f + s * 40f, 0f, -30f);
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(20f + s * 20f, 0f, 20f);
                    if (model.hips) model.hips.localRotation = Quaternion.Euler(0f, s2 * 18f, 0f);
                    break;
                case 1: // флосс: руки маятником в противофазе с бёдрами
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(s * 55f, 0f, 35f + s * 25f);
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(-s * 55f, 0f, -35f + s * 25f);
                    if (model.hips) model.hips.localRotation = Quaternion.Euler(0f, 0f, -s * 12f);
                    break;
                case 2: // латина: покачивание бёдрами и плавные руки
                    if (model.hips) model.hips.localRotation = Quaternion.Euler(0f, s2 * 26f, s * 9f);
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(-40f, 0f, 45f + s * 18f);
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(-40f, 0f, -45f - s * 18f);
                    break;
                case 3: // робот: рывками, поэтому округляем фазу
                    float st = Mathf.Round(Mathf.Sin(t * 4f) * 2f) / 2f;
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(st * 70f, 0f, 15f);
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(-st * 70f, 0f, -15f);
                    if (model.head) model.head.localRotation = Quaternion.Euler(0f, st * 35f, 0f);
                    break;
                case 4: // волна: сдвиг фазы по цепочке рука-локоть
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(0f, 0f, 60f + Mathf.Sin(t * 5f) * 30f);
                    if (model.elbowL) model.elbowL.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t * 5f - 0.8f) * 45f);
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(0f, 0f, -60f - Mathf.Sin(t * 5f) * 30f);
                    if (model.elbowR) model.elbowR.localRotation = Quaternion.Euler(0f, 0f, -Mathf.Sin(t * 5f - 0.8f) * 45f);
                    break;
                case 5: // хедбенг: голова и корпус
                    if (model.head) model.head.localRotation = Quaternion.Euler(Mathf.Abs(s) * 55f, 0f, 0f);
                    if (model.torso) model.torso.localRotation = Quaternion.Euler(Mathf.Abs(s) * 20f, 0f, 0f);
                    if (model.armL) model.armL.localRotation = Quaternion.Euler(-100f, 0f, 40f);
                    if (model.armR) model.armR.localRotation = Quaternion.Euler(-100f, 0f, -40f);
                    break;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ЛУТБОКСЫ
    //  20 предметов с шансами выпадения — данные из веб-версии.
    // ═══════════════════════════════════════════════════════════════════════
    [Serializable]
    public class LootRec
    {
        public string id, name, emoji, rarity;
        public float chance;
        public int coins;
    }
    [Serializable] public class LootList { public LootRec[] items; }

    public class LootboxSystem : MonoBehaviour
    {
        public static LootboxSystem I { get; private set; }
        public readonly List<LootRec> Items = new List<LootRec>();
        public int price = 150;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        IEnumerator Start()
        {
            yield return WorldBuilder.Read("lootbox.json", t =>
            {
                if (string.IsNullOrEmpty(t)) return;
                var l = JsonUtility.FromJson<LootList>("{\"items\":" + t + "}");
                if (l?.items != null) Items.AddRange(l.items);
            });
        }

        public LootRec Open()
        {
            if (PlayerProfile.I == null) return null;
            if (!PlayerProfile.I.SpendCoins(price))
            {
                PlayerProfile.Notify($"Нужно {price} монет");
                return null;
            }

            // Если данных нет — выдаём случайную косметику, чтобы система
            // работала даже без lootbox.json.
            if (Items.Count == 0)
            {
                var all = GameData.I?.Cosmetics;
                if (all == null || all.Count == 0) return null;
                var pick = all[UnityEngine.Random.Range(0, all.Count)];
                GrantCosmetic(pick.id, pick.name, pick.rarity);
                return null;
            }

            // рулетка по шансам
            float total = 0f;
            foreach (var it in Items) total += Mathf.Max(0.01f, it.chance);
            float roll = UnityEngine.Random.value * total;
            foreach (var it in Items)
            {
                roll -= Mathf.Max(0.01f, it.chance);
                if (roll > 0f) continue;
                if (it.coins > 0)
                {
                    PlayerProfile.I.AddCoins(it.coins, "из коробки");
                }
                else
                {
                    var cos = GameData.I?.GetCosmetic(it.id);
                    GrantCosmetic(it.id, cos != null ? cos.name : it.name, it.rarity);
                }
                AudioFX.Play("questComplete");
                return it;
            }
            return null;
        }

        void GrantCosmetic(string id, string name, string rarity)
        {
            if (PlayerProfile.I == null) return;
            if (PlayerProfile.I.Owns(id))
            {
                PlayerProfile.I.AddCoins(40, "дубликат обменян");
                PlayerProfile.Notify($"🎁 {name} — уже есть, +40 монет");
                return;
            }
            PlayerProfile.I.ownedCosmetics.Add(id);
            PlayerProfile.I.Save();
            PlayerProfile.Notify($"🎁 ВЫПАЛО: {name} [{rarity}]");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ЕЖЕДНЕВНЫЕ НАГРАДЫ И БОЕВОЙ ПРОПУСК
    // ═══════════════════════════════════════════════════════════════════════
    public class ProgressionSystem : MonoBehaviour
    {
        public static ProgressionSystem I { get; private set; }

        [Header("Ежедневные")]
        public int streak;
        public bool claimedToday;

        [Header("FANTAZIA PASS")]
        public int passLevel = 1;
        public int passXp;
        public int XpPerLevel => 250;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            Load();
        }

        void Start() { CheckDaily(); }

        void CheckDaily()
        {
            string today = DateTime.Now.ToString("yyyy-MM-dd");
            string last = PlayerPrefs.GetString("fz_daily_date", "");
            if (last == today) { claimedToday = true; return; }

            // серия не рвётся, если заходили вчера
            string yesterday = DateTime.Now.AddDays(-1).ToString("yyyy-MM-dd");
            streak = (last == yesterday) ? streak + 1 : 1;
            claimedToday = false;
        }

        public void ClaimDaily()
        {
            if (claimedToday) { PlayerProfile.Notify("Награда уже получена сегодня"); return; }
            claimedToday = true;
            PlayerPrefs.SetString("fz_daily_date", DateTime.Now.ToString("yyyy-MM-dd"));

            int day = Mathf.Clamp(streak, 1, 7);
            int money = 100 * day;
            int coins = 10 * day;
            PlayerProfile.I?.Earn(money);
            PlayerProfile.I?.AddCoins(coins, $"вход, день {day}");
            AddPassXp(50);
            PlayerProfile.Notify($"🎁 День {day}: +{money}$ и +{coins} монет");
            Save();
        }

        public void AddPassXp(int amount)
        {
            if (amount <= 0) return;
            passXp += amount;
            while (passXp >= XpPerLevel)
            {
                passXp -= XpPerLevel;
                passLevel++;
                PlayerProfile.I?.AddCoins(25, $"PASS уровень {passLevel}");
                PlayerProfile.Notify($"⚡ FANTAZIA PASS — уровень {passLevel}!");
            }
            Save();
        }

        void Save()
        {
            PlayerPrefs.SetInt("fz_streak", streak);
            PlayerPrefs.SetInt("fz_pass_lvl", passLevel);
            PlayerPrefs.SetInt("fz_pass_xp", passXp);
            PlayerPrefs.Save();
        }

        void Load()
        {
            streak = PlayerPrefs.GetInt("fz_streak", 0);
            passLevel = Mathf.Max(1, PlayerPrefs.GetInt("fz_pass_lvl", 1));
            passXp = PlayerPrefs.GetInt("fz_pass_xp", 0);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  БАНК И СПОРТЗАЛ
    //  Мелкие механики из веба: вклад под процент и тренировка на опыт.
    // ═══════════════════════════════════════════════════════════════════════
    public class BankSystem : MonoBehaviour
    {
        public static BankSystem I { get; private set; }
        public int deposit;
        public float ratePerMinute = 0.01f;   // 1% в минуту
        float timer;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            deposit = PlayerPrefs.GetInt("fz_bank", 0);
        }

        public bool Deposit(int amount)
        {
            if (amount <= 0 || PlayerProfile.I == null) return false;
            if (!PlayerProfile.I.Spend(amount)) { PlayerProfile.Notify("Недостаточно денег"); return false; }
            deposit += amount;
            PlayerPrefs.SetInt("fz_bank", deposit);
            PlayerProfile.Notify($"🏦 Вклад: {deposit}$ · 1% в минуту");
            return true;
        }

        public bool Withdraw(int amount)
        {
            if (amount <= 0 || amount > deposit) { PlayerProfile.Notify("Столько нет на счету"); return false; }
            deposit -= amount;
            PlayerPrefs.SetInt("fz_bank", deposit);
            PlayerProfile.I?.Earn(amount);
            PlayerProfile.Notify($"🏦 Снято {amount}$");
            return true;
        }

        void Update()
        {
            if (deposit <= 0) return;
            timer += Time.deltaTime;
            if (timer < 60f) return;
            timer = 0f;
            int gain = Mathf.Max(1, Mathf.RoundToInt(deposit * ratePerMinute));
            deposit += gain;
            PlayerPrefs.SetInt("fz_bank", deposit);
            PlayerProfile.Notify($"🏦 Проценты: +{gain}$");
        }
    }

    public class GymSystem : MonoBehaviour
    {
        public static GymSystem I { get; private set; }
        float cooldown;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        public void Workout()
        {
            if (cooldown > 0f)
            {
                PlayerProfile.Notify($"Отдышитесь: {Mathf.CeilToInt(cooldown)} с");
                return;
            }
            cooldown = 8f;
            PlayerProfile.I?.AddExp(25);
            PlayerProfile.I?.AddCoins(4, "тренировка", 0f);
            if (UI.Stamina.I != null) UI.Stamina.I.max += 2f;   // растёт выносливость
            PlayerProfile.Notify("💪 Тренировка: +25 опыта, выносливость выросла");
            AudioFX.Play("coinPickup");
        }

        void Update() { if (cooldown > 0f) cooldown -= Time.deltaTime; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  РЕДАКТОР ВНЕШНОСТИ
    //  Меняет цвета модели и сохраняет выбор.
    // ═══════════════════════════════════════════════════════════════════════
    public class AppearanceSystem : MonoBehaviour
    {
        public static AppearanceSystem I { get; private set; }

        public static readonly Color[] Skins = {
            new Color(0.98f,0.86f,0.75f), new Color(0.94f,0.78f,0.65f),
            new Color(0.82f,0.62f,0.45f), new Color(0.62f,0.44f,0.31f),
            new Color(0.42f,0.29f,0.20f), new Color(0.30f,0.20f,0.14f)
        };
        public static readonly Color[] Hairs = {
            new Color(0.12f,0.09f,0.07f), new Color(0.35f,0.22f,0.12f),
            new Color(0.62f,0.45f,0.22f), new Color(0.85f,0.72f,0.42f),
            new Color(0.72f,0.18f,0.15f), new Color(0.55f,0.20f,0.65f),
            new Color(0.20f,0.55f,0.75f), new Color(0.85f,0.85f,0.88f)
        };
        public static readonly Color[] Shirts = {
            new Color(0.36f,0.62f,0.82f), new Color(0.85f,0.28f,0.28f),
            new Color(0.25f,0.65f,0.38f), new Color(0.92f,0.75f,0.22f),
            new Color(0.55f,0.30f,0.70f), new Color(0.95f,0.95f,0.95f),
            new Color(0.15f,0.15f,0.18f), new Color(0.95f,0.50f,0.20f)
        };
        public static readonly Color[] Pants = {
            new Color(0.18f,0.24f,0.38f), new Color(0.15f,0.15f,0.18f),
            new Color(0.35f,0.30f,0.26f), new Color(0.45f,0.45f,0.50f),
            new Color(0.20f,0.35f,0.25f), new Color(0.55f,0.20f,0.22f)
        };

        public int skinIdx, hairIdx, shirtIdx, pantsIdx;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            skinIdx = PlayerPrefs.GetInt("fz_skin", 1);
            hairIdx = PlayerPrefs.GetInt("fz_hair", 1);
            shirtIdx = PlayerPrefs.GetInt("fz_shirt", 0);
            pantsIdx = PlayerPrefs.GetInt("fz_pants", 0);
        }

        void Start() { StartCoroutine(ApplyDelayed()); }

        IEnumerator ApplyDelayed()
        {
            // модель создаётся Bootstrap'ом чуть позже
            yield return null;
            yield return null;
            Apply();
        }

        public void Cycle(string what, int dir)
        {
            switch (what)
            {
                case "skin":  skinIdx  = Wrap(skinIdx + dir, Skins.Length); break;
                case "hair":  hairIdx  = Wrap(hairIdx + dir, Hairs.Length); break;
                case "shirt": shirtIdx = Wrap(shirtIdx + dir, Shirts.Length); break;
                case "pants": pantsIdx = Wrap(pantsIdx + dir, Pants.Length); break;
            }
            Apply();
            Save();
        }

        static int Wrap(int v, int n) => ((v % n) + n) % n;

        public void Apply()
        {
            var m = FindObjectOfType<Fantazia.Player.PlayerModel>();
            if (m == null) return;
            m.SetColors(Skins[skinIdx], Shirts[shirtIdx], Pants[pantsIdx], Hairs[hairIdx]);
        }

        void Save()
        {
            PlayerPrefs.SetInt("fz_skin", skinIdx);
            PlayerPrefs.SetInt("fz_hair", hairIdx);
            PlayerPrefs.SetInt("fz_shirt", shirtIdx);
            PlayerPrefs.SetInt("fz_pants", pantsIdx);
            PlayerPrefs.Save();
        }
    }
}
