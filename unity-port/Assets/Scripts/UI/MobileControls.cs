// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — МОБИЛЬНОЕ УПРАВЛЕНИЕ
//
//  Повторяет раскладку веб-версии: джойстик слева, свайп-камера справа,
//  кнопки действий. Учтены все грабли, на которые мы напоролись в v51:
//   • одно касание = одно действие (в вебе кнопки срабатывали дважды,
//     потому что после touch браузер слал ещё и click);
//   • палец, уведённый за край кнопки, не оставляет её «нажатой»;
//   • мультитач: джойстик и камера работают одновременно, каждый
//     запоминает свой fingerId.
// ═══════════════════════════════════════════════════════════════════════════
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Fantazia.Player;

namespace Fantazia.UI
{
    public class MobileControls : MonoBehaviour
    {
        [Header("Ссылки")]
        public PlayerController player;
        public RectTransform joystickBase;
        public RectTransform joystickKnob;
        public Canvas canvas;

        [Header("Настройки")]
        public float joystickRadius = 90f;
        public float lookSensitivity = 0.12f;
        [Tooltip("Правее этой доли экрана — зона обзора камеры")]
        public float lookZoneStart = 0.5f;

        int moveFinger = -1;
        int lookFinger = -1;
        Vector2 joyStart;
        Vector2 lastLook;

        void Start()
        {
            bool mobile = Application.isMobilePlatform;
#if UNITY_EDITOR
            mobile = true;   // в редакторе показываем, чтобы можно было настроить
#endif
            gameObject.SetActive(mobile);
            if (player == null) player = FindObjectOfType<PlayerController>();
        }

        void Update()
        {
            if (player == null) return;
            HandleTouches();
        }

        void HandleTouches()
        {
            // сбрасываем ввод, если пальцев не осталось
            if (Input.touchCount == 0)
            {
                ResetJoystick();
                player.MobileMove = Vector2.zero;
                moveFinger = lookFinger = -1;
                return;
            }

            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch t = Input.GetTouch(i);
                bool leftSide = t.position.x < Screen.width * lookZoneStart;

                switch (t.phase)
                {
                    case TouchPhase.Began:
                        // палец по UI-кнопке — не перехватываем
                        if (IsOverUI(t.fingerId)) break;

                        if (leftSide && moveFinger == -1)
                        {
                            moveFinger = t.fingerId;
                            joyStart = t.position;
                            ShowJoystick(t.position);
                        }
                        else if (!leftSide && lookFinger == -1)
                        {
                            lookFinger = t.fingerId;
                            lastLook = t.position;
                        }
                        break;

                    case TouchPhase.Moved:
                    case TouchPhase.Stationary:
                        if (t.fingerId == moveFinger)
                        {
                            Vector2 d = t.position - joyStart;
                            float mag = Mathf.Min(d.magnitude, joystickRadius);
                            Vector2 dir = d.sqrMagnitude > 0.001f ? d.normalized : Vector2.zero;
                            player.MobileMove = dir * (mag / joystickRadius);
                            MoveKnob(dir * mag);
                        }
                        else if (t.fingerId == lookFinger)
                        {
                            Vector2 d = t.position - lastLook;
                            lastLook = t.position;
                            player.MobileLook += d * lookSensitivity;
                        }
                        break;

                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        // Важно: сбрасываем именно по fingerId. Иначе если увести
                        // палец за край кнопки, движение «залипнет».
                        if (t.fingerId == moveFinger)
                        {
                            moveFinger = -1;
                            player.MobileMove = Vector2.zero;
                            ResetJoystick();
                        }
                        if (t.fingerId == lookFinger) lookFinger = -1;
                        break;
                }
            }
        }

        bool IsOverUI(int fingerId)
        {
            return EventSystem.current != null &&
                   EventSystem.current.IsPointerOverGameObject(fingerId);
        }

        void ShowJoystick(Vector2 screenPos)
        {
            if (joystickBase == null || canvas == null) return;
            joystickBase.gameObject.SetActive(true);
            RectTransformUtility.ScreenPointToLocalPointInRectangle(
                canvas.transform as RectTransform, screenPos,
                canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera,
                out Vector2 local);
            joystickBase.anchoredPosition = local;
            if (joystickKnob != null) joystickKnob.anchoredPosition = Vector2.zero;
        }

        void MoveKnob(Vector2 offset)
        {
            if (joystickKnob != null) joystickKnob.anchoredPosition = offset;
        }

        void ResetJoystick()
        {
            if (joystickKnob != null) joystickKnob.anchoredPosition = Vector2.zero;
        }

        // ── Кнопки вешаются через инспектор ────────────────────────────────
        public void OnJumpDown() { if (player != null) player.MobileJumpPressed = true; }
        public void OnSprintDown() { if (player != null) player.MobileSprint = true; }
        public void OnSprintUp() { if (player != null) player.MobileSprint = false; }
        public void OnCrouchDown() { if (player != null) player.isCrouching = true; }
        public void OnCrouchUp() { if (player != null) player.isCrouching = false; }
        public void OnToggleView() { if (player != null) player.firstPerson = !player.firstPerson; }
    }
}
