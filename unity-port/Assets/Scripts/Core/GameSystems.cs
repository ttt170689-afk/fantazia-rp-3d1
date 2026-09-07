// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ИГРОВЫЕ СИСТЕМЫ
//  Экономика, инвентарь, квесты, работа, взаимодействие с миром.
//  Перенесено из index.html: те же цифры, те же правила, тот же баланс.
//
//  Данные (работы, товары, награды) читаются из JSON, снятых с веб-версии,
//  поэтому баланс правится в одном месте и не расходится между версиями.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Fantazia.World;

namespace Fantazia.Core
{
    // ═══════════════════════════════════════════════════════════════════════
    //  ПРОФИЛЬ ИГРОКА: деньги, монеты, опыт, уровень
    // ═══════════════════════════════════════════════════════════════════════
    public class PlayerProfile : MonoBehaviour
    {
        public static PlayerProfile I { get; private set; }

        [Header("Экономика")]
        public int money = 1000;
        public int coins = 50;         // валюта для косметики
        public int level = 1;
        public int exp = 0;
        public string jobId = "";
        public string jobTitle = "Безработный";

        [Header("Инвентарь")]
        public List<string> ownedCosmetics = new List<string>();
        public string equippedHead = "";
        public string equippedBack = "";
        public string equippedAura = "";

        public event Action OnChanged;

        const string KEY = "fz_profile_v1";

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            Load();
        }

        // ── ДЕНЬГИ ─────────────────────────────────────────────────────────
        public bool Spend(int amount)
        {
            if (amount <= 0 || money < amount) return false;
            money -= amount;
            Save(); OnChanged?.Invoke();
            return true;
        }

        public void Earn(int amount)
        {
            if (amount <= 0) return;
            money += amount;
            Save(); OnChanged?.Invoke();
        }

        // ── МОНЕТЫ (косметика) ─────────────────────────────────────────────
        // Кулдауны как в вебе v52: без них монеты накручиваются спамом.
        readonly Dictionary<string, float> earnCooldown = new Dictionary<string, float>();

        public void AddCoins(int amount, string reason = null, float cooldown = 0f)
        {
            if (amount <= 0) return;
            if (!string.IsNullOrEmpty(reason) && cooldown > 0f)
            {
                if (earnCooldown.TryGetValue(reason, out float last) &&
                    Time.time - last < cooldown) return;
                earnCooldown[reason] = Time.time;
            }
            coins += amount;
            Save(); OnChanged?.Invoke();
            Notify($"🪙 +{amount} монет" + (reason != null ? " · " + reason : ""));
        }

        public bool SpendCoins(int amount)
        {
            if (amount <= 0 || coins < amount) return false;
            coins -= amount;
            Save(); OnChanged?.Invoke();
            return true;
        }

        // ── ОПЫТ И УРОВЕНЬ ─────────────────────────────────────────────────
        public int ExpForNext => level * 100;

        public void AddExp(int amount)
        {
            if (amount <= 0) return;
            exp += amount;
            while (exp >= ExpForNext)
            {
                exp -= ExpForNext;
                level++;
                Notify($"⭐ Уровень {level}!");
                AddCoins(10, "новый уровень");
            }
            Save(); OnChanged?.Invoke();
        }

        // ── КОСМЕТИКА ──────────────────────────────────────────────────────
        public bool Owns(string id) => ownedCosmetics.Contains(id);

        public bool Buy(string id)
        {
            var item = GameData.I?.GetCosmetic(id);
            if (item == null) return false;
            if (Owns(id)) { Notify("Уже куплено"); return false; }
            if (!SpendCoins(item.coinPrice))
            {
                Notify($"Не хватает монет: нужно {item.coinPrice}");
                return false;
            }
            ownedCosmetics.Add(id);
            Save(); OnChanged?.Invoke();
            Notify($"✅ Куплено: {item.name}");
            return true;
        }

        public void Equip(string id)
        {
            var item = GameData.I?.GetCosmetic(id);
            if (item == null || !Owns(id)) return;
            switch (item.slot)
            {
                case "back": equippedBack = id; break;
                case "aura": equippedAura = id; break;
                default: equippedHead = id; break;
            }
            Save(); OnChanged?.Invoke();

            var builder = FindObjectOfType<Fantazia.Cosmetics.CosmeticBuilder>();
            if (builder != null) builder.Equip(id);
        }

        // ── СОХРАНЕНИЕ ─────────────────────────────────────────────────────
        [Serializable]
        class SaveData
        {
            public int money, coins, level, exp;
            public string jobId, jobTitle;
            public string[] owned;
            public string head, back, aura;
        }

        public void Save()
        {
            var d = new SaveData
            {
                money = money, coins = coins, level = level, exp = exp,
                jobId = jobId, jobTitle = jobTitle,
                owned = ownedCosmetics.ToArray(),
                head = equippedHead, back = equippedBack, aura = equippedAura
            };
            PlayerPrefs.SetString(KEY, JsonUtility.ToJson(d));
            PlayerPrefs.Save();
        }

        public void Load()
        {
            if (!PlayerPrefs.HasKey(KEY)) return;
            try
            {
                var d = JsonUtility.FromJson<SaveData>(PlayerPrefs.GetString(KEY));
                if (d == null) return;
                money = d.money; coins = d.coins; level = Mathf.Max(1, d.level); exp = d.exp;
                jobId = d.jobId ?? ""; jobTitle = string.IsNullOrEmpty(d.jobTitle) ? "Безработный" : d.jobTitle;
                ownedCosmetics = d.owned != null ? new List<string>(d.owned) : new List<string>();
                equippedHead = d.head ?? ""; equippedBack = d.back ?? ""; equippedAura = d.aura ?? "";
            }
            catch (Exception e) { Debug.LogWarning("[Profile] загрузка: " + e.Message); }
        }

        public static void Notify(string text)
        {
            if (UI.HUD.I != null) UI.HUD.I.Toast(text);
            else Debug.Log("[FZ] " + text);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ВЗАИМОДЕЙСТВИЕ С МИРОМ
    //  В вебе это был перебор 370+ точек каждый кадр. Здесь тот же приём,
    //  но с проверкой квадрата расстояния и обновлением раз в 0.15 с —
    //  чаще не нужно, игрок за это время не убегает.
    // ═══════════════════════════════════════════════════════════════════════
    public class Interaction : MonoBehaviour
    {
        public static Interaction I { get; private set; }

        public InterRec Nearest { get; private set; }
        public float checkInterval = 0.15f;

        Transform player;
        float timer;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        void Update()
        {
            if (player == null)
            {
                var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc != null) player = pc.transform;
                if (player == null) return;
            }

            timer += Time.deltaTime;
            if (timer >= checkInterval) { timer = 0f; FindNearest(); }

            if (Input.GetKeyDown(KeyCode.E))
            {
                // ── СЮЖЕТ: записки и топор лежат в мире, а не в списке
                // точек — они появляются и исчезают по ходу квеста ──
                if (QuestChain.I != null && player != null)
                {
                    int note = QuestChain.I.NearestNote(player.position, 2.6f);
                    if (note >= 0) { QuestChain.I.PickNote(note); return; }
                    if (QuestChain.I.NearAxe(player.position, 2.6f)) { QuestChain.I.PickAxe(); return; }
                }
                if (Nearest != null) Activate(Nearest);
            }

            // ── МАШИНЫ: садимся по F ──
            // вынесено в TryCar(), чтобы то же самое работало
            // с мобильной кнопки, а не только с клавиатуры
            // Отдельно от точек взаимодействия: машины двигаются, держать
            // их в общем списке пришлось бы обновлять каждый кадр.
            if (Input.GetKeyDown(KeyCode.F)) TryCar();
        }

        // Посадка в ближайшую машину. Публичный метод: вызывается и с
        // клавиши F, и с мобильной кнопки.
        public void TryCar()
        {
            if (CityLife.I == null) return;
            if (InteriorManager.I != null && InteriorManager.I.inside) return;

            var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
            if (pc == null || !pc.gameObject.activeSelf) return;

            var car = CityLife.I.NearestCar(pc.transform.position, 4.5f);
            if (car == null || car.Occupied)
            {
                PlayerProfile.Notify("🚗 Рядом нет свободной машины");
                return;
            }
            car.Enter(pc);
            PlayerProfile.I?.AddCoins(3, "поездка на машине", 30f);
        }

        void FindNearest()
        {
            Nearest = null;
            float best = float.MaxValue;
            Vector3 p = player.position;

            List<InterRec> list;
            Vector3 offset = Vector3.zero;

            if (InteriorManager.I != null && InteriorManager.I.inside)
            {
                list = InteriorManager.I.ActiveInteractables;
                offset = InteriorManager.I.interiorBase;
            }
            else
            {
                list = WorldBuilder.I != null ? WorldBuilder.I.Interactables : null;
            }
            if (list == null) return;

            for (int i = 0; i < list.Count; i++)
            {
                var it = list[i];
                float dx = (it.x + offset.x) - p.x;
                float dz = (it.z + offset.z) - p.z;
                float d2 = dx * dx + dz * dz;
                float r = it.range > 0 ? it.range : 3f;
                if (d2 > r * r || d2 >= best) continue;
                best = d2;
                Nearest = it;
            }
        }

        public void Activate(InterRec it)
        {
            if (it == null) return;

            switch (it.type)
            {
                case "elevator":
                    AudioFX.Play("buttonClick");
                    if (UI.HUD.I != null) UI.HUD.I.ToggleElevator();
                    break;

                case "escalator_up":
                    if (InteriorManager.I != null)
                        InteriorManager.I.GoToFloor(InteriorManager.I.currentFloor + 1);
                    PlayerProfile.I?.AddCoins(1, "поездка на эскалаторе", 15f);
                    break;

                case "escalator_down":
                    if (InteriorManager.I != null)
                        InteriorManager.I.GoToFloor(InteriorManager.I.currentFloor - 1);
                    PlayerProfile.I?.AddCoins(1, "поездка на эскалаторе", 15f);
                    break;

                case "exit":
                    InteriorManager.I?.Exit();
                    break;

                case "quest_boards":
                    QuestChain.I?.TryBreakBoards();
                    break;

                case "quest_bossdoor":
                    QuestChain.I?.EnterBoss();
                    break;

                case "quest_note":
                    // записки в интерьере обрабатываются тем же путём
                    if (QuestChain.I != null && player != null)
                    {
                        int idx = QuestChain.I.NearestNote(player.position, 3f);
                        if (idx >= 0) QuestChain.I.PickNote(idx);
                    }
                    break;

                default:
                    // вход в здание: тип совпадает с типом интерьера
                    if (InteriorManager.I != null && !InteriorManager.I.inside)
                    {
                        string t = MapType(it.type);
                        InteriorManager.I.Enter(t, t == "mall" ? 5 : 0);
                        PlayerProfile.I?.AddCoins(2, "посещение здания", 20f);
                    }
                    break;
            }
        }

        // В вебе типов зданий больше, чем интерьеров: сводим к тем,
        // для которых реально захвачена геометрия.
        static string MapType(string t)
        {
            if (string.IsNullOrEmpty(t)) return "shop";
            if (t.Contains("mall")) return "mall";
            if (t.Contains("house") || t.Contains("apart")) return "house";
            if (t.Contains("office") || t.Contains("business")) return "office";
            if (t.Contains("club") || t.Contains("disco")) return "club";
            if (t.Contains("bank")) return "bank";
            if (t.Contains("hospital") || t.Contains("clinic")) return "hospital";
            if (t.Contains("police")) return "police";
            return "shop";
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  КВЕСТЫ
    //  Перенесены с фиксом v53: уведомление «квест готов» показывается
    //  ОДИН раз, а не на каждый шаг прогресса.
    // ═══════════════════════════════════════════════════════════════════════
    [Serializable]
    public class Quest
    {
        public string id;
        public string name;
        public string desc;
        public int target;
        public int progress;
        public int rewardXp;
        public int rewardCoins;
        public bool done;
        public bool readyShown;   // фикс дублей уведомлений
    }

    public class QuestSystem : MonoBehaviour
    {
        public static QuestSystem I { get; private set; }
        public List<Quest> quests = new List<Quest>();

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            Seed();
            Load();
        }

        void Seed()
        {
            quests = new List<Quest>
            {
                new Quest { id="walk500",   name="Прогулка",       desc="Пройти 500 метров",     target=500, rewardXp=50,  rewardCoins=15 },
                new Quest { id="visit3",    name="Турист",         desc="Посетить 3 здания",     target=3,   rewardXp=80,  rewardCoins=25 },
                new Quest { id="allfloors", name="Небоскрёб",      desc="Побывать на всех 8 этажах ТЦ", target=8, rewardXp=200, rewardCoins=60 },
                new Quest { id="rich",      name="Богач",          desc="Накопить 5000$",        target=5000,rewardXp=150, rewardCoins=40 },
                new Quest { id="style",     name="Модник",         desc="Купить 5 предметов",    target=5,   rewardXp=120, rewardCoins=35 }
            };
        }

        public void Progress(string id, int amount = 1)
        {
            var q = quests.Find(x => x.id == id);
            if (q == null || q.done) return;

            bool wasBelow = q.progress < q.target;
            q.progress = Mathf.Min(q.target, q.progress + amount);

            // v53: уведомление ровно один раз, а не на каждый шаг
            if (q.progress >= q.target && wasBelow && !q.readyShown)
            {
                q.readyShown = true;
                PlayerProfile.Notify($"🎯 Квест готов к сдаче: {q.name}");
            }
            Save();
        }

        public bool Claim(string id)
        {
            var q = quests.Find(x => x.id == id);
            if (q == null || q.done || q.progress < q.target) return false;
            q.done = true;
            PlayerProfile.I?.AddExp(q.rewardXp);
            PlayerProfile.I?.AddCoins(q.rewardCoins, "награда за квест");
            PlayerProfile.Notify($"✅ Квест выполнен: {q.name}");
            Save();
            return true;
        }

        [Serializable] class QSave { public string[] ids; public int[] prog; public bool[] done; }

        public void Save()
        {
            var s = new QSave
            {
                ids = quests.ConvertAll(q => q.id).ToArray(),
                prog = quests.ConvertAll(q => q.progress).ToArray(),
                done = quests.ConvertAll(q => q.done).ToArray()
            };
            PlayerPrefs.SetString("fz_quests_v1", JsonUtility.ToJson(s));
        }

        public void Load()
        {
            if (!PlayerPrefs.HasKey("fz_quests_v1")) return;
            try
            {
                var s = JsonUtility.FromJson<QSave>(PlayerPrefs.GetString("fz_quests_v1"));
                if (s?.ids == null) return;
                for (int i = 0; i < s.ids.Length; i++)
                {
                    var q = quests.Find(x => x.id == s.ids[i]);
                    if (q == null) continue;
                    q.progress = s.prog[i];
                    q.done = s.done[i];
                    if (q.progress >= q.target) q.readyShown = true;
                }
            }
            catch (Exception e) { Debug.LogWarning("[Quests] " + e.Message); }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ОТСЛЕЖИВАНИЕ ПРОГРЕССА: шаги, этажи, посещения
    // ═══════════════════════════════════════════════════════════════════════
    public class ProgressTracker : MonoBehaviour
    {
        Transform player;
        Vector3 last;
        float walked;
        readonly HashSet<int> floorsSeen = new HashSet<int>();
        readonly HashSet<string> visited = new HashSet<string>();

        void Update()
        {
            if (player == null)
            {
                var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc != null) { player = pc.transform; last = player.position; }
                return;
            }

            // шаги: телепорты не считаем, иначе квест накрутится входом в ТЦ
            Vector3 d = player.position - last;
            d.y = 0f;
            float dist = d.magnitude;
            if (dist < 3f) walked += dist;
            last = player.position;

            if (walked >= 10f)
            {
                int m = Mathf.FloorToInt(walked);
                walked -= m;
                QuestSystem.I?.Progress("walk500", m);
                PlayerProfile.I?.AddCoins(1, "прогулка", 30f);
            }

            // этажи ТЦ
            if (InteriorManager.I != null && InteriorManager.I.inside &&
                InteriorManager.I.buildingType == "mall")
            {
                int f = InteriorManager.I.currentFloor;
                if (floorsSeen.Add(f)) QuestSystem.I?.Progress("allfloors", 1);
            }

            // деньги
            if (PlayerProfile.I != null)
            {
                var q = QuestSystem.I?.quests.Find(x => x.id == "rich");
                if (q != null && !q.done && PlayerProfile.I.money > q.progress)
                    QuestSystem.I.Progress("rich", PlayerProfile.I.money - q.progress);
            }
        }

        public void MarkVisited(string type)
        {
            if (string.IsNullOrEmpty(type)) return;
            if (visited.Add(type)) QuestSystem.I?.Progress("visit3", 1);
        }
    }
}
