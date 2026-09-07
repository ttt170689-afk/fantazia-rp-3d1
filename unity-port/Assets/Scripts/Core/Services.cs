// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — СЕРВИСЫ ГОРОДА
//  Работа, питомцы, квартиры, чат. Данные — из JSON, снятых с сервера,
//  поэтому цены и зарплаты совпадают с веб-версией до копейки.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.World;
using Fantazia.Net;

namespace Fantazia.Core
{
    // ── МОДЕЛИ ДАННЫХ ──────────────────────────────────────────────────────
    [Serializable] public class JobRec { public string title, color; public int salary; }

    [Serializable]
    public class PetRec { public string type, name, color; public int price; }
    [Serializable] public class PetList { public PetRec[] items; }

    [Serializable]
    public class ApartmentRec { public string id; public int number, floor, price; }
    [Serializable] public class ApartmentList { public ApartmentRec[] items; }

    // ═══════════════════════════════════════════════════════════════════════
    //  РАБОТА
    //  В вебе зарплата капала по таймеру, пока игрок «на работе».
    //  Повторяю логику: раз в 30 секунд начисляем оклад.
    // ═══════════════════════════════════════════════════════════════════════
    public class JobService : MonoBehaviour
    {
        public static JobService I { get; private set; }

        public readonly Dictionary<string, JobRec> Jobs = new Dictionary<string, JobRec>();
        public string CurrentJob = "";
        public float payInterval = 30f;

        float timer;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        IEnumerator Start()
        {
            // jobs.json — словарь, а JsonUtility словари не умеет.
            // Разбираем вручную: формат простой и стабильный.
            yield return WorldBuilder.Read("jobs.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                ParseJobs(txt);
            });
            Debug.Log($"[Jobs] загружено профессий: {Jobs.Count}");
        }

        void ParseJobs(string json)
        {
            // {"taxi":{"title":"Таксист","salary":100,"color":"#f1c40f"}, ...}
            int i = 0;
            while (true)
            {
                int keyStart = json.IndexOf('"', i);
                if (keyStart < 0) break;
                int keyEnd = json.IndexOf('"', keyStart + 1);
                if (keyEnd < 0) break;
                string key = json.Substring(keyStart + 1, keyEnd - keyStart - 1);

                int braceStart = json.IndexOf('{', keyEnd);
                if (braceStart < 0) break;
                int braceEnd = json.IndexOf('}', braceStart);
                if (braceEnd < 0) break;

                string body = json.Substring(braceStart, braceEnd - braceStart + 1);
                var rec = JsonUtility.FromJson<JobRec>(body);
                if (rec != null && !string.IsNullOrEmpty(rec.title)) Jobs[key] = rec;

                i = braceEnd + 1;
            }
        }

        public void Take(string id)
        {
            if (!Jobs.TryGetValue(id, out var j))
            {
                PlayerProfile.Notify("Такой работы нет");
                return;
            }
            CurrentJob = id;
            if (PlayerProfile.I != null)
            {
                PlayerProfile.I.jobId = id;
                PlayerProfile.I.jobTitle = j.title;
                PlayerProfile.I.Save();
            }
            PlayerProfile.Notify($"💼 Вы устроились: {j.title} · {j.salary}$ за смену");
            AudioFX.Play("questComplete");
        }

        public void Quit()
        {
            CurrentJob = "";
            if (PlayerProfile.I != null)
            {
                PlayerProfile.I.jobId = "";
                PlayerProfile.I.jobTitle = "Безработный";
                PlayerProfile.I.Save();
            }
            PlayerProfile.Notify("💼 Вы уволились");
        }

        void Update()
        {
            if (string.IsNullOrEmpty(CurrentJob)) return;
            timer += Time.deltaTime;
            if (timer < payInterval) return;
            timer = 0f;

            if (Jobs.TryGetValue(CurrentJob, out var j))
            {
                PlayerProfile.I?.Earn(j.salary);
                PlayerProfile.I?.AddExp(15);
                PlayerProfile.Notify($"💰 Зарплата: +{j.salary}$");
                AudioFX.Play("coinPickup");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ПИТОМЕЦ
    //  Ходит следом за игроком с отставанием — как в веб-версии.
    // ═══════════════════════════════════════════════════════════════════════
    public class PetService : MonoBehaviour
    {
        public static PetService I { get; private set; }

        public readonly List<PetRec> Types = new List<PetRec>();
        public string OwnedType = "";
        GameObject petGO;
        Transform player;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        IEnumerator Start()
        {
            yield return WorldBuilder.Read("pets.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                var l = JsonUtility.FromJson<PetList>("{\"items\":" + txt + "}");
                if (l?.items != null) Types.AddRange(l.items);
            });
            Debug.Log($"[Pets] видов питомцев: {Types.Count}");

            OwnedType = PlayerPrefs.GetString("fz_pet", "");
            if (!string.IsNullOrEmpty(OwnedType)) Spawn(OwnedType);
        }

        public bool Adopt(string type)
        {
            var rec = Types.Find(p => p.type == type);
            if (rec == null) return false;
            if (PlayerProfile.I == null || !PlayerProfile.I.Spend(rec.price))
            {
                PlayerProfile.Notify($"Не хватает денег: нужно {rec.price}$");
                return false;
            }
            OwnedType = type;
            PlayerPrefs.SetString("fz_pet", type);
            Spawn(type);
            PlayerProfile.Notify($"🐾 {rec.name} теперь с вами!");
            AudioFX.Play("questComplete");
            return true;
        }

        void Spawn(string type)
        {
            if (petGO != null) Destroy(petGO);
            var rec = Types.Find(p => p.type == type);
            if (rec == null) return;

            Color c = Color.gray;
            if (!string.IsNullOrEmpty(rec.color)) ColorUtility.TryParseHtmlString(rec.color, out c);

            petGO = new GameObject("Pet_" + type);
            petGO.transform.SetParent(transform, false);

            var sh = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var mat = new Material(sh);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", c);

            // тельце, голова, четыре лапы и хвост — узнаётся с любого ракурса
            Add(PrimitiveType.Capsule, new Vector3(0f, 0.26f, 0f), new Vector3(0.28f, 0.2f, 0.28f), mat);
            Add(PrimitiveType.Sphere,  new Vector3(0f, 0.4f, 0.22f), Vector3.one * 0.22f, mat);
            foreach (var p in new[] { new Vector3(-0.1f,0.08f,0.12f), new Vector3(0.1f,0.08f,0.12f),
                                      new Vector3(-0.1f,0.08f,-0.12f), new Vector3(0.1f,0.08f,-0.12f) })
                Add(PrimitiveType.Cube, p, new Vector3(0.07f, 0.16f, 0.07f), mat);
            Add(PrimitiveType.Cube, new Vector3(0f, 0.34f, -0.24f), new Vector3(0.06f, 0.06f, 0.18f), mat);
        }

        void Add(PrimitiveType t, Vector3 pos, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            var c = go.GetComponent<Collider>(); if (c != null) Destroy(c);
            go.transform.SetParent(petGO.transform, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        void Update()
        {
            if (petGO == null) return;
            if (player == null)
            {
                var pc = FindObjectOfType<Fantazia.Player.PlayerController>();
                if (pc != null) player = pc.transform;
                return;
            }

            // держится позади игрока и слегка подпрыгивает
            Vector3 want = player.position - player.forward * 1.8f;
            want.y = player.position.y;
            float k = 1f - Mathf.Exp(-4f * Time.deltaTime);
            petGO.transform.position = Vector3.Lerp(petGO.transform.position, want, k);
            petGO.transform.position += Vector3.up * Mathf.Abs(Mathf.Sin(Time.time * 4f)) * 0.04f;

            Vector3 dir = player.position - petGO.transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.05f)
                petGO.transform.rotation = Quaternion.Slerp(petGO.transform.rotation,
                    Quaternion.LookRotation(dir), k);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  КВАРТИРЫ
    //  30 штук, цена растёт с этажом — формула с сервера.
    // ═══════════════════════════════════════════════════════════════════════
    public class ApartmentService : MonoBehaviour
    {
        public static ApartmentService I { get; private set; }

        public readonly List<ApartmentRec> All = new List<ApartmentRec>();
        public string OwnedId = "";

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        IEnumerator Start()
        {
            yield return WorldBuilder.Read("apartments.json", txt =>
            {
                if (string.IsNullOrEmpty(txt)) return;
                var l = JsonUtility.FromJson<ApartmentList>("{\"items\":" + txt + "}");
                if (l?.items != null) All.AddRange(l.items);
            });
            OwnedId = PlayerPrefs.GetString("fz_apartment", "");
            Debug.Log($"[Apartments] доступно: {All.Count}");
        }

        public bool Buy(string id)
        {
            var a = All.Find(x => x.id == id);
            if (a == null) return false;
            if (!string.IsNullOrEmpty(OwnedId))
            {
                PlayerProfile.Notify("У вас уже есть квартира");
                return false;
            }
            if (PlayerProfile.I == null || !PlayerProfile.I.Spend(a.price))
            {
                PlayerProfile.Notify($"Не хватает денег: нужно {a.price}$");
                return false;
            }
            OwnedId = id;
            PlayerPrefs.SetString("fz_apartment", id);
            PlayerProfile.Notify($"🏠 Квартира №{a.number} на {a.floor} этаже — ваша!");
            AudioFX.Play("questComplete");
            return true;
        }

        public bool Sell()
        {
            if (string.IsNullOrEmpty(OwnedId)) return false;
            var a = All.Find(x => x.id == OwnedId);
            if (a == null) return false;
            int back = Mathf.RoundToInt(a.price * 0.7f);   // как в вебе: 70%
            PlayerProfile.I?.Earn(back);
            OwnedId = "";
            PlayerPrefs.SetString("fz_apartment", "");
            PlayerProfile.Notify($"🏠 Квартира продана за {back}$");
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ЧАТ
    //  Отправляет на тот же сервер, что и веб-версия, поэтому игроки
    //  из браузера и из Unity переписываются в общем канале.
    // ═══════════════════════════════════════════════════════════════════════
    public class ChatUI : MonoBehaviour
    {
        public static ChatUI I { get; private set; }

        readonly List<string> lines = new List<string>();
        Text log;
        InputField input;
        GameObject panel;
        bool typing;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
        }

        void Start()
        {
            Build();
            if (NetClient.I != null) NetClient.I.OnChat += Add;
        }

        void Build()
        {
            var canvas = new GameObject("ChatCanvas");
            canvas.transform.SetParent(transform, false);
            var c = canvas.AddComponent<Canvas>();
            c.renderMode = RenderMode.ScreenSpaceOverlay;
            c.sortingOrder = 90;
            canvas.AddComponent<GraphicRaycaster>();

            var scaler = canvas.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);

            panel = new GameObject("ChatPanel");
            panel.transform.SetParent(canvas.transform, false);
            var prt = panel.AddComponent<RectTransform>();
            prt.anchorMin = new Vector2(0f, 0f); prt.anchorMax = new Vector2(0f, 0f);
            prt.pivot = new Vector2(0f, 0f);
            prt.anchoredPosition = new Vector2(18, 18);
            prt.sizeDelta = new Vector2(520, 220);
            panel.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.42f);

            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font == null) font = Resources.GetBuiltinResource<Font>("Arial.ttf");

            var logGO = new GameObject("Log");
            logGO.transform.SetParent(panel.transform, false);
            var lrt = logGO.AddComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero; lrt.anchorMax = Vector2.one;
            lrt.offsetMin = new Vector2(10, 44); lrt.offsetMax = new Vector2(-10, -8);
            log = logGO.AddComponent<Text>();
            log.font = font; log.fontSize = 17; log.color = Color.white;
            log.alignment = TextAnchor.LowerLeft;

            var inGO = new GameObject("Input");
            inGO.transform.SetParent(panel.transform, false);
            var irt = inGO.AddComponent<RectTransform>();
            irt.anchorMin = new Vector2(0f, 0f); irt.anchorMax = new Vector2(1f, 0f);
            irt.offsetMin = new Vector2(8, 6); irt.offsetMax = new Vector2(-8, 38);
            inGO.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.55f);
            input = inGO.AddComponent<InputField>();

            var txtGO = new GameObject("Text");
            txtGO.transform.SetParent(inGO.transform, false);
            var trt = txtGO.AddComponent<RectTransform>();
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
            trt.offsetMin = new Vector2(8, 2); trt.offsetMax = new Vector2(-8, -2);
            var t = txtGO.AddComponent<Text>();
            t.font = font; t.fontSize = 17; t.color = Color.white;
            t.supportRichText = false;
            input.textComponent = t;
            input.onEndEdit.AddListener(Send);

            Add("Система", "Enter — написать в чат");
        }

        public void Add(string who, string text)
        {
            lines.Add($"<b>{who}:</b> {text}");
            while (lines.Count > 9) lines.RemoveAt(0);
            if (log != null) log.text = string.Join("\n", lines);
        }

        void Send(string text)
        {
            typing = false;
            if (string.IsNullOrWhiteSpace(text)) return;
            NetClient.I?.SendChat(text);
            Add("Вы", text);
            input.text = "";
            Cursor.lockState = CursorLockMode.Locked;
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                if (!typing)
                {
                    typing = true;
                    Cursor.lockState = CursorLockMode.None;
                    input.ActivateInputField();
                }
            }
        }

        public bool IsTyping => typing;
    }
}
