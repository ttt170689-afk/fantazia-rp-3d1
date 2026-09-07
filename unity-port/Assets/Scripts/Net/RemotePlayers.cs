// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ДРУГИЕ ИГРОКИ
//
//  Показывает игроков, подключённых к тому же Node-серверу, — включая тех,
//  кто играет в браузере. Сервер один, протокол один, поэтому Unity-сборка
//  и веб-версия видят друг друга.
//
//  ЧТО ВАЖНО ДЛЯ ТЕЛЕФОНОВ (уроки из веб-версии v52):
//   • позиции интерполируются кадронезависимо — на 30 и 144 FPS
//     движение выглядит одинаково, а не «в два раза медленнее»;
//   • дальние игроки не анимируются и скрываются целиком: скелет —
//     самая дорогая часть, и считать его для тех, кто за километр,
//     бессмысленно;
//   • есть бюджет: одновременно анимируется не больше N ближайших.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using UnityEngine;
using Fantazia.Player;

namespace Fantazia.Net
{
    public class RemotePlayers : MonoBehaviour
    {
        public static RemotePlayers I { get; private set; }

        [Header("Производительность")]
        public float visibleDistance = 160f;
        public int animBudget = 10;

        class Remote
        {
            public GameObject go;
            public PlayerModel model;
            public Vector3 target;
            public float targetRot;
            public string anim;
            public float lastSeen;
        }

        readonly Dictionary<string, Remote> players = new Dictionary<string, Remote>();
        Transform localPlayer;

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            if (Application.isMobilePlatform) { visibleDistance = 110f; animBudget = 6; }
        }

        void Start()
        {
            if (NetClient.I != null)
            {
                NetClient.I.OnPlayerMoved += HandleMoved;
                NetClient.I.OnPlayerLeft += HandleLeft;
            }
        }

        void HandleMoved(RemotePlayerState st)
        {
            if (st == null || string.IsNullOrEmpty(st.id)) return;
            if (st.position == null) return;

            if (!players.TryGetValue(st.id, out var r))
            {
                r = Spawn(st);
                players[st.id] = r;
            }
            r.target = new Vector3(st.position.x, st.position.y, st.position.z);
            r.targetRot = st.rotY;
            r.anim = st.animation;
            r.lastSeen = Time.time;
        }

        Remote Spawn(RemotePlayerState st)
        {
            var go = new GameObject("Remote_" + (string.IsNullOrEmpty(st.name) ? st.id : st.name));
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(st.position.x, st.position.y, st.position.z);

            // та же модель, что у игрока: одинаковый вид у всех
            var modelGO = new GameObject("Model");
            modelGO.transform.SetParent(go.transform, false);
            var model = modelGO.AddComponent<PlayerModel>();
            // чужих красим иначе, чтобы отличать от себя
            model.shirt = new Color(0.85f, 0.45f, 0.3f);

            // ник над головой
            var tagGO = new GameObject("NameTag");
            tagGO.transform.SetParent(go.transform, false);
            tagGO.transform.localPosition = new Vector3(0f, 2.1f, 0f);
            var tm = tagGO.AddComponent<TextMesh>();
            tm.text = string.IsNullOrEmpty(st.name) ? "Игрок" : st.name;
            tm.characterSize = 0.12f;
            tm.fontSize = 64;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;
            tm.color = Color.white;
            tagGO.AddComponent<FaceCamera>();

            return new Remote { go = go, model = model, target = go.transform.position,
                                anim = "idle", lastSeen = Time.time };
        }

        void HandleLeft(string id)
        {
            if (string.IsNullOrEmpty(id)) return;
            // сервер может прислать как чистый id, так и JSON-строку
            id = id.Trim('"', '{', '}', ' ');
            foreach (var key in new List<string>(players.Keys))
            {
                if (!key.Contains(id) && !id.Contains(key)) continue;
                if (players[key].go != null) Destroy(players[key].go);
                players.Remove(key);
                break;
            }
        }

        void Update()
        {
            if (localPlayer == null)
            {
                var pc = FindObjectOfType<PlayerController>();
                if (pc != null) localPlayer = pc.transform;
            }

            float dt = Time.deltaTime;
            // кадронезависимое сглаживание: за dt секунд догоняем одну
            // и ту же долю пути независимо от FPS
            float k = 1f - Mathf.Exp(-12f * dt);
            float vis2 = visibleDistance * visibleDistance;
            int budget = animBudget;
            Vector3 me = localPlayer != null ? localPlayer.position : Vector3.zero;

            var dead = new List<string>();
            foreach (var kv in players)
            {
                var r = kv.Value;
                if (r.go == null) { dead.Add(kv.Key); continue; }

                // игрок пропал со связи — убираем через 15 секунд
                if (Time.time - r.lastSeen > 15f) { dead.Add(kv.Key); continue; }

                r.go.transform.position = Vector3.Lerp(r.go.transform.position, r.target, k);
                float cur = r.go.transform.eulerAngles.y;
                float diff = Mathf.DeltaAngle(cur, r.targetRot * Mathf.Rad2Deg);
                r.go.transform.rotation = Quaternion.Euler(0f, cur + diff * k, 0f);

                // дальних не показываем вовсе — экономия и на рендере,
                // и на анимации скелета
                float dx = r.target.x - me.x, dz = r.target.z - me.z;
                bool near = (dx * dx + dz * dz) < vis2;
                if (r.go.activeSelf != near) r.go.SetActive(near);
                if (!near) continue;

                // анимация только ближайшим, по бюджету
                if (r.model != null) r.model.enabled = budget-- > 0;
            }

            foreach (var d in dead)
            {
                if (players[d].go != null) Destroy(players[d].go);
                players.Remove(d);
            }
        }

        public int Count => players.Count;
    }

    // Ник всегда повёрнут к камере — иначе читается только с одной стороны.
    public class FaceCamera : MonoBehaviour
    {
        Transform cam;
        void Update()
        {
            if (cam == null)
            {
                if (Camera.main == null) return;
                cam = Camera.main.transform;
            }
            transform.rotation = Quaternion.LookRotation(transform.position - cam.position);
        }
    }
}
