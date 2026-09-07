// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — КОНТРОЛЛЕР ИГРОКА
//
//  Переносит поведение JS-версии один в один, но на физике Unity:
//   • скорости взяты из world.json (переведены из «на кадр» в «в секунду»);
//   • камера от третьего и первого лица, переключение по V;
//   • приседание (Ctrl / C) — механика из v53;
//   • мобильное управление: джойстик слева, свайп-камера справа;
//   • сглаживание кадронезависимое, как в v52.
//
//  CharacterController выбран вместо Rigidbody осознанно: в игре нужен
//  аркадный контроль без инерции и застреваний в стыках коллайдеров,
//  а весь мир — статичная геометрия.
// ═══════════════════════════════════════════════════════════════════════════
using UnityEngine;
using Fantazia.Core;

namespace Fantazia.Player
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Движение (перезапишется из world.json)")]
        public float moveSpeed = 9f;
        public float sprintSpeed = 16.8f;
        public float jumpForce = 12f;
        public float gravity = 28.8f;

        [Header("Камера")]
        public Transform cameraRig;
        public float camDistance = 8f;
        public float camHeight = 4f;
        public float mouseSensitivity = 2.2f;
        public float minPitch = -35f;
        public float maxPitch = 70f;

        [Header("Состояние")]
        public bool isCrouching;
        public bool firstPerson;

        CharacterController cc;
        Camera cam;
        float yaw, pitch = 12f;
        float vertVel;
        float crouchLerp;
        Vector3 lastPos;
        float curSpeed;

        // мобильный ввод
        public Vector2 MobileMove { get; set; }
        public Vector2 MobileLook { get; set; }
        public bool MobileSprint { get; set; }
        public bool MobileJumpPressed { get; set; }

        public float CurrentSpeed => curSpeed;
        public bool IsGrounded => cc != null && cc.isGrounded;
        public bool IsMoving => curSpeed > 0.35f;
        public bool IsRunning => curSpeed > 6.5f;

        void Start()
        {
            cc = GetComponent<CharacterController>();
            cam = Camera.main;
            if (cameraRig == null && cam != null) cameraRig = cam.transform;
            lastPos = transform.position;

            if (GameData.I != null)
            {
                if (GameData.I.Ready) ApplyConfig();
                else GameData.I.OnReady += ApplyConfig;
            }
        }

        void ApplyConfig()
        {
            var w = GameData.I.World;
            moveSpeed = w.moveSpeed;
            sprintSpeed = w.sprintSpeed;
            jumpForce = w.jumpForce;
            gravity = w.gravity;
            camDistance = w.cameraDistance;
            camHeight = w.cameraHeight;

            if (w.spawn != null)
            {
                // CharacterController не даёт двигать transform напрямую,
                // пока включён — иначе телепорт «не прилипает».
                cc.enabled = false;
                transform.position = w.spawn.V;
                cc.enabled = true;
            }
            Debug.Log($"[Fantazia] Конфиг применён: ходьба {moveSpeed}, бег {sprintSpeed}");
        }

        void Update()
        {
            // пока открыто любое окно (магазин, лифт, квесты, чат) —
            // не двигаемся и не крутим камеру
            if (Fantazia.Core.UIState.AnyOpen ||
                (Fantazia.Core.ChatUI.I != null && Fantazia.Core.ChatUI.I.IsTyping))
            {
                MobileMove = Vector2.zero;
                MobileLook = Vector2.zero;
                UpdateCamera();
                return;
            }

            HandleLook();
            HandleMove();
            UpdateCamera();
            TrackSpeed();
        }

        // ── ОБЗОР ──────────────────────────────────────────────────────────
        void HandleLook()
        {
            float mx = 0f, my = 0f;

            // мышь — только при зажатой ПКМ или захвате курсора,
            // иначе камера крутится когда игрок кликает по UI
            if (Cursor.lockState == CursorLockMode.Locked || Input.GetMouseButton(1))
            {
                mx = Input.GetAxisRaw("Mouse X") * mouseSensitivity;
                my = Input.GetAxisRaw("Mouse Y") * mouseSensitivity;
            }

            // мобильный свайп
            mx += MobileLook.x * mouseSensitivity * 0.6f;
            my += MobileLook.y * mouseSensitivity * 0.6f;
            MobileLook = Vector2.zero;

            yaw += mx;
            pitch = Mathf.Clamp(pitch - my, minPitch, maxPitch);

            if (Input.GetKeyDown(KeyCode.V)) firstPerson = !firstPerson;

            // v2: курсором управляет ТОЛЬКО UIState.
            // Раньше здесь стоял захват на любой клик — и когда игрок
            // тыкал в кнопку этажа или в магазин, курсор запирался
            // прямо посреди нажатия. Теперь захват происходит лишь
            // когда все окна закрыты.
            if (Input.GetMouseButtonDown(0) && !Application.isMobilePlatform
                && !Fantazia.Core.UIState.AnyOpen
                && !UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject())
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
        }

        // ── ДВИЖЕНИЕ ───────────────────────────────────────────────────────
        void HandleMove()
        {
            // приседание
            bool wantCrouch = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.C);
            isCrouching = wantCrouch;
            crouchLerp = Mathf.Lerp(crouchLerp, isCrouching ? 1f : 0f, Time.deltaTime * 10f);

            // высота коллайдера под приседание
            cc.height = Mathf.Lerp(1.8f, 1.2f, crouchLerp);
            cc.center = new Vector3(0f, cc.height * 0.5f, 0f);

            // направление: клавиатура + джойстик
            float h = Input.GetAxisRaw("Horizontal") + MobileMove.x;
            float v = Input.GetAxisRaw("Vertical") + MobileMove.y;
            Vector3 input = Vector3.ClampMagnitude(new Vector3(h, 0f, v), 1f);

            // движемся относительно направления камеры (как в JS-версии)
            Vector3 fwd = Quaternion.Euler(0f, yaw, 0f) * Vector3.forward;
            Vector3 right = Quaternion.Euler(0f, yaw, 0f) * Vector3.right;
            Vector3 dir = (fwd * input.z + right * input.x);

            // Бег требует выносливости: на нуле Shift не работает,
            // иначе можно было бежать бесконечно.
            bool wantSprint = (Input.GetKey(KeyCode.LeftShift) || MobileSprint) && !isCrouching;
            bool sprint = wantSprint &&
                (Fantazia.UI.Stamina.I == null || Fantazia.UI.Stamina.I.CanSprint);
            float speed = sprint ? sprintSpeed : moveSpeed;
            if (isCrouching) speed *= 0.45f;

            // поворот модели по ходу движения
            if (dir.sqrMagnitude > 0.001f)
            {
                if (firstPerson)
                {
                    transform.rotation = Quaternion.Euler(0f, yaw, 0f);
                }
                else
                {
                    Quaternion target = Quaternion.LookRotation(dir);
                    transform.rotation = Quaternion.Slerp(
                        transform.rotation, target, 1f - Mathf.Exp(-14f * Time.deltaTime));
                }
            }
            else if (firstPerson)
            {
                transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            }

            // гравитация и прыжок
            if (cc.isGrounded)
            {
                if (vertVel < 0f) vertVel = -2f;   // прижимаем к земле
                bool jump = Input.GetKeyDown(KeyCode.Space) || MobileJumpPressed;
                if (jump && !isCrouching) vertVel = jumpForce;
            }
            else
            {
                vertVel -= gravity * Time.deltaTime;
            }
            MobileJumpPressed = false;

            Vector3 motion = dir * speed + Vector3.up * vertVel;
            cc.Move(motion * Time.deltaTime);
        }

        // ── КАМЕРА ─────────────────────────────────────────────────────────
        void UpdateCamera()
        {
            if (cameraRig == null) return;

            if (firstPerson)
            {
                // ── ВИД ОТ ПЕРВОГО ЛИЦА ──
                // Модель ОБЯЗАТЕЛЬНО прячем: иначе камера стоит внутри
                // головы и весь экран занимает затылок изнутри.
                SetModelVisible(false);

                Vector3 eye = transform.position + Vector3.up * (1.62f - crouchLerp * 0.35f);
                // покачивание головы при ходьбе — без него движение
                // ощущается «скольжением на коньках»
                float bobAmp = IsRunning ? 0.055f : (IsMoving ? 0.028f : 0f);
                float bobFreq = IsRunning ? 11f : 7f;
                float bob = Mathf.Abs(Mathf.Sin(Time.time * bobFreq)) * bobAmp;
                float sway = Mathf.Sin(Time.time * bobFreq * 0.5f) * bobAmp * 0.5f;

                cameraRig.position = eye + Vector3.up * bob
                                   + cameraRig.right * sway;
                cameraRig.rotation = Quaternion.Euler(pitch, yaw, 0f);
                return;
            }
            SetModelVisible(true);

            // третье лицо: орбита вокруг игрока
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 focus = transform.position + Vector3.up * (camHeight - crouchLerp * 0.4f);
            Vector3 want = focus - rot * Vector3.forward * camDistance;

            // не даём камере уходить в стены
            Vector3 dirToCam = want - focus;
            if (Physics.Raycast(focus, dirToCam.normalized, out RaycastHit hit,
                                dirToCam.magnitude, ~0, QueryTriggerInteraction.Ignore))
            {
                want = hit.point + hit.normal * 0.28f;
            }

            // кадронезависимое сглаживание — одинаково на 30 и 144 FPS
            float k = 1f - Mathf.Exp(-18f * Time.deltaTime);
            cameraRig.position = Vector3.Lerp(cameraRig.position, want, k);
            cameraRig.LookAt(focus);
        }

        // Прячем/показываем модель целиком, включая надетую косметику.
        Renderer[] modelRenderers;
        bool modelVisible = true;

        void SetModelVisible(bool vis)
        {
            if (vis == modelVisible && modelRenderers != null) return;
            modelVisible = vis;
            // пересобираем список: косметику могли надеть только что
            modelRenderers = GetComponentsInChildren<Renderer>(true);
            foreach (var r in modelRenderers)
            {
                if (r == null) continue;
                // ник над головой и UI не трогаем
                if (r is UnityEngine.UI.Graphic) continue;
                r.enabled = vis;
            }
        }

        void TrackSpeed()
        {
            Vector3 d = transform.position - lastPos;
            d.y = 0f;
            float inst = d.magnitude / Mathf.Max(Time.deltaTime, 0.0001f);
            if (inst < 60f)  // отсекаем телепорты (вход в здание)
                curSpeed = Mathf.Lerp(curSpeed, inst, 1f - Mathf.Exp(-9f * Time.deltaTime));
            lastPos = transform.position;
        }

        // Легальный телепорт: вход в здание, смена этажа.
        // CharacterController нужно выключить, иначе позиция «не прилипнет».
        public void Teleport(Vector3 pos)
        {
            cc.enabled = false;
            transform.position = pos;
            cc.enabled = true;
            lastPos = pos;
            curSpeed = 0f;
            vertVel = 0f;
            Net.NetClient.I?.SendLegalTeleport(pos);
        }
    }
}
