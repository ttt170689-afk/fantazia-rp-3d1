package org.fantazia.rp3d;

import android.content.Context;
import android.view.View;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class LauncherTest {
    @Test public void freshLaunchUsesProductionServerNotOldPreview() {
        Context context = ApplicationProvider.getApplicationContext();
        context.getSharedPreferences("connection", Context.MODE_PRIVATE).edit()
            .putString("url", "https://old-preview.example.org/").commit();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View root = activity.getWindow().getDecorView();
                WebView web = root.findViewWithTag("game-webview");
                if (web != null) {
                    assertEquals(MainActivity.DEFAULT_SERVER, web.getUrl());
                } else {
                    EditText input = root.findViewWithTag("server-input");
                    assertEquals(MainActivity.DEFAULT_SERVER, input.getText().toString());
                    TextView status = root.findViewWithTag("connection-status");
                    assertFalse(status.getText().toString().isEmpty());
                }
                assertEquals("https://fantazia-rp-3d1.onrender.com/", MainActivity.DEFAULT_SERVER);
                assertEquals(MainActivity.DEFAULT_SERVER, UrlPolicy.validate(MainActivity.DEFAULT_SERVER));
                assertEquals(120000, MainActivity.CONNECTION_TIMEOUT_MS);
                activity.returnToConnection("");
            });
        }
    }

    @Test public void manualScreenRejectsUnsafeAddressAndSurvivesRecreation() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.returnToConnection("");
                View root = activity.getWindow().getDecorView();
                EditText input = root.findViewWithTag("server-input");
                Button button = root.findViewWithTag("connect-button");
                assertNotNull(input);
                assertTrue(button.isEnabled());
                input.setText("http://127.0.0.1/");
                button.performClick();
                TextView status = root.findViewWithTag("connection-status");
                assertTrue(status.getText().toString().contains("HTTPS"));
                assertNull(root.findViewWithTag("game-webview"));
                assertTrue(button.isEnabled());
            });
            scenario.recreate();
            scenario.onActivity(activity -> {
                View root = activity.getWindow().getDecorView();
                EditText input = root.findViewWithTag("server-input");
                assertNotNull(input);
                assertEquals("http://127.0.0.1/", input.getText().toString());
                assertNull(root.findViewWithTag("game-webview"));
                assertTrue(((Button) root.findViewWithTag("connect-button")).isEnabled());
            });
        }
    }

    @Test public void cancellingProbeDoesNotAutoConnectAfterRotation() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                activity.returnToConnection("");
                View root = activity.getWindow().getDecorView();
                ((EditText) root.findViewWithTag("server-input")).setText(MainActivity.DEFAULT_SERVER);
                ((Button) root.findViewWithTag("connect-button")).performClick();
                assertFalse(((Button) root.findViewWithTag("connect-button")).isEnabled());
                ((Button) root.findViewWithTag("cancel-button")).performClick();
                assertTrue(((Button) root.findViewWithTag("connect-button")).isEnabled());
            });
            scenario.recreate();
            scenario.onActivity(activity -> {
                View root = activity.getWindow().getDecorView();
                assertNull(root.findViewWithTag("game-webview"));
                assertTrue(((Button) root.findViewWithTag("connect-button")).isEnabled());
                assertEquals("Подключение отменено.", ((TextView) root.findViewWithTag("connection-status")).getText().toString());
            });
        }
    }
}
