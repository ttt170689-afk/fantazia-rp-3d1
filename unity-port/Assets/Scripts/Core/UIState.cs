// ═══════════════════════════════════════════════════════════════════════════
//  FANTAZIA RP — ЕДИНЫЙ МЕНЕДЖЕР КУРСОРА И ОКОН
//
//  ПРОБЛЕМА, КОТОРУЮ ОН РЕШАЕТ:
//  Курсором управляли семь мест сразу — PlayerController, HUD (магазин),
//  HUD (квесты), панель лифта, окно записки, чат и главное меню. Каждое
//  дёргало Cursor.lockState по-своему, и они перебивали друг друга:
//  игрок открывал панель лифта, кликал по этажу — а PlayerController
//  в том же кадре видел «клик мышью» и запирал курсор обратно.
//  Со стороны это выглядело как «тыкаю, а курсор залочивается».
//
//  РЕШЕНИЕ: единственный владелец состояния. Окна регистрируются здесь,
//  а курсор считается один раз за кадр: открыто хоть одно окно —
//  курсор свободен, закрыты все — заперт.
// ═══════════════════════════════════════════════════════════════════════════
using System.Collections.Generic;
using UnityEngine;

namespace Fantazia.Core
{
    public class UIState : MonoBehaviour
    {
        public static UIState I { get; private set; }

        readonly HashSet<string> openWindows = new HashSet<string>();

        /// Открыто ли хоть одно окно поверх игры.
        public static bool AnyOpen => I != null && I.openWindows.Count > 0;

        /// Можно ли сейчас управлять персонажем и камерой.
        public static bool GameplayActive
        {
            get
            {
                if (!UI.MainMenu.GameStarted) return false;
                if (AnyOpen) return false;
                return true;
            }
        }

        void Awake()
        {
            if (I != null && I != this) { Destroy(gameObject); return; }
            I = this;
            DontDestroyOnLoad(gameObject);
        }

        public static void Open(string id)
        {
            if (I == null) return;
            I.openWindows.Add(id);
            I.Apply();
        }

        public static void Close(string id)
        {
            if (I == null) return;
            I.openWindows.Remove(id);
            I.Apply();
        }

        public static void Toggle(string id, bool open)
        {
            if (open) Open(id); else Close(id);
        }

        public static void CloseAll()
        {
            if (I == null) return;
            I.openWindows.Clear();
            I.Apply();
        }

        /// Есть ли конкретное окно в списке открытых.
        public static bool IsOpen(string id) => I != null && I.openWindows.Contains(id);

        void Apply()
        {
            bool free = openWindows.Count > 0 || !UI.MainMenu.GameStarted;
            // На телефоне курсора нет, и запирать нечего — попытка это
            // сделать ломает касания по кнопкам.
            if (Application.isMobilePlatform)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = false;
                return;
            }
            Cursor.lockState = free ? CursorLockMode.None : CursorLockMode.Locked;
            Cursor.visible = free;
        }

        // Страховка: если какое-то окно уничтожили, не сняв регистрацию,
        // состояние восстановится при следующем нажатии Escape.
        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape) && openWindows.Count > 0)
                CloseAll();
        }
    }
}
