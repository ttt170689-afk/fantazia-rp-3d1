# Android: небольшой нативный WebView-клиент

Это отдельный Gradle-проект без Capacitor bridge и без Node.js на устройстве.
Вместо зашитого временного адреса показывается нативный экран подключения.
HTTPS `/api/health` должен вернуть `ok: true, name: Fantazia RP 3D`.
URL вводится пользователем, поэтому постоянный Render-адрес не придумывается.

## Сборка

JDK 21 (совместимость исходников Java 17), Gradle 8.13, Android SDK 36 / Build Tools 36.0.0:

```sh
gradle --no-daemon testDebugUnitTest lintDebug assembleDebug
# При работающем эмуляторе/устройстве:
gradle --no-daemon connectedDebugAndroidTest
```

`.github/workflows/android-client.yml` делает это на GitHub Actions, в том числе
проверяет экран подключения на Android API 35. Артефакт `Android-TEST-APK` —
проверочный, с отдельным applicationId `org.fantazia.rp3d.preview`. Production ID
`org.fantazia.rp3d` и стабильная подпись не подменяются debug-сборкой.

## Постоянная подпись релизов

Доступ интеграции к GitHub Secrets не предоставлен. Владелец репозитория может
добавить в **Settings → Secrets and variables → Actions → New repository secret**:

- `FANTAZIA_ANDROID_KEYSTORE_B64` — Base64 собственного keystore;
- `FANTAZIA_ANDROID_STORE_PASSWORD` — пароль keystore;
- `FANTAZIA_ANDROID_KEY_PASSWORD` — пароль ключа;
- `FANTAZIA_ANDROID_KEY_ALIAS` — alias (по умолчанию `fantazia`).

Если уже существует публичный APK, нужен **его исходный ключ**, а не новый.
Для первой публикации можно создать keystore локально утилитой JDK (команда
запросит пароль интерактивно — не вписывать его в команду или чат):

```sh
keytool -genkeypair -keystore /ПРИВАТНАЯ-ПАПКА/fantazia-release.jks -storetype PKCS12 -alias fantazia -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Fantazia RP"
```

Хранить резервную копию в личном защищённом хранилище **вне репозитория**.
Base64 для секрета можно получить локально; это не шифрование и его нельзя
публиковать. Для PKCS12 обычно используется один пароль хранилища и ключа.
Никакие приватные ключи этой задачей не были созданы или опубликованы.

Workflow при наличии всех секретов дополнительно собирает подписанный release
APK. Keystore восстанавливается только во временный файл runner с ограниченными
правами, удаляется в cleanup и не попадает в артефакт/кеш. Без секретов релизная
сборка пропускается; прямой `assembleRelease` явно завершается ошибкой, а не
создаёт якобы готовый непригодный APK. При последующих обновлениях увеличивать
versionCode и сохранять ключ/applicationId.

## Границы защиты и совместимости

Нет JavaScriptInterface, файлового плагина, разрешения камеры, cleartext или
TLS bypass. Главная навигация только на origin выбранного сервера. Audio-only
запрос проходит явное подтверждение и системное разрешение Android. Cookies и
localStorage WebView сохраняются внутри приложения, резервное копирование
данных Android отключено. Переход в браузер возможен только отдельной нативной
кнопкой для подтверждённого серверного URL. Фото/blob-скачивание в оболочке пока
не поддерживается: используется браузерная версия.

Проверки не подтверждают FPS или голосовую связь на физическом телефоне, и не
заменяют проверку реального основного Render-сервера. WebView в эмуляторе не
используется для обещания полной игровой совместимости. Полная инструкция:
`../ANDROID-APK-RU.txt`.
