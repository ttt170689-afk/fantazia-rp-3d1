// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — СЮЖЕТНАЯ ЛИНИЯ
//
//  Та самая цепочка из веб-версии: собрать 6 страниц дневника смотрителя
//  парка → найти топор в сейфе за картиной → сбить доски со служебного
//  входа в GRAND MALL → спуститься к боссу.
//
//  Порядок обязателен: топор не появится, пока не собраны все записки,
//  доски не сломать без топора. Так было в вебе — сохраняю правило,
//  иначе сюжет разваливается.
//
//  Тексты записок перенесены дословно (quest_notes.json).
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Fantazia.World;

namespace Fantazia.Core
{
    [Serializable]
    public class NoteRec
    {
        public int index;
        public float x, z;
        public string text;
    }
    [Serializable] public class NoteList { public NoteRec[] items; }

    [Serializable]
    public class QuestCfg
    {
        public int totalNotes = 6;
        public string axeHint, bossHint;
        public Vec2Rec serviceDoor, bossDoor;
        public int boardsCount = 4;
    }
    [Serializable] public class Vec2Rec { public float x, z; }

    public class QuestChain : MonoBehaviour
    {
        public static QuestChain I { get; private set; }

        [Header("Прогресс")]
        public bool[] notes = new bool[6];
        public bool hasAxe;
        public bool boardsBroken;
        public bool bossDead;

        QuestCfg cfg = new QuestCfg();
        readonly List<NoteRec> noteData = new List<NoteRec>();
        readonly List<GameObject> noteObjects = new List<GameObject>();
        GameObject axeObject;
        Shader lit;

        const string KEY = "FZ_QUEST_V1_unity";

        public int NotesFound
        {
            get { int n = 0; foreach (var b in notes) if (b) n++; return n; }
        }

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit == null) lit = Shader.Find("Standard");
            Load();
        }

        IEnumerator Start()
        {
            yield return WorldBuilder.Read("quest_config.json", t =>
            { if (!string.IsNullOrEmpty(t)) cfg = JsonUtility.FromJson<QuestCfg>(t) ?? cfg; });

            yield return WorldBuilder.Read("quest_notes.json", t =>
            {
                if (string.IsNullOrEmpty(t)) return;
                var l = JsonUtility.FromJson<NoteList>("{\"items\":" + t + "}");
                if (l?.items != null) noteData.AddRange(l.items);
            });

            if (notes.Length < cfg.totalNotes) Array.Resize(ref notes, cfg.totalNotes);
            SpawnNotes();
            Debug.Log($"[Quest] Записок в мире: {noteObjects.Count}, найдено {NotesFound}/{cfg.totalNotes}");
        }

        // ── ЗАПИСКИ В МИРЕ ─────────────────────────────────────────────────
        void SpawnNotes()
        {
            foreach (var n in noteData)
            {
                if (n.index < notes.Length && notes[n.index]) continue;   // уже найдена

                var root = new GameObject("QuestNote_" + n.index);
                root.transform.SetParent(transform, false);
                root.transform.position = new Vector3(n.x, 1f, n.z);

                // лист бумаги
                var paper = GameObject.CreatePrimitive(PrimitiveType.Cube);
                paper.name = "Paper";
                var pc = paper.GetComponent<Collider>(); if (pc != null) Destroy(pc);
                paper.transform.SetParent(root.transform, false);
                paper.transform.localScale = new Vector3(0.42f, 0.56f, 0.02f);
                var pm = new Material(lit);
                var cream = new Color(0.95f, 0.91f, 0.81f);
                if (pm.HasProperty("_BaseColor")) pm.SetColor("_BaseColor", cream);
                if (pm.HasProperty("_Color")) pm.SetColor("_Color", cream);
                pm.EnableKeyword("_EMISSION");
                if (pm.HasProperty("_EmissionColor"))
                    pm.SetColor("_EmissionColor", new Color(1f, 0.9f, 0.6f) * 0.8f);
                paper.GetComponent<MeshRenderer>().sharedMaterial = pm;

                // тёплое свечение, чтобы записку было видно издалека
                var glow = new GameObject("Glow");
                glow.transform.SetParent(root.transform, false);
                var gl = glow.AddComponent<Light>();
                gl.type = LightType.Point;
                gl.color = new Color(1f, 0.9f, 0.6f);
                gl.range = 6f;
                gl.intensity = Application.isMobilePlatform ? 0.8f : 1.3f;
                gl.shadows = LightShadows.None;

                root.AddComponent<NoteBob>().phase = n.index * 1.3f;
                noteObjects.Add(root);
            }
        }

        // ── СБОР ЗАПИСКИ ───────────────────────────────────────────────────
        public void PickNote(int index)
        {
            if (index < 0 || index >= notes.Length || notes[index]) return;
            notes[index] = true;
            Save();

            foreach (var go in noteObjects)
            {
                if (go == null || go.name != "QuestNote_" + index) continue;
                Destroy(go);
                break;
            }

            var rec = noteData.Find(n => n.index == index);
            ShowNote(rec != null ? rec.text : "Записка " + (index + 1));

            PlayerProfile.I?.AddCoins(25, "найдена записка");
            PlayerProfile.I?.AddExp(40);
            AudioFX.Play("questComplete");

            int found = NotesFound;
            if (found >= cfg.totalNotes)
            {
                PlayerProfile.Notify("📜 Все страницы собраны! Топор — в офисной башне, сейф за картиной");
                SpawnAxe();
            }
            else PlayerProfile.Notify($"📜 Страница {found}/{cfg.totalNotes}");
        }

        // ── ТОПОР ──────────────────────────────────────────────────────────
        // Появляется ТОЛЬКО когда собраны все записки — правило из веба.
        void SpawnAxe()
        {
            if (hasAxe || axeObject != null) return;

            var root = new GameObject("QuestAxe");
            root.transform.SetParent(transform, false);
            // офисная башня: берём самое высокое здание города
            root.transform.position = new Vector3(-58f, 1.2f, -42f);

            var handle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            handle.name = "Handle";
            var hc = handle.GetComponent<Collider>(); if (hc != null) Destroy(hc);
            handle.transform.SetParent(root.transform, false);
            handle.transform.localScale = new Vector3(0.06f, 0.35f, 0.06f);
            handle.GetComponent<MeshRenderer>().sharedMaterial = Mat(new Color(0.42f, 0.28f, 0.15f));

            var blade = GameObject.CreatePrimitive(PrimitiveType.Cube);
            blade.name = "Blade";
            var bc = blade.GetComponent<Collider>(); if (bc != null) Destroy(bc);
            blade.transform.SetParent(root.transform, false);
            blade.transform.localPosition = new Vector3(0.08f, 0.3f, 0f);
            blade.transform.localScale = new Vector3(0.22f, 0.18f, 0.04f);
            blade.GetComponent<MeshRenderer>().sharedMaterial = Mat(new Color(0.72f, 0.74f, 0.78f), 0.9f, 0.7f);

            root.AddComponent<NoteBob>().phase = 0f;
            axeObject = root;
            PlayerProfile.Notify("🪓 Топор появился в офисной башне");
        }

        Material Mat(Color c, float metal = 0f, float smooth = 0.3f)
        {
            var m = new Material(lit);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metal);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
            return m;
        }

        public void PickAxe()
        {
            if (hasAxe) return;
            if (NotesFound < cfg.totalNotes)
            {
                PlayerProfile.Notify($"🔒 Сначала собери все страницы ({NotesFound}/{cfg.totalNotes})");
                return;
            }
            hasAxe = true;
            Save();
            if (axeObject != null) { Destroy(axeObject); axeObject = null; }
            PlayerProfile.Notify("🪓 Топор получен! Теперь сломай доски в GRAND MALL");
            PlayerProfile.I?.AddExp(100);
            AudioFX.Play("questComplete");
        }

        // ── ДОСКИ ──────────────────────────────────────────────────────────
        public void TryBreakBoards()
        {
            if (boardsBroken) return;
            if (NotesFound < cfg.totalNotes)
            {
                PlayerProfile.Notify($"🪵 На досках нацарапано: «СНАЧАЛА СОБЕРИ МОИ СТРАНИЦЫ» ({NotesFound}/{cfg.totalNotes})");
                return;
            }
            if (!hasAxe)
            {
                PlayerProfile.Notify("🪵 Доски не поддаются. Нужен ТОПОР — сейф в кабинете директора");
                return;
            }
            boardsBroken = true;
            Save();
            PlayerProfile.Notify("💥 Доски разлетелись в щепки! Служебный вход открыт");
            PlayerProfile.I?.AddExp(150);
            PlayerProfile.I?.AddCoins(50, "путь открыт");
            AudioFX.Play("doorOpen");
        }

        public void EnterBoss()
        {
            if (!boardsBroken)
            {
                PlayerProfile.Notify("🚪 Заперто. Сначала сломай доски");
                return;
            }
            PlayerProfile.Notify("🕳 Вы спускаетесь во тьму...");
            InteriorManager.I?.GoToFloor(0);   // B5 — самый нижний уровень
        }

        // ── ОКНО С ТЕКСТОМ ЗАПИСКИ ─────────────────────────────────────────
        GameObject noteUI;

        void ShowNote(string text)
        {
            if (noteUI != null) Destroy(noteUI);

            noteUI = new GameObject("NoteWindow");
            var canvas = noteUI.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 500;
            noteUI.AddComponent<GraphicRaycaster>();

            var bg = new GameObject("BG");
            bg.transform.SetParent(noteUI.transform, false);
            var brt = bg.AddComponent<RectTransform>();
            brt.anchorMin = new Vector2(0.5f, 0.5f); brt.anchorMax = new Vector2(0.5f, 0.5f);
            brt.sizeDelta = new Vector2(760, 460);
            bg.AddComponent<Image>().color = new Color(0.92f, 0.88f, 0.76f, 0.98f);

            var txt = new GameObject("Text");
            txt.transform.SetParent(bg.transform, false);
            var trt = txt.AddComponent<RectTransform>();
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
            trt.offsetMin = new Vector2(36, 74); trt.offsetMax = new Vector2(-36, -30);
            var t = txt.AddComponent<Text>();
            t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (t.font == null) t.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            t.fontSize = 22;
            t.color = new Color(0.16f, 0.12f, 0.08f);
            t.text = text;
            t.alignment = TextAnchor.UpperLeft;

            var btn = new GameObject("Close");
            btn.transform.SetParent(bg.transform, false);
            var crt = btn.AddComponent<RectTransform>();
            crt.anchorMin = new Vector2(0.5f, 0f); crt.anchorMax = new Vector2(0.5f, 0f);
            crt.anchoredPosition = new Vector2(0, 40);
            crt.sizeDelta = new Vector2(240, 48);
            btn.AddComponent<Image>().color = new Color(0.3f, 0.22f, 0.14f);
            var b = btn.AddComponent<Button>();
            b.onClick.AddListener(() => { Destroy(noteUI); Cursor.lockState = CursorLockMode.Locked; });

            var bt = new GameObject("Label");
            bt.transform.SetParent(btn.transform, false);
            var lrt = bt.AddComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero; lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero; lrt.offsetMax = Vector2.zero;
            var lt = bt.AddComponent<Text>();
            lt.font = t.font; lt.fontSize = 20; lt.color = Color.white;
            lt.text = "Закрыть"; lt.alignment = TextAnchor.MiddleCenter;

            Cursor.lockState = CursorLockMode.None;
        }

        // ── СОХРАНЕНИЕ ─────────────────────────────────────────────────────
        [Serializable] class ChainSave { public bool[] notes; public bool axe, boards, boss; }

        public void Save()
        {
            var s = new ChainSave { notes = notes, axe = hasAxe, boards = boardsBroken, boss = bossDead };
            PlayerPrefs.SetString(KEY, JsonUtility.ToJson(s));
            PlayerPrefs.Save();
        }

        void Load()
        {
            if (!PlayerPrefs.HasKey(KEY)) return;
            try
            {
                var s = JsonUtility.FromJson<ChainSave>(PlayerPrefs.GetString(KEY));
                if (s == null) return;
                if (s.notes != null && s.notes.Length > 0) notes = s.notes;
                hasAxe = s.axe; boardsBroken = s.boards; bossDead = s.boss;
            }
            catch (Exception e) { Debug.LogWarning("[Quest] " + e.Message); }
        }

        // Ближайшая записка — для взаимодействия по E
        public int NearestNote(Vector3 pos, float maxDist)
        {
            for (int i = 0; i < noteData.Count; i++)
            {
                var n = noteData[i];
                if (n.index < notes.Length && notes[n.index]) continue;
                float dx = n.x - pos.x, dz = n.z - pos.z;
                if (dx * dx + dz * dz < maxDist * maxDist) return n.index;
            }
            return -1;
        }

        public bool NearAxe(Vector3 pos, float maxDist)
        {
            if (axeObject == null) return false;
            return (axeObject.transform.position - pos).sqrMagnitude < maxDist * maxDist;
        }
    }

    // Записка покачивается и вращается — так её замечаешь боковым зрением.
    public class NoteBob : MonoBehaviour
    {
        public float phase;
        Vector3 basePos;
        void Start() { basePos = transform.position; }
        void Update()
        {
            transform.Rotate(Vector3.up, 45f * Time.deltaTime, Space.World);
            var p = basePos;
            p.y += Mathf.Sin(Time.time * 1.6f + phase) * 0.16f;
            transform.position = p;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ЗВУК
    //  В вебе звук синтезировался на WebAudio без единого файла. Здесь то
    //  же самое: генерируем AudioClip процедурно по параметрам из
    //  sounds.json. Плюс — не нужно тащить аудиофайлы в сборку.
    // ═══════════════════════════════════════════════════════════════════════
    [Serializable]
    public class SoundRec
    {
        public float freq, dur, vol;
        public string type;
    }

    public class AudioFX : MonoBehaviour
    {
        public static AudioFX I { get; private set; }

        readonly Dictionary<string, AudioClip> cache = new Dictionary<string, AudioClip>();
        readonly Dictionary<string, SoundRec> defs = new Dictionary<string, SoundRec>();
        AudioSource src;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
            src = gameObject.AddComponent<AudioSource>();
            src.playOnAwake = false;
            src.spatialBlend = 0f;
            SeedDefaults();
        }

        void SeedDefaults()
        {
            defs["elevatorBeep"]  = new SoundRec { freq = 880,  dur = 0.12f, type = "sine",     vol = 0.25f };
            defs["elevatorDing"]  = new SoundRec { freq = 1320, dur = 0.35f, type = "sine",     vol = 0.30f };
            defs["buttonClick"]   = new SoundRec { freq = 660,  dur = 0.05f, type = "square",   vol = 0.15f };
            defs["coinPickup"]    = new SoundRec { freq = 1046, dur = 0.18f, type = "triangle", vol = 0.20f };
            defs["questComplete"] = new SoundRec { freq = 784,  dur = 0.50f, type = "sine",     vol = 0.28f };
            defs["doorOpen"]      = new SoundRec { freq = 220,  dur = 0.40f, type = "sawtooth", vol = 0.18f };
            defs["footstep"]      = new SoundRec { freq = 160,  dur = 0.06f, type = "triangle", vol = 0.10f };
        }

        public static void Play(string id)
        {
            if (I == null) return;
            I.PlayInternal(id);
        }

        void PlayInternal(string id)
        {
            if (!defs.TryGetValue(id, out var d)) return;
            if (!cache.TryGetValue(id, out var clip))
            {
                clip = Generate(id, d);
                cache[id] = clip;
            }
            if (clip != null) src.PlayOneShot(clip, d.vol);
        }

        // Генерация тона нужной формы. Затухание по экспоненте, иначе
        // на конце слышен щелчок.
        AudioClip Generate(string id, SoundRec d)
        {
            int rate = 44100;
            int samples = Mathf.Max(64, Mathf.RoundToInt(rate * Mathf.Max(0.02f, d.dur)));
            var data = new float[samples];

            for (int i = 0; i < samples; i++)
            {
                float t = i / (float)rate;
                float phase = t * d.freq * Mathf.PI * 2f;
                float v;
                switch (d.type)
                {
                    case "square":   v = Mathf.Sign(Mathf.Sin(phase)); break;
                    case "sawtooth": v = 2f * ((t * d.freq) % 1f) - 1f; break;
                    case "triangle": v = Mathf.PingPong(t * d.freq * 2f, 1f) * 2f - 1f; break;
                    default:         v = Mathf.Sin(phase); break;
                }
                float env = Mathf.Exp(-4f * (i / (float)samples));
                data[i] = v * env;
            }

            var clip = AudioClip.Create(id, samples, 1, rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
