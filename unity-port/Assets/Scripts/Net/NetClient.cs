// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — СЕТЬ: подключение Unity к существующему Node-серверу
//
//  ВАЖНОЕ РЕШЕНИЕ: сервер (server.js) НЕ переписываем. Он уже работает,
//  в нём аккаунты, экономика, чат и античит v52. Unity подключается к нему
//  как ещё один клиент — тогда игроки из браузера и из Unity-сборки
//  окажутся в одном мире.
//
//  ПРОТОКОЛ: сервер использует Socket.IO. Для Unity есть два пути:
//   1) поставить готовый пакет Socket.IO-клиента (проще, но зависимость);
//   2) говорить с сервером по чистому WebSocket в формате Engine.IO.
//  Здесь реализован вариант 2 — без внешних пакетов, чтобы проект
//  собирался сразу после клонирования. Формат кадров Engine.IO/Socket.IO
//  простой: "42[\"событие\",{данные}]" для сообщений, "2"/"3" — пинг-понг.
//
//  Если удобнее вариант 1 — поставьте пакет и замените Send/Parse,
//  остальной код (события, античит-канал) останется прежним.
// ═══════════════════════════════════════════════════════════════════════════
using System;
using System.Collections;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Fantazia.Net
{
    [Serializable]
    public class NetVec { public float x, y, z; }

    [Serializable]
    public class RemotePlayerState
    {
        public string id;
        public string name;
        public NetVec position;
        public float rotY;
        public string animation;
    }

    public class NetClient : MonoBehaviour
    {
        public static NetClient I { get; private set; }

        [Header("Сервер")]
        [Tooltip("Адрес Node-сервера. Для локальной отладки — localhost:3000")]
        public string serverHost = "localhost";
        public int serverPort = 3000;
        public bool useSecure = false;         // wss:// для продакшена
        public bool autoConnect = true;
        public string playerName = "UnityPlayer";

        [Header("Состояние")]
        public bool Connected;
        public string SocketId;

        ClientWebSocket ws;
        CancellationTokenSource cts;
        readonly Queue<string> outbox = new Queue<string>();
        readonly object outLock = new object();

        public event Action<RemotePlayerState> OnPlayerMoved;
        public event Action<string> OnPlayerLeft;
        public event Action<string, string> OnChat;      // имя, текст
        public event Action<Vector3, string> OnPositionReset;  // античит откатил

        float sendTimer;
        const float SEND_RATE = 0.05f;   // 20 пакетов/сек — как в вебе

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            if (autoConnect) Connect();
        }

        public async void Connect()
        {
            try
            {
                string scheme = useSecure ? "wss" : "ws";
                // Engine.IO требует указать транспорт и версию протокола
                string url = $"{scheme}://{serverHost}:{serverPort}/socket.io/?EIO=4&transport=websocket";

                ws = new ClientWebSocket();
                cts = new CancellationTokenSource();
                await ws.ConnectAsync(new Uri(url), cts.Token);
                Connected = true;
                Debug.Log("[Net] подключено к " + url);

                _ = ReceiveLoop();
                StartCoroutine(SendLoop());
            }
            catch (Exception e)
            {
                Connected = false;
                Debug.LogWarning("[Net] не удалось подключиться: " + e.Message +
                                 "\nИгра продолжит работать в одиночном режиме.");
            }
        }

        async Task ReceiveLoop()
        {
            var buf = new byte[16384];
            var sb = new StringBuilder();
            try
            {
                while (ws != null && ws.State == WebSocketState.Open)
                {
                    var res = await ws.ReceiveAsync(new ArraySegment<byte>(buf), cts.Token);
                    if (res.MessageType == WebSocketMessageType.Close) break;
                    sb.Append(Encoding.UTF8.GetString(buf, 0, res.Count));
                    if (!res.EndOfMessage) continue;
                    string msg = sb.ToString();
                    sb.Clear();
                    HandleRaw(msg);
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[Net] приём прерван: " + e.Message);
            }
            Connected = false;
        }

        void HandleRaw(string msg)
        {
            if (string.IsNullOrEmpty(msg)) return;

            // Engine.IO: 0=открытие, 2=пинг, 3=понг, 4=сообщение
            char t = msg[0];

            if (t == '0')
            {
                // рукопожатие: сразу переходим в namespace "/"
                Enqueue("40");
                return;
            }
            if (t == '2') { Enqueue("3"); return; }   // пинг → понг
            if (t != '4') return;

            if (msg.Length < 2) return;
            char st = msg[1];
            if (st == '0')
            {
                // подключение к namespace подтверждено
                SendEvent("registerPlayer", "{\"name\":\"" + Escape(playerName) + "\"}");
                return;
            }
            if (st != '2') return;   // нас интересуют только события

            string payload = msg.Substring(2);
            // формат: ["событие", {...}]  — вытаскиваем имя и тело
            int q1 = payload.IndexOf('"');
            if (q1 < 0) return;
            int q2 = payload.IndexOf('"', q1 + 1);
            if (q2 < 0) return;
            string evt = payload.Substring(q1 + 1, q2 - q1 - 1);
            int comma = payload.IndexOf(',', q2);
            string body = comma >= 0
                ? payload.Substring(comma + 1, payload.Length - comma - 2)
                : "{}";

            // Unity API нельзя трогать из фонового потока
            MainThread.Run(() => Dispatch(evt, body));
        }

        void Dispatch(string evt, string body)
        {
            switch (evt)
            {
                case "playerMoved":
                    var st = JsonUtility.FromJson<RemotePlayerState>(body);
                    if (st != null) OnPlayerMoved?.Invoke(st);
                    break;

                case "playerLeft":
                case "playerDisconnected":
                    OnPlayerLeft?.Invoke(body);
                    break;

                case "positionReset":
                    // Античит на сервере отменил перемещение
                    var r = JsonUtility.FromJson<ResetMsg>(body);
                    if (r?.position != null)
                    {
                        var v = new Vector3(r.position.x, r.position.y, r.position.z);
                        OnPositionReset?.Invoke(v, r.reason);
                        Debug.Log($"[Net] античит откатил позицию: {r.reason}");
                    }
                    break;

                case "chatMessage":
                    var c = JsonUtility.FromJson<ChatMsg>(body);
                    if (c != null) OnChat?.Invoke(c.name, c.text);
                    break;
            }
        }

        [Serializable] class ResetMsg { public NetVec position; public string reason; }
        [Serializable] class ChatMsg { public string name; public string text; }

        // ── ОТПРАВКА ───────────────────────────────────────────────────────
        void Enqueue(string frame)
        {
            lock (outLock) outbox.Enqueue(frame);
        }

        public void SendEvent(string evt, string jsonBody)
        {
            Enqueue("42[\"" + evt + "\"," + (jsonBody ?? "{}") + "]");
        }

        IEnumerator SendLoop()
        {
            while (Connected)
            {
                string frame = null;
                lock (outLock) if (outbox.Count > 0) frame = outbox.Dequeue();
                if (frame != null) yield return SendRaw(frame);
                else yield return null;
            }
        }

        IEnumerator SendRaw(string frame)
        {
            var task = SendAsync(frame);
            while (!task.IsCompleted) yield return null;
        }

        async Task SendAsync(string frame)
        {
            try
            {
                if (ws == null || ws.State != WebSocketState.Open) return;
                var bytes = Encoding.UTF8.GetBytes(frame);
                await ws.SendAsync(new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text, true, cts.Token);
            }
            catch (Exception e) { Debug.LogWarning("[Net] отправка: " + e.Message); }
        }

        // ── ИГРОВЫЕ СОБЫТИЯ ────────────────────────────────────────────────
        public void SendPosition(Vector3 p, float rotY, string anim)
        {
            if (!Connected) return;
            sendTimer += Time.deltaTime;
            if (sendTimer < SEND_RATE) return;
            sendTimer = 0f;

            string body = "{\"position\":{\"x\":" + F(p.x) + ",\"y\":" + F(p.y) +
                          ",\"z\":" + F(p.z) + "},\"rotation\":{\"y\":" + F(rotY) +
                          "},\"animation\":\"" + (anim ?? "idle") + "\"}";
            SendEvent("updatePosition", body);
        }

        // Легальный телепорт: вход в здание, смена этажа.
        // Без него серверный античит примет перемещение за читерский рывок.
        public void SendLegalTeleport(Vector3 p)
        {
            if (!Connected) return;
            SendEvent("legalTeleport",
                "{\"position\":{\"x\":" + F(p.x) + ",\"y\":" + F(p.y) + ",\"z\":" + F(p.z) + "}}");
        }

        public void SendChat(string text)
        {
            if (!Connected || string.IsNullOrEmpty(text)) return;
            SendEvent("sendChat", "{\"text\":\"" + Escape(text) + "\"}");
        }

        static string F(float v) => v.ToString("0.###",
            System.Globalization.CultureInfo.InvariantCulture);

        static string Escape(string s) =>
            s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ");

        void OnDestroy()
        {
            try { cts?.Cancel(); ws?.Dispose(); } catch { }
        }
    }

    // Простой диспетчер в главный поток: WebSocket приходит в фоновом,
    // а Unity API можно трогать только из главного.
    public class MainThread : MonoBehaviour
    {
        static readonly Queue<Action> queue = new Queue<Action>();
        static MainThread inst;

        public static void Run(Action a)
        {
            if (a == null) return;
            lock (queue) queue.Enqueue(a);
        }

        [RuntimeInitializeOnLoadMethod]
        static void Init()
        {
            if (inst != null) return;
            var go = new GameObject("~MainThreadDispatcher");
            DontDestroyOnLoad(go);
            inst = go.AddComponent<MainThread>();
        }

        void Update()
        {
            lock (queue)
                while (queue.Count > 0)
                {
                    try { queue.Dequeue()?.Invoke(); }
                    catch (Exception e) { Debug.LogError("[MainThread] " + e.Message); }
                }
        }
    }
}
