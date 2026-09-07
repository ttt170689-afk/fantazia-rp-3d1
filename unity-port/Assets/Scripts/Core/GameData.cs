// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ЗАГРУЗКА ДАННЫХ ИГРЫ
//
//  Читает JSON из StreamingAssets, которые сгенерированы экспортёром
//  из работающей JS-версии (unity-port/tools/extract.js). Благодаря
//  этому 206 предметов косметики, работы, товары и константы мира
//  не нужно переписывать руками — прогнал экспорт и данные обновились.
//
//  ВАЖНО ПРО JsonUtility: встроенный парсер Unity НЕ умеет читать
//  массив в корне файла и словари. Поэтому для массивов оборачиваем
//  текст в {"items":[...]}, а словари грузим через мини-парсер ниже.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace Fantazia.Core
{
    // ── Модель предмета косметики ──────────────────────────────────────────
    [Serializable]
    public class CosmeticItem
    {
        public string id;
        public string name;
        public string emoji;
        public string type;      // архетип: hat, cap, crown, wings, aura...
        public string rarity;    // common..mythic
        public int coinPrice;
        public string slot;      // head, back, aura, body, gear
        public int color;
        public float size = 1f;
        public float glow;
        public int emissive;
        public float metal = -1f;

        // параметры архетипов
        public int band, gem, lens, accent, pom, points, visor, crest, eyes;
        public int pendant, segments, rings, inner, tips, spike, buckle, collar, frame;
        public float spin, opacity;
        public string shape;

        public Color UnityColor => IntToColor(color);
        public Color EmissiveColor => IntToColor(emissive);

        public static Color IntToColor(int hex)
        {
            return new Color(
                ((hex >> 16) & 0xFF) / 255f,
                ((hex >> 8) & 0xFF) / 255f,
                (hex & 0xFF) / 255f
            );
        }
    }

    [Serializable] public class CosmeticList { public CosmeticItem[] items; }

    [Serializable]
    public class RarityDef
    {
        public string id;
        public string name;
        public string color;   // hex-строка для UI
        public float mult;
        public float glow;
    }
    [Serializable] public class RarityList { public RarityDef[] items; }

    // ── Константы мира ─────────────────────────────────────────────────────
    [Serializable]
    public class SpawnPoint { public float x, y, z; public Vector3 V => new Vector3(x, y, z); }

    [Serializable]
    public class EscalatorCfg { public float[] xUp; public float zBottom, zTop; }

    [Serializable]
    public class LiftCfg { public float x, z, doorWidth, doorHeight; }

    [Serializable]
    public class WorldCfg
    {
        public int worldSize = 1200;
        public float moveSpeed = 9f;
        public float sprintSpeed = 16.8f;
        public float jumpForce = 12f;
        public float gravity = 28.8f;
        public float cameraDistance = 8f;
        public float cameraHeight = 4f;
        public float mallFloorHeight = 5.5f;
        public int mallGround = 5;
        public float interiorBaseX = 2000f;
        public float interiorBaseZ = 2000f;
        public SpawnPoint spawn;
        public string[] mallFloors;
        public EscalatorCfg escalator;
        public LiftCfg lift;
    }

    // ── Правила античита (те же, что на Node-сервере) ──────────────────────
    [Serializable]
    public class AntiCheatCfg
    {
        public float maxSpeed = 34f;
        public float maxJump = 60f;
        public float worldMinX = -900f, worldMaxX = 900f;
        public float worldMinY = -60f, worldMaxY = 400f;
        public float worldMinZ = -900f, worldMaxZ = 900f;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ГЛАВНЫЙ ЗАГРУЗЧИК
    // ═══════════════════════════════════════════════════════════════════════
    public class GameData : MonoBehaviour
    {
        public static GameData I { get; private set; }

        public WorldCfg World = new WorldCfg();
        public AntiCheatCfg AntiCheat = new AntiCheatCfg();
        public List<CosmeticItem> Cosmetics = new List<CosmeticItem>();
        public Dictionary<string, RarityDef> Rarities = new Dictionary<string, RarityDef>();

        public bool Ready { get; private set; }
        public event Action OnReady;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            StartCoroutine(LoadAll());
        }

        IEnumerator LoadAll()
        {
            yield return Read("world.json", txt =>
            {
                if (!string.IsNullOrEmpty(txt))
                    World = JsonUtility.FromJson<WorldCfg>(txt) ?? World;
            });

            yield return Read("anticheat.json", txt =>
            {
                if (!string.IsNullOrEmpty(txt))
                    AntiCheat = JsonUtility.FromJson<AntiCheatCfg>(txt) ?? AntiCheat;
            });

            yield return Read("cosmetics.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                // JsonUtility не читает массив в корне — оборачиваем
                var wrapped = "{\"items\":" + txt + "}";
                var list = JsonUtility.FromJson<CosmeticList>(wrapped);
                if (list?.items != null) Cosmetics.AddRange(list.items);
            });

            yield return Read("rarities.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                var wrapped = "{\"items\":" + txt + "}";
                var list = JsonUtility.FromJson<RarityList>(wrapped);
                if (list?.items != null)
                    foreach (var r in list.items) Rarities[r.id] = r;
            });

            Ready = true;
            Debug.Log($"[Fantazia] Данные загружены: косметики {Cosmetics.Count}, " +
                      $"редкостей {Rarities.Count}, этажей ТЦ {World.mallFloors?.Length ?? 0}");
            OnReady?.Invoke();
        }

        // Чтение из StreamingAssets. На Android это внутри APK и обычным
        // File.ReadAllText не открывается — нужен UnityWebRequest.
        IEnumerator Read(string file, Action<string> done)
        {
            string path = Path.Combine(Application.streamingAssetsPath, file);

            if (path.Contains("://") || path.Contains(":///"))
            {
                using (var req = UnityWebRequest.Get(path))
                {
                    yield return req.SendWebRequest();
                    if (req.result == UnityWebRequest.Result.Success)
                        done(req.downloadHandler.text);
                    else
                    {
                        Debug.LogWarning($"[Fantazia] не прочитан {file}: {req.error}");
                        done(null);
                    }
                }
            }
            else
            {
                if (File.Exists(path)) done(File.ReadAllText(path));
                else { Debug.LogWarning($"[Fantazia] нет файла {file}"); done(null); }
            }
        }

        // ── Удобные выборки ────────────────────────────────────────────────
        public CosmeticItem GetCosmetic(string id) =>
            Cosmetics.Find(c => c.id == id);

        public List<CosmeticItem> BySlot(string slot) =>
            Cosmetics.FindAll(c => c.slot == slot);

        public List<CosmeticItem> ByRarity(string rarity) =>
            Cosmetics.FindAll(c => c.rarity == rarity);
    }
}
