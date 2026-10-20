// One still photo, not a filming mode. No HUD mutations, upload, or persistent image cache.
(function () {
  "use strict";
  let panel = null,
    url = null,
    file = null,
    focus = null,
    generation = 0;
  function close() {
    generation++;
    if (panel) {
      panel.hidden = true;
      panel.querySelector("img").removeAttribute("src");
    }
    if (url) URL.revokeObjectURL(url);
    url = null;
    file = null;
    if (focus?.isConnected) focus.focus();
    focus = null;
  }
  function message(s) {
    if (panel) panel.querySelector("[role=status]").textContent = s;
  }
  function mount() {
    if (panel) return;
    panel = document.createElement("section");
    panel.id = "fzPhoto";
    panel.className = "fz-play-dialog";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Фотография города");
    panel.innerHTML =
      '<div class="fz-play-card"><header><h2>Фото готово</h2><button data-close>Закрыть</button></header><img alt="Твой снимок игры без интерфейса" style="display:block;max-width:100%;max-height:52dvh;margin:16px auto;object-fit:contain"><div class="fz-play-tools"><button data-share>Поделиться / сохранить</button><button data-download>Скачать PNG</button><button data-open>Открыть изображение</button></div><p role="status">Снимок хранится только в этой вкладке. Выбери, как сохранить его.</p></div>';
    document.body.appendChild(panel);
    panel.querySelector("[data-close]").onclick = close;
    panel.querySelector("[data-download]").onclick = () => {
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      message(
        "Запрос на скачивание отправлен браузеру. На iPhone можно использовать «Поделиться».",
      );
    };
    panel.querySelector("[data-open]").onclick = () => {
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
      }
    };
    panel.querySelector("[data-share]").onclick = async () => {
      if (!file) return;
      try {
        if (!navigator.canShare?.({ files: [file] })) {
          message(
            "Обмен файлами недоступен. Скачай PNG или открой изображение и сохрани его через меню браузера.",
          );
          return;
        }
        await navigator.share({ files: [file], title: "Fantazia RP 3D" });
      } catch (e) {
        if (e.name !== "AbortError")
          message("Браузер не разрешил отправку. Можно скачать PNG.");
      }
    };
    panel.onclick = (e) => {
      if (e.target === panel) close();
    };
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const b = [...panel.querySelectorAll("button")];
        b[
          (b.indexOf(document.activeElement) +
            (e.shiftKey ? -1 : 1) +
            b.length) %
            b.length
        ].focus();
      }
      e.stopPropagation();
    });
  }
  function capture() {
    if (!window.FZUI?.playing() || !renderer || window.FZPlay?.paused())
      return false;
    close();
    mount();
    const ticket = ++generation;
    focus = document.activeElement;
    window.FZPlay?.release();
    try {
      renderer.render(scene, camera);
      renderer.domElement.toBlob((blob) => {
        if (ticket !== generation || !window.FZUI?.playing()) return;
        if (!blob) {
          showNotification(
            "Не удалось получить снимок. Попробуй ещё раз.",
            "info",
          );
          return;
        }
        file = new File([blob], "fantazia-" + Date.now() + ".png", {
          type: "image/png",
        });
        url = URL.createObjectURL(file);
        panel.querySelector("img").src = url;
        panel.hidden = false;
        message(
          "Снимок хранится только в этой вкладке. Выбери, как сохранить его.",
        );
        if (document.pointerLockElement) document.exitPointerLock();
        panel.querySelector("[data-close]").focus();
      }, "image/png");
      return true;
    } catch (e) {
      showNotification("Браузер не разрешил получить снимок.", "info");
      return false;
    }
  }
  window.FZPhoto = {
    capture,
    close,
    info: () => ({ open: !!panel && !panel.hidden, hasImage: !!url }),
  };
})();
