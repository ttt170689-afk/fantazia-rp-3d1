package org.fantazia.rp3d;

import java.net.URI;
import java.util.Locale;

final class UrlPolicy {
    private UrlPolicy() {}
    static String validate(String raw) {
        if (raw == null || raw.trim().isEmpty() || raw.length() > 2048) throw new IllegalArgumentException("Введи HTTPS-адрес сервера.");
        try {
            URI uri = new URI(raw.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) throw new Exception();
            host = host.toLowerCase(Locale.ROOT);
            if (!host.contains(".") || host.endsWith(".") || host.endsWith(".local") || host.endsWith(".localhost") || host.matches("[0-9.]+") || !host.matches("[a-z0-9.-]+") || uri.getPort() == 0 || uri.getPort() > 65535) throw new Exception();
            String path = uri.getRawPath();
            if (path != null && !path.isEmpty() && !path.equals("/") && !path.equals("/index.html")) throw new Exception();
            return "https://" + host + (uri.getPort() == -1 || uri.getPort() == 443 ? "" : ":" + uri.getPort()) + "/";
        } catch (Exception e) {
            throw new IllegalArgumentException("Нужен HTTPS-домен без пароля, параметров, # и пути. Например: https://ваш-сервер.ru/");
        }
    }
    static boolean sameOrigin(String target, String base) {
        try {
            URI a = new URI(target), b = new URI(base);
            int pa = a.getPort() == -1 ? 443 : a.getPort(), pb = b.getPort() == -1 ? 443 : b.getPort();
            return "https".equalsIgnoreCase(a.getScheme()) && a.getRawUserInfo() == null && a.getHost() != null && a.getHost().equalsIgnoreCase(b.getHost()) && pa == pb;
        } catch (Exception e) { return false; }
    }
    static boolean audioOnly(String[] resources) {
        return resources != null && resources.length == 1 && "android.webkit.resource.AUDIO_CAPTURE".equals(resources[0]);
    }
}
