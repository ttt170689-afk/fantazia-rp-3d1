package org.fantazia.rp3d;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends ComponentActivity {
    private static final int MIC_PERMISSION = 100;
    static final String DEFAULT_SERVER = "https://fantazia-rp-3d1.onrender.com/";
    static final int CONNECTION_TIMEOUT_MS = 120_000;
    private boolean connecting;
    private String pendingServer = DEFAULT_SERVER;
    private FrameLayout root;
    private EditText address;
    private TextView status;
    private Button connect, cancel;
    private WebView web;
    private LinearLayout toolbar;
    private String server = "";
    private volatile int generation = 0;
    private boolean fullscreen = false;
    private PermissionRequest microphone;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Future<?> task;
    private volatile HttpsURLConnection connection;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(9,11,19));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(9,11,19));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if(fullscreen){leaveFullscreen();return;}
                if(web!=null){confirmLeave();return;}
                finish();
            }
        });
        showConnection(state == null ? "" : state.getString("connectionMessage", ""));
        // Always use the owner's production server on a fresh app launch, not an old preview URL.
        String resume = state == null ? DEFAULT_SERVER : state.getString("resumeServer", "");
        address.setText(state == null ? DEFAULT_SERVER : state.getString("address", DEFAULT_SERVER));
        if (!resume.isEmpty()) connect(resume);
    }
    @Override public void onSaveInstanceState(Bundle state) {
        state.putString("resumeServer", web != null ? server : connecting ? pendingServer : "");
        state.putString("address", address.getText().toString());
        state.putString("connectionMessage", connecting ? "" : status.getText().toString());
        super.onSaveInstanceState(state);
    }
    // Also used by native tests to leave a live connection without depending on server latency.
    void returnToConnection(String message) {
        cancelProbe();
        destroyWeb();
        showConnection(message);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value,int size) {
        TextView v = new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(Color.rgb(229,224,241));v.setPadding(0,dp(8),0,dp(8));return v;
    }
    private Button button(String title) {
        Button b = new Button(this);b.setText(title);b.setAllCaps(false);b.setMinHeight(dp(48));b.setTextColor(Color.WHITE);b.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(94,62,157)));return b;
    }
    private void showConnection(String message) {
        if (isFinishing() || isDestroyed()) return;
        leaveFullscreen();
        connecting = false;
        root.removeAllViews();
        ScrollView scroll = new ScrollView(this);scroll.setFillViewport(true);
        LinearLayout box = new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(24),dp(20),dp(24),dp(24));
        scroll.addView(box);root.addView(scroll,new FrameLayout.LayoutParams(-1,-1));
        ImageView logo = new ImageView(this);logo.setImageResource(R.drawable.fantazia_icon);logo.setContentDescription("Fantazia RP");logo.setScaleType(ImageView.ScaleType.FIT_CENTER);box.addView(logo,new LinearLayout.LayoutParams(-1,dp(130)));
        TextView title = text(BuildConfig.DEBUG ? "Fantazia — тестовый клиент" : "Fantazia RP",28);title.setGravity(Gravity.CENTER);box.addView(title);
        box.addView(text("Онлайн-игра · Android\nАвтоматическое подключение к Fantazia RP.",15));
        box.addView(text("HTTPS-адрес игрового сервера",14));
        address = new EditText(this);address.setTag("server-input");address.setSingleLine(true);address.setTextColor(Color.WHITE);address.setHintTextColor(Color.GRAY);address.setHint(DEFAULT_SERVER);address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setText(getSharedPreferences("connection",MODE_PRIVATE).getString("url",DEFAULT_SERVER));box.addView(address,new LinearLayout.LayoutParams(-1,dp(54)));
        connect=button("Подключиться");connect.setTag("connect-button");box.addView(connect);connect.setOnClickListener(v->connect(address.getText().toString()));
        cancel=button("Отменить");cancel.setTag("cancel-button");cancel.setVisibility(View.GONE);box.addView(cancel);cancel.setOnClickListener(v->{cancelProbe();busy(false);status.setText("Подключение отменено.");});
        status=text(message,14);status.setTag("connection-status");status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);box.addView(status);
        box.addView(text("Нужен работающий сервер Fantazia RP с HTTPS. Адрес GitHub или ZIP не подходит. Установкой APK сервер не создаётся.",13));
        box.addView(text("Тот же аккаунт + тот же сервер = серверные сохранения v41+. При обновлении приложения не удаляй его данные.",13));
        if(BuildConfig.DEBUG) box.addView(text("TEST APK: только проверка клиента. Это не подписанный постоянным ключом публичный выпуск. Тестовое приложение имеет отдельный ID и не заменяет основную игру.",13));
        box.addView(text("Клиент "+BuildConfig.VERSION_NAME+" · содержимое игры загружается с сервера",12));
    }
    private void busy(boolean value) { connecting=value;address.setEnabled(!value);connect.setEnabled(!value);cancel.setVisibility(value?View.VISIBLE:View.GONE); }
    private void cancelProbe() {
        generation++;
        if(task!=null)task.cancel(true);
        HttpsURLConnection old=connection;connection=null;if(old!=null){Thread closer=new Thread(old::disconnect,"Fantazia-cancel");closer.setDaemon(true);closer.start();}
    }
    private void connect(String raw) {
        final String url;
        try { url=UrlPolicy.validate(raw); } catch(IllegalArgumentException error) { status.setText(error.getMessage());return; }
        cancelProbe();final int id=generation;pendingServer=url;address.setText(url);busy(true);status.setText("Подключаемся к Fantazia RP… Если Render запускает сервер после простоя, подожди до 2 минут.");
        root.postDelayed(()->{if(id==generation && !isDestroyed() && connecting){cancelProbe();busy(false);status.setText("Сервер не ответил за 2 минуты. Проверь интернет и нажми «Подключиться» ещё раз.");}},CONNECTION_TIMEOUT_MS);
        task=executor.submit(()->{
            if(id!=generation || Thread.currentThread().isInterrupted())return;
            HttpsURLConnection request=null;
            String failure=null;
            try {
                request=(HttpsURLConnection)new URL(url+"api/health").openConnection();connection=request;
                if(id!=generation || Thread.currentThread().isInterrupted())return;
                request.setConnectTimeout(CONNECTION_TIMEOUT_MS);request.setReadTimeout(CONNECTION_TIMEOUT_MS);request.setInstanceFollowRedirects(false);request.setRequestProperty("Accept","application/json");
                if(request.getResponseCode()!=200)throw new Exception("health");
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                try(InputStream input=request.getInputStream()) { byte[] buffer=new byte[1024];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>16384)throw new Exception("size");bytes.write(buffer,0,n);} }
                JSONObject health=new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
                if(!health.optBoolean("ok") || !"Fantazia RP 3D".equals(health.optString("name")))failure="По этому адресу не найден сервер Fantazia RP 3D.";
            } catch(Exception error) { failure="Не удалось подключиться. Проверь адрес, интернет и HTTPS-сертификат сервера."; }
            finally { if(request!=null)request.disconnect();if(connection==request)connection=null; }
            final String message=failure;
            runOnUiThread(()->{if(id!=generation || isFinishing() || isDestroyed())return;busy(false);if(message!=null){status.setText(message);return;}getSharedPreferences("connection",MODE_PRIVATE).edit().putString("url",url).apply();openGame(url);});
        });
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void openGame(String url) {
        ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(address.getWindowToken(),0);
        server=url;root.removeAllViews();
        LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);root.addView(content,new FrameLayout.LayoutParams(-1,-1));
        toolbar=new LinearLayout(this);toolbar.setOrientation(LinearLayout.HORIZONTAL);
        Button back=button("Сервер"),full=button("Полный экран"),browser=button("Браузер");
        for(Button b:new Button[]{back,full,browser})toolbar.addView(b,new LinearLayout.LayoutParams(0,dp(48),1));
        content.addView(toolbar);
        back.setOnClickListener(v->confirmLeave());full.setOnClickListener(v->enterFullscreen());browser.setOnClickListener(v->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(server)));}catch(Exception e){Toast.makeText(this,"Браузер не найден.",Toast.LENGTH_SHORT).show();}});
        web=new WebView(this);web.setTag("game-webview");content.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        final WebView current=web;
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !UrlPolicy.sameOrigin(request.getUrl().toString(),server);}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();failGame(current,"Ошибка HTTPS-сертификата. Подключение остановлено.");}
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,android.webkit.WebResourceResponse response){if(request.isForMainFrame())failGame(current,"Сервер вернул ошибку HTTP "+response.getStatusCode()+". Попробуй подключиться ещё раз.");}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())failGame(current,"Страница не загрузилась. Проверь интернет и доступность сервера.");}
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){failGame(current,"Окно игры остановилось. Можно подключиться заново.");return true;}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->askMicrophone(current,request));}
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(microphone==request)microphone=null;}
        });
        web.setDownloadListener((download,userAgent,disposition,mime,length)->Toast.makeText(this,"Для сохранения фото открой этот сервер кнопкой «Браузер».",Toast.LENGTH_LONG).show());
        // No addJavascriptInterface, filesystem plugin, TLS bypass or remote bridge.
        web.loadUrl(url);
    }
    private void askMicrophone(WebView source,PermissionRequest request) {
        if(source!=web || microphone!=null || !UrlPolicy.sameOrigin(request.getOrigin().toString(),server) || !UrlPolicy.audioOnly(request.getResources())){request.deny();return;}
        microphone=request;
        new AlertDialog.Builder(this).setTitle("Голосовой чат").setMessage("Разрешить микрофон этому серверу?\n"+Uri.parse(server).getHost()).setNegativeButton("Нет",(d,w)->finishMicrophone(false)).setPositiveButton("Разрешить",(d,w)->{
            if(microphone!=request || web!=source)return;
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)finishMicrophone(true);
            else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC_PERMISSION);
        }).setOnCancelListener(d->finishMicrophone(false)).show();
    }
    private void finishMicrophone(boolean allowed) {PermissionRequest p=microphone;microphone=null;if(p!=null){if(allowed&&web!=null&&UrlPolicy.sameOrigin(p.getOrigin().toString(),server))p.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else p.deny();}}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==MIC_PERMISSION)finishMicrophone(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED);}
    private void failGame(WebView source,String message){if(web!=source)return;root.post(()->{if(web==source){returnToConnection(message);}});}
    private void confirmLeave(){new AlertDialog.Builder(this).setTitle("Вернуться к подключению?").setMessage("Последний прогресс сохраняется на игровом сервере.").setNegativeButton("Остаться",null).setPositiveButton("Выйти",(d,w)->{
        final WebView old=web;if(old==null)return;
        old.evaluateJavascript("try{window.FZSave41?.flush(true)}catch(e){}",null);
        root.postDelayed(()->{if(web==old){returnToConnection("");}},700);
    }).show();}
    private void destroyWeb(){finishMicrophone(false);if(web!=null){WebView old=web;web=null;old.stopLoading();if(old.getParent() instanceof ViewGroup)((ViewGroup)old.getParent()).removeView(old);old.destroy();}CookieManager.getInstance().flush();}
    private void enterFullscreen(){fullscreen=true;toolbar.setVisibility(View.GONE);if(Build.VERSION.SDK_INT>=30){WindowInsetsController c=getWindow().getInsetsController();if(c!=null){c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);c.hide(WindowInsets.Type.systemBars());}}else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
    private void leaveFullscreen(){fullscreen=false;if(toolbar!=null)toolbar.setVisibility(View.VISIBLE);if(Build.VERSION.SDK_INT>=30){WindowInsetsController c=getWindow().getInsetsController();if(c!=null)c.show(WindowInsets.Type.systemBars());}else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);}
    @Override public void onPause(){if(web!=null){web.evaluateJavascript("try{window.FZSave41?.flush(true)}catch(e){}",null);web.onPause();}CookieManager.getInstance().flush();super.onPause();}
    @Override public void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override public void onDestroy(){cancelProbe();destroyWeb();executor.shutdownNow();super.onDestroy();}
}
