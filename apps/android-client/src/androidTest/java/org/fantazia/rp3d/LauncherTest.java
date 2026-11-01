package org.fantazia.rp3d;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.view.View;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class LauncherTest {
 @Test public void connectionScreenRejectsUnsafeAddressAndSurvivesRecreation(){
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(activity->{View root=activity.getWindow().getDecorView();EditText input=root.findViewWithTag("server-input");Button button=root.findViewWithTag("connect-button");assertNotNull(input);assertTrue(button.isEnabled());input.setText("http://127.0.0.1/");button.performClick();TextView status=root.findViewWithTag("connection-status");assertTrue(status.getText().toString().contains("HTTPS"));assertNull(root.findViewWithTag("game-webview"));assertTrue(button.isEnabled());});
   scenario.recreate();scenario.onActivity(activity->{assertNotNull(activity.getWindow().getDecorView().findViewWithTag("server-input"));assertNull(activity.getWindow().getDecorView().findViewWithTag("game-webview"));});
  }
 }
}
