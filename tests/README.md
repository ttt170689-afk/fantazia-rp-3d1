## v24 — музыка / голос / SFX / микшер

`npm test --prefix tests`: **18 групп**. `sound24.test.cjs` проверяет WAV,
записи, настройки, lifecycle/приглушение/отмену позднего декодирования и
отказ AudioContext. Генератор музыки не требуется для запуска тестов.

```bash
node tests/sound24.browser.test.cjs
```

Новый сценарий использует реальный AnalyserNode для ненулевого сигнала,
декодирует три музыкальные темы, проверяет media playing/ducking, мобильный
микшер, прежний переключатель музыки, сохранение/mute, фокус, нативные
фонарь и ходьбу (шаги включаются явно), повтор заставки, все звуковые зоны,
приоритет метро, восстановление фона и выход. Visibility моделируется
свойством/event, не реальным сворачиванием приложения ОС. Headless audio
не является субъективной оценкой звучания на динамике телефона.

В v24 также PASS: metro23, ui-refresh, opening-v22, phone-ready,
front-fallback и front-touch — **7 browser-сценариев** вместе с новым.
Зависимости стенда: playwright-core и @sparticuz/chromium 133.0.0;
`CHROMIUM_EXECUTABLE`/`GAME_URL` поддерживаются. На стенде дополнительно
использованы `NODE_PATH=/home/user/browser-tools/node_modules` и
`LD_LIBRARY_PATH=/home/user/browser-tools/libs/lib`.
Подробности: `docs/UPDATE-V24.md`. Скриншот: `/home/user/sound24-phone.png`.

## v23 — хват фонаря / лобби / метро

`npm test --prefix tests`: **17 групп**. Новая `metro23.test.cjs` проверяет
пять станций/локальные MP3, конечность и длительности фаз, коллизии платформы
и вагона, реальную кисть SuperRig вместо устаревшей, ось и начало луча.

```bash
node tests/metro23.browser.test.cjs
```

Chromium/Playwright: при необходимости задайте `CHROMIUM_EXECUTABLE`,
`GAME_URL` (по умолчанию http://127.0.0.1:3000), `NODE_PATH` и `LD_LIBRARY_PATH`.
Сервер должен работать. Тест создаёт временную учётную запись; не запускайте
на production. Проверяет реальные Play, меню, маршрут, звук, E/touch-вход,
ходьбу, посадку, все пять остановок и замыкание кольца, выход, camera layers,
ресурсный baseline и отсутствие pageerrors. Фазы ускоряются программно.

В v23 также PASS: ui-refresh, phone-ready, opening-v22, opening-native,
front-fallback, front-touch, sky и sky-visual. Вместе **9 browser-сценариев**.
В sky скорректировано ожидаемое число действий 3 → 4: новый киоск метро.
Запускайте browser-сценарии последовательно. Это не тест FPS физического телефона.
Скриншоты вне репозитория: `/home/user/lobby23-phone.png`, `/home/user/metro23-phone.png`.
Подробности и границы проверок: `docs/UPDATE-V23.md`.

## v22 — реальные модели, шаг и двухпроходный пролёт

`npm test --prefix tests`: 16 групп. `opening-cast.test.cjs` дополнен
проверками округлых/PBR-моделей, опоры стопы в мире, её подъёма и стойки.

```bash
node tests/opening-v22.browser.test.cjs
```

Тест включает ultra FX до повторного запуска и сравнивает реальные пиксели
города до/после слоя букв внутри A; проверяет отсутствие HTML-zoom,
новые модели, маркер версии и отказ шрифта. Также PASS: opening-native,
front-fallback, front-touch, sky-visual и sky — 6 browser-сценариев.
В sky-visual устранена гонка baseline после AA: ждём настоящего кадра города
до подсчёта буферов, не ослабляя лимит роста. Детали: `docs/UPDATE-V22.md`.

## v21 — маршруты и управляемая подсветка

`npm test --prefix tests`: **16 групп**. Новая `sky-neon.test.cjs` проверяет
настройки, сегменты маршрутов, направление стрелок/высоту ступеней, яркость
без накопления, статичный режим, поздние материалы и восстановление.

```bash
node tests/sky-neon.browser.test.cjs
```

Браузерный тест использует настоящий поиск меню, ползунок, переключатели,
профили и оба действия по маршрутам; проверяет OS reduced motion и reload.
В v21 прошли также phone-ready, sky-visual, ui-refresh, sky и front-fallback:
**6 браузерных сценариев**, подробности в `docs/UPDATE-V21.md`.
Эмуляция телефона не является замером производительности физического устройства.

## v20 — неоновое оформление

Существующие `sky-visual`, `sky-garden` и `ui-refresh.browser` дополнены проверками
палитры, glow-текстуры, подключённой CSS-темы и четырёх световых пятен без записи
в буфер глубины. В этой версии прошли 15 unit-групп и 4 browser-сценария;
полный перечень — `docs/UPDATE-V20.md`.

## v19 — глубокая A, сад и новые кнопки

`npm test --prefix tests`: 15 групп, включая `sky-garden.test.cjs`.
`letter-portal.test.cjs` дополнительно проверяет время внутри настоящей буквы.

```bash
node tests/ui-refresh.browser.test.cjs
```

Новый browser-тест нажимает обновлённые кнопки и проверяет 320/390/844 px,
фонарь, новости с панели и из меню, поиск/категории, SVG, бег/приседание,
скачивание PNG и спуск от первого лица. Полная сводка: `docs/UPDATE-V19.md`.

## v18 — материалы и lifecycle небесной площади

`npm test --prefix tests` включает `sky-visual.test.cjs` (теперь 14 групп).
Дополнительный настоящий browser renderer тест:

```bash
node tests/sky-visual.browser.test.cjs
```

Он проверяет PBR/bump, отдельный слой и свет, тени, руки первого лица,
настройки пользователя, пересоздание renderer через AA, спуск/выход,
восстановление masks/encoding и ограниченный рост ресурсов при повторе.
Сводка шести проверенных browser-сценариев: `docs/SKY-LOOK-V18.md`.

# Актуальная проверка v17 — 20 октября 2026

`npm test --prefix tests`: 13 групп. Добавлены `letter-portal.test.cjs`
(реальная геометрия/отверстие A) и `opening-cast.test.cjs` (штатный суставный
персонаж, хват, детерминированные позы и очистка). Браузерные сценарии запускать
последовательно. Подробности: [OPENING-V17](../docs/OPENING-V17.md).

---

# Актуальная проверка v16 — 20 октября 2026

`npm test --prefix tests`: 11 групп. Новые проверки: `opening-plan.test.cjs`
и `opening-native.browser.test.cjs` (настоящие UUID сцены/молла до и после Play).
Браузерные сценарии запускаются последовательно при работающем `npm start`.
Подробности: [OPENING-V16](../docs/OPENING-V16.md).

---

# Актуальная проверка v15 — 20 октября 2026

`npm test --prefix tests`: 10 групп, включая новый `journey-policy.test.cjs`.
Браузерные проверки запускаются **последовательно**, при работающем `npm start`:

```sh
node tests/phone-ready.browser.test.cjs
node tests/journey.browser.test.cjs
node tests/sky.browser.test.cjs
node tests/front-touch.browser.test.cjs
```

Нужны `playwright-core` и `@sparticuz/chromium` (можно вне репозитория, через
`NODE_PATH`); Chromium также нужны системные NSS/NSPR-библиотеки.
Опционально `CHROMIUM_EXECUTABLE` и `GAME_URL` (по умолчанию http://127.0.0.1:3000).
Это программный WebGL, не замер FPS настоящего устройства.
Подробности текущего покрытия: [MY-CITY-V15](../docs/MY-CITY-V15.md).

---

# Проверки v8.5 «Школа и жильё»

## Автоматический стенд

```sh
npm ci --prefix tests
npm test --prefix tests
```

`home.test.cjs` извлекает реальные функции `buildInterior`, `enterBuilding`,
`changeFloor`, `exitBuilding`, `_exitBuildingNow`, `checkCollision` из `public/index.html`.
Они работают с глобальными **лексическими** переменными, как в браузере;
Three.js — та же версия r128. DOM и Canvas2D заменены jsdom-заглушками,
поэтому это не проверка качества картинки или FPS.

Покрытие:
- школа (3 этажа), особняк (2), жилой дом (3 варианта квартир);
- 46 помещений: геометрия без NaN, корректные материалы;
- поиск пути по сетке с радиусом игрока 0,5: достижимость всех точек действий;
- открытие и закрытие дверей; коллизии и ограничение камеры у перегородок;
- чай, ванна, отдых, стирка, отмена при уходе и смене этажа;
- урок, единственная оценка за ответ, задержка перед повтором;
- сохранение, загрузка повреждённых значений, запрет действий издалека;
- повторные входы/выходы без накопления объектов и интерактов;
- размещение трёх наружных входов на свободной сетке нового города.

## Осмотр в настоящем WebGL

```sh
node tests/preview.cjs
```

Открыть `http://localhost:3001`. Сервер слушает `0.0.0.0`; все браузерные
ресурсы запрашиваются по относительным URL, поэтому работает и Arena preview.
Это отдельная сцена для проверки интерьеров, **не замена основной игры**.

- WASD / стрелки или экранные кнопки — перемещение с настоящими коллизиями.
- Зажать мышь / провести пальцем по сцене — повернуть камеру.
- E / «Действие» — двери и предметы.
- Верхние кнопки — смена здания/этажа без регистрации.

Дополнительный Chromium smoke-тест: `node tests/browser.test.cjs`.
Для него дополнительно нужны `playwright-core` и `@sparticuz/chromium`
(можно установить вне репозитория и передать каталог через `NODE_PATH`),
либо `playwright-core` и установленный Chromium через `CHROMIUM_EXECUTABLE`.
Сервер осмотра должен быть запущен. Скриншоты сохраняются в `tests/reports/`.

## Проведённые проверки (2026-10-15)

- Автоматический стенд — проходит.
- Chromium 133 + SwiftShader: школа, кухня, ванная, спальня, коридор,
  мобильная панель 390×844 — без JS-ошибок в сцене осмотра.
- Основная игра: загрузка настоящего GLB-города, создание трёх входов,
  вход в особняк, переход на второй этаж (y=3,51; ground=3,5), выход — проверено.
  Внешний CDN Three.js в sandbox подменялся локальной копией r128; вводная
  катсцена пропускалась. Авторизация, покупки и сетевой мультиплеер этим
  прогоном не проверялись.
- Старые отдельные стенды метро, боя и общего v8 — повторно запущены.

Переход между этажами — действие у лестницы/лифта, не непрерывная ходьба
по ступеням. Окна и зеркала стилизованы; отражения не ray-traced.


# v8.6: морской район

`npm test --prefix tests` теперь запускает также `sea.test.cjs`.
Он использует настоящие `checkCollision`, `_fzGroundY`, `checkInteractables`
из основной игры и проверяет:

- непрерывные высоты на двух мостах и пандусах;
- связность маршрутов между всеми береговыми точками действий;
- блокировку воды и ограничение перемещения формой корпуса корабля;
- посадку только вблизи причала, полный рейс с перемещением пассажира,
  высадку только на стоянке и точное возвращение в город;
- палубы сухогруза и яхты, проверку грузов без повторного зачёта;
- рыбалку, перерыв, отмену при уходе и сохранение;
- изоляцию от обычного города и интерьеров, повторное использование сцены.

Осмотр:

```sh
SEA_PREVIEW=1 PORT=3002 node tests/preview.cjs
```

Сцена также доступна по `/sea` на новом экземпляре сервера осмотра.
На странице есть выбор моря или интерьеров. Перемещение — WASD/стрелки или
экранные кнопки, поворот — мышью с зажатой кнопкой/пальцем, действие — E.

Необязательные браузерные проверки (с теми же зависимостями Chromium,
что описаны выше):

```sh
node tests/sea.browser.test.cjs       # сервер осмотра :3002
node tests/sea.main.browser.test.cjs  # основная игра :3000
```

Можно передать `REVIEW_URL`, `GAME_URL`, `CHROMIUM_EXECUTABLE`.
Тест основной игры локально подменяет только внешний CDN Three.js
закреплённой версией r128 и пропускает вводную катсцену. Остальные внешние
SDK заблокированы. Проверяются настоящая сцена GLB-города, штатные входы,
посадка через E и школьный интерьер после морского рейса; это не тест
авторизации, оплаты или многопользовательской синхронизации.

Визуальный стиль моря — low-poly с процедурной водой, не симулятор волн
или отражений. Управляемых яхт и плавания пока нет; ходит только паром.

## v8.7 — чистый интерфейс и большой город

`npm test --prefix tests` также запускает `city.test.cjs`: девять пунктов
карты, границы 9520 м, воспроизводимые коллизии и входы, лимиты 25 участков,
200 входов и 80 сохранённых планировок, запреты перехода из транспорта /
интерьеров, освобождение экземпляров при смене сцены.

```sh
NODE_PATH=/home/user/browser-tools/node_modules \
AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x node tests/ui-city.browser.test.cjs
```

Новая браузерная проверка **не обходит регистрацию и PLAY**: чистый профиль,
нажатие стартовой заставки/её пропуска, регистрация через форму, настоящий
загрузчик и GLB, штатная кнопка пропуска вступительного пролёта. Проверяет
фонарь кнопкой и F, поиск в меню, переход в район и WASD, стены, повторную
подгрузку кварталов, вход в дом штатным действием, выход перед дверью,
раскладку 390×844, повторный PLAY и выход на авторизацию. Нет `pageerror`.
Скриншоты записываются вне репозитория в `/home/user/ui-*.png`.
Внешние SDK заблокированы, Three r128 подставляется из локальной зависимости:
это не проверка внешней авторизации, оплаты, физического телефона или FPS
на устройстве пользователя. Программный WebGL в CI заметно медленнее GPU.

Новые районы процедурные, с общей библиотекой существующих интерьеров.
100× означает **отношение площадей границ карты** (9520² / 952²), не сто
уникальных городов или стократный прирост детализации. Области исходного
центра, старых служебных локаций и моря исключены из генерации кварталов.


### v8.7.1 — удалённые потребности и стартовый сюжет

`retired-needs.test.cjs` загружает старое сохранение с нулевыми потребностями,
проверяет 400 секунд обновлений без урона, замедления и предупреждений,
отсутствие панели и навыка выносливости. Проверяет штатные функции сюжета:
нет трекера, прогресса или наград; прежнее сохранение не стирается.
Домашние действия проверяются без изменения потребностей. Браузерный тест
также проверяет отсутствие Гида, трекера и панели после обычного PLAY.


### v8.8 — детализация, экран и бюджет отрисовки

```sh
NODE_PATH=/home/user/browser-tools/node_modules \
AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x node tests/city.visual.browser.test.cjs
```

Изолированная сцена использует настоящий `fz-city-stream.js` и Three r128.
Проверяет четыре типа района, ночную эмиссию окон, повторную загрузку без
роста текстур, лимиты геометрии/участков и число вызовов отрисовки. Изображения
`/home/user/city-*-8.8.png` сохраняются вне Git. Это визуальный smoke, а не
оценка FPS на пользовательском устройстве.

`city.test.cjs` дополнительно проверяет все активные входы и проходы через
садовые калитки, максимум 12 активных прохожих, общий кэш и восстановление
дальности камеры. Основной браузерный тест проверяет сводку и категории меню,
скрытые счётчики и собственный ник, открытие чата по Enter, условную полосу
здоровья и попадание купола неба внутрь дальности камеры.


### v8.9 — public spaces and voluntary leisure

`npm test` now also runs `city-leisure.test.cjs`. It loads the production
layout, streaming and leisure modules with Three r128 and a jsdom DOM.
Coverage: deterministic descriptors, BFS reachability of all entry points,
clear seats, shot/trajectory maths, five scores, misses, local records,
repeat starts, bounded interactions, GPU disposal, interior and scene changes,
and authentication guards. No currency is awarded by this feature.

`ui-city.browser.test.cjs` additionally exercises native E for sitting and
basketball, the nearby-places menu, the direction indicator, keyboard shooting,
390px button shooting, camera/ball cleanup and return to regular play.
`city.visual.browser.test.cjs` loads `fz-city-spaces.js` before the stream module
and saves v8.9 screenshots, including each of the four courtyard types.


### v9 — front scene and real touch regressions

```sh
NODE_PATH=/home/user/browser-tools/node_modules \
AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x node tests/front-touch.browser.test.cjs
NODE_PATH=/home/user/browser-tools/node_modules \
AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x node tests/front-fallback.browser.test.cjs
```

Run the game on port 3000 first (or set `GAME_URL`). The v9 touch suite uses
`hasTouch: true`, `isMobile: true`, and CDP `Input.dispatchTouchEvent` with
independent pointer IDs. It checks simultaneous movement/look, releasing one
finger without losing the other, pinch without joystick interference, cancelled
Space, native E interactions, school quiz completion, a timed household action,
UI taps that do not rotate the camera, landscape scrolling, and GPU/menu lifecycle.
Screenshots live outside Git at `/home/user/*-v9.png`.

The fallback suite disables WebGL contexts before page scripts, requests reduced
motion, and checks that registration/replay/skip remain usable. External requests
are blocked; the application now serves its licensed Three r128 copy from
`public/vendor/`. These tests are not measurements on physical mobile devices.

Run the native WebGL browser suites **sequentially** in this sandbox. Parallel
software-rendered Chromium sessions can starve each other and hit actionability
timeouts; the desktop regression was rerun standalone successfully after such a
concurrent-run timeout.

### v10 — masterplan and arrival

The unit and visual harnesses now load `fz-city-urban.js` before
`fz-city-stream.js`; the leisure suite also runs against the production planner.
`city.test.cjs` checks deterministic landmark plans, pedestrian flood-fill
routes from the street to every doorway in each destination's central tile,
startup loading/cinematic guards, and non-repeating arrival after manual travel.
The shared geometry ceiling is now seven (new hemisphere for greenhouses).
The existing material ceiling remains below 180.

The native UI suite asserts fresh Play lands at (4070, 0, 678), and waits for
streaming and the low city-view camera before saving `city-native-v10.png`.
The visual suite saves seven district views, night and courtyard images under
`/home/user/city-*-v10.png`, and checks GLSL error messages as well as page errors.
The basketball regression compares restored yaw to the actual pre-activity yaw,
not the old fixed startup angle: district travel now frames its landmark.

Final v10 runs: all five unit groups, native UI, real multitouch browser suite,
WebGL city suite and native sea suite passed. Browser tests run sequentially;
external integrations are blocked. No physical-phone FPS guarantee is implied.

### v10.1 — restore classic presentation without reverting gameplay

`classic-ui.browser.test.cjs` asserts the original centred auth/menu layout,
pre-v9 auth palette, restored Play caption, no v9 marketing panel or persistent
3D menu renderer, and v10 district/Touch availability. It covers registration,
portrait/landscape scrolling, intro replay and logout. Screenshots are saved to
`/home/user/classic-{login,menu}-restored.png` (outside Git).

The touch regression now expects the classic 2D menu on return from the game,
not a recreated 3D backdrop. The 3D intro still runs once and can be replayed.
Classic UI, WebGL fallback and full touch regression passed after this change.

### v11 — original world is now the default

Run `original-city.browser.test.cjs` for the current native city acceptance path.
It verifies autoplay even with the v9 seen key, autoplay after reload, native
registration/Play, the original spawn and GRAND MALL footprint, E entrances to
mall/lab, generator/note availability, no imported GLB requests, no streamed
chunks and no delayed relocation. It preserves the rescue gate, then seeds the
completed-escape state to verify cleanup/return (not a full quest playthrough).

`front-touch.browser.test.cjs` now expects autoplay again on reload and uses
`cityWorldReady()`. `sea.main.browser.test.cjs` also uses native world readiness
and tests return to the original scene. Run these sequentially, plus the classic
UI and WebGL-fallback suites. `ui-city.browser.test.cjs` is the historical v10
streamed-district integration scenario, not the default v11 acceptance suite;
its district assumptions no longer apply. Unit `city.test.cjs` and standalone
`city.visual.browser.test.cjs` still exercise the retained, inactive streamed
city assets independently. No previous work or account data is deleted.


# v11.1: дороги исходного города

```sh
npm test --prefix tests
node tests/road-layout.browser.test.cjs       # основная игра :3000
node tests/original-city.browser.test.cjs     # входы после перемещения комплексов
node tests/front-touch.browser.test.cjs      # регрессия телефонного управления
```

Браузерные зависимости/переменные — те же, что выше. `road-layout.test.cjs`
входит в `npm test`. Браузерный тест включает `FZ_LAYOUT_AUDIT` только в стенде:
в обычной игре дорогое измерение всех исходных мешей не запускается.

Новая проверка измеряет геометрию до статического объединения, учитывает
матрицы `InstancedMesh`, проверяет реальные массивы зданий и коллайдеров,
вызывает штатный `checkCollision` на сетке проезжих частей и тротуаров,
проверяет кольцевую дорожку парка, бизнес-входы и непересечение участков.
Плоские покрытия/разметка и небо не считаются препятствиями. Это проверка
исходной статической сцены, не симуляция дорожного движения.

Диагностика сохраняется вне репозитория: `/home/user/road-audit.json`,
`/home/user/road-centre.png`, `/home/user/road-park.png`.
Размеры/модель старого молла остаются прежними, но его положение теперь
(131, -129), лаборатории — (-430, 28); это намеренное освобождение дорог,
а не возврат нового города v10. Предыдущие разделы описывают историю версий.


# v12.0: квартал вместо пустыни, новая площадь и фасад

Те же команды `npm test --prefix tests`, `road-layout.browser.test.cjs`,
`original-city.browser.test.cjs`, `front-touch.browser.test.cjs`.

- Модульный тест сверяет координаты нового спавна в клиенте/сервере,
  конечную длину новых улиц и отсутствие генератора пустыни.
- Браузерный тест проверяет фактический спавн (131,-30), 16 зданий квартала,
  активную версию фасада 12.0, отсутствие действия «Оазис», геометрию и
  коллизии всей дорожной сети, проход от площади к входу в молл.
- Дополнительные WebGL-снимки вне репозитория: `/home/user/road-mall.png`,
  `/home/user/road-arrival.png`, `/home/user/road-quarter.png`.
- Сценарий original-city теперь ожидает новый спавн; название относится к
  сохранённому нативному миру, а не к старому положению игрока или фасаду.


# v13.0: телефонные профили, справочник, фото и восстановление

```bash
npm test --prefix tests                    # теперь 8 групп
node tests/phone-ready.browser.test.cjs    # новый интеграционный сценарий
node tests/front-touch.browser.test.cjs
node tests/original-city.browser.test.cjs
node tests/road-layout.browser.test.cjs
node tests/sea.main.browser.test.cjs
```

Playwright/Chromium и переменные окружения — как выше. Браузерные команды
запускать последовательно: программный WebGL при конкурентной нагрузке
может пропустить короткую фазу заставки. Скриншот плотной лаборатории
имеет отдельный timeout 90 секунд; это ограничение стенда, не замер FPS.

Новые модульные тесты: санитарная обработка настроек, проверка реальной
нативной функции загрузки настроек, предел шага времени, 30-FPS-гистерезис,
пауза измерителя, изоляция от старого автоматического разрешения.

Новый браузерный тест проверяет настоящий renderer, леворукую раскладку
в 320/390/844 px, сохранение, карту/избранное/прогулки, ограничения помощи,
переподключение с прежним UUID и позицией, замену renderer, потерю и
восстановление WebGL, фото/скачивание и manifest. Прогресс прогулки
проверяется с выставлением контрольных позиций тестом, не живым прохождением.
Подробные ограничения — в `docs/PHONE-READINESS.md`.

Диагностика вне репозитория: `/home/user/phone-comfort.png`,
`/home/user/phone-city-guide.png`, `/home/user/{phone,touch,original,road,sea,units}13.log`.
Физические Android/iPhone, батарея и устойчивые 30/60 FPS не проверены.


# v14.0: небесная площадь / сцена / вступление

`npm test --prefix tests` теперь запускает 9 групп. Новая
`sky-access.test.cjs` поднимает временный Socket.IO сервер и проверяет
геометрию/ступени, запрет по поддельному клиентскому флагу, действительный
ключ, отзыв после reconnect и лимит попыток. Секрет генерируется в памяти.

Новый браузерный сценарий:

```bash
node tests/sky.browser.test.cjs
```

Проверяет доступный всем спавн, новости с действия и сохранение кнопки,
полную анимацию спуска, белое осветление, пропуск/повтор, сцену без доступа,
серверную коррекцию, ориентации и блокировку контекстного меню. Вступление
проверяется как титр и постановка с общей геометрией молла/координатами.

Сценарии `phone-ready`, `front-touch`, `original-city`, `road-layout`,
`sea.main` сначала спускаются в город и затем выполняют прежние проверки.
Sea harness программно пропускает вступление: он не моделирует форму входа;
настоящий ввод проверяют front-touch/sky. Прежние seen-флаги не подавляют
автоматическое вступление.

`npm run check --prefix apps` — только конфигурация/синтаксис оболочек,
**не** сборка установщиков. Подробности: `docs/SKY-ARRIVAL.md`.
Диагностика находится вне репозитория: `/home/user/*14.log`,
`sky-credit.png`, `sky-city-opening.png`, `sky-spawn-phone.png`,
`sky-spawn-landscape.png`, `sky-descent-light.png`.
