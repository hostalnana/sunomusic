package com.chemadev.sunoplay;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import android.provider.OpenableColumns;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaControllerCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "SunoPlay";
    private static final String PWA_URL = "https://app.lomastrend.com/sunoplay/";

    private WebView webView;
    private MediaBrowserCompat mediaBrowser;
    private MediaControllerCompat mediaController;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean webViewReady = false;

    // === JavaScript Bridge ===
    private class AndroidBridge {

        @JavascriptInterface
        public void openGoogleLogin() {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(PWA_URL + "login_native.html"));
            startActivity(intent);
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
            } catch (Exception e) {
                Log.w(TAG, "Cannot open URL: " + url, e);
            }
        }

        @JavascriptInterface
        public void playSong(String songJson) {
            Log.d(TAG, "Bridge.playSong: " + songJson);
            ensureConnected();
            try {
                if (mediaController != null) {
                    Bundle extras = new Bundle();
                    extras.putString("songJson", songJson);
                    mediaController.getTransportControls().playFromMediaId("__BRIDGE_PLAY__", extras);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in playSong bridge", e);
            }
        }

        @JavascriptInterface
        public void pause() {
            ensureConnected();
            if (mediaController != null) {
                mediaController.getTransportControls().pause();
            }
        }

        @JavascriptInterface
        public void resume() {
            ensureConnected();
            if (mediaController != null) {
                mediaController.getTransportControls().play();
            }
        }

        @JavascriptInterface
        public void stop() {
            ensureConnected();
            if (mediaController != null) {
                mediaController.getTransportControls().stop();
            }
        }

        @JavascriptInterface
        public void seekTo(long ms) {
            ensureConnected();
            if (mediaController != null) {
                mediaController.getTransportControls().seekTo(ms);
            }
        }

        @JavascriptInterface
        public void setVolume(float vol) {
            // Send volume via custom action
            if (mediaController != null) {
                Bundle extras = new Bundle();
                extras.putFloat("volume", vol);
                mediaController.getTransportControls().sendCustomAction("SET_VOLUME", extras);
            }
        }

        @JavascriptInterface
        public void setQueue(String queueJson) {
            Log.d(TAG, "Bridge.setQueue");
            if (mediaController != null) {
                Bundle extras = new Bundle();
                extras.putString("queueJson", queueJson);
                mediaController.getTransportControls().sendCustomAction("SET_QUEUE", extras);
            }
        }

        @JavascriptInterface
        public void skipToNext() {
            if (mediaController != null) {
                mediaController.getTransportControls().skipToNext();
            }
        }

        @JavascriptInterface
        public void skipToPrevious() {
            if (mediaController != null) {
                mediaController.getTransportControls().skipToPrevious();
            }
        }

        @JavascriptInterface
        public String getCurrentState() {
            // PWA asks for current playback state (e.g., after F5 reload)
            if (mediaController == null) return null;
            try {
                JSONObject json = new JSONObject();
                PlaybackStateCompat state = mediaController.getPlaybackState();
                MediaMetadataCompat meta = mediaController.getMetadata();
                if (state != null) {
                    int s = state.getState();
                    if (s == PlaybackStateCompat.STATE_PLAYING) json.put("state", "playing");
                    else if (s == PlaybackStateCompat.STATE_PAUSED) json.put("state", "paused");
                    else if (s == PlaybackStateCompat.STATE_BUFFERING) json.put("state", "buffering");
                    else json.put("state", "none");
                    json.put("position", state.getPosition());
                } else {
                    json.put("state", "none");
                }
                if (meta != null) {
                    json.put("title", meta.getString(MediaMetadataCompat.METADATA_KEY_TITLE));
                    json.put("artist", meta.getString(MediaMetadataCompat.METADATA_KEY_ARTIST));
                    json.put("duration", meta.getLong(MediaMetadataCompat.METADATA_KEY_DURATION));
                    json.put("mediaId", meta.getString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID));
                    json.put("artUri", meta.getString(MediaMetadataCompat.METADATA_KEY_ART_URI));
                }
                return json.toString();
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public void setAuthToken(String token) {
            Log.d(TAG, "Bridge.setAuthToken received");
            // Store token for potential use by MusicService API calls
            if (mediaBrowser != null && mediaBrowser.isConnected() && mediaController != null) {
                Bundle extras = new Bundle();
                extras.putString("authToken", token);
                mediaController.getTransportControls().sendCustomAction("SET_AUTH_TOKEN", extras);
            }
        }
    }

    private void ensureConnected() {
        if (mediaController == null && mediaBrowser != null && !mediaBrowser.isConnected()) {
            try { mediaBrowser.connect(); } catch (Exception ignored) {}
        }
    }

    // === Notify WebView of native events ===
    private void notifyWebView(String event, String dataJson) {
        if (webView == null || !webViewReady) return;
        handler.post(() -> {
            String js = "if(typeof nativeBridge!=='undefined'&&nativeBridge.onEvent)nativeBridge.onEvent('" +
                    event + "'," + (dataJson != null ? dataJson : "null") + ")";
            webView.evaluateJavascript(js, null);
        });
    }

    private void sendStateToWebView(PlaybackStateCompat state, MediaMetadataCompat meta) {
        try {
            JSONObject json = new JSONObject();
            if (state != null) {
                int s = state.getState();
                json.put("playing", s == PlaybackStateCompat.STATE_PLAYING);
                json.put("paused", s == PlaybackStateCompat.STATE_PAUSED);
                json.put("buffering", s == PlaybackStateCompat.STATE_BUFFERING);
                json.put("position", state.getPosition());
            }
            if (meta != null) {
                json.put("title", meta.getString(MediaMetadataCompat.METADATA_KEY_TITLE));
                json.put("artist", meta.getString(MediaMetadataCompat.METADATA_KEY_ARTIST));
                json.put("duration", meta.getLong(MediaMetadataCompat.METADATA_KEY_DURATION));
                json.put("mediaId", meta.getString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID));
                json.put("artUri", meta.getString(MediaMetadataCompat.METADATA_KEY_ART_URI));
            }
            notifyWebView("playbackState", json.toString());
        } catch (Exception e) {
            Log.w(TAG, "Error sending state to WebView", e);
        }
    }

    // === MediaController callback ===
    private final MediaControllerCompat.Callback controllerCallback = new MediaControllerCompat.Callback() {
        @Override
        public void onPlaybackStateChanged(PlaybackStateCompat state) {
            sendStateToWebView(state, mediaController != null ? mediaController.getMetadata() : null);

            // Notify specific events
            if (state != null) {
                int s = state.getState();
                if (s == PlaybackStateCompat.STATE_STOPPED || s == PlaybackStateCompat.STATE_NONE) {
                    notifyWebView("stopped", "null");
                } else if (s == PlaybackStateCompat.STATE_ERROR) {
                    notifyWebView("error", "{\"message\":\"Playback error\"}");
                }
            }
        }

        @Override
        public void onMetadataChanged(MediaMetadataCompat metadata) {
            sendStateToWebView(mediaController != null ? mediaController.getPlaybackState() : null, metadata);
        }

        @Override
        public void onSessionEvent(String event, Bundle extras) {
            // Custom events from MusicService
            if ("songComplete".equals(event)) {
                notifyWebView("songComplete", "null");
            } else if ("error".equals(event)) {
                String msg = extras != null ? extras.getString("message", "Error") : "Error";
                notifyWebView("error", "{\"message\":\"" + msg.replace("\"", "'") + "\"}");
            }
        }
    };

    // === Lifecycle ===

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        enableFullscreen();
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);

        // WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);

        // User Agent with app marker
        String ua = settings.getUserAgentString();
        ua = ua.replace("; wv", "").replace(" wv)", ")");
        String versionName = "2.0.0";
        try {
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            versionName = pInfo.versionName;
        } catch (Exception ignored) {}
        settings.setUserAgentString(ua + " SunoPlayApp/" + versionName);

        // Enable cookies for auth
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Add JavaScript bridge
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        // Handle navigation
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webViewReady = true;
                // After page load, push current playback state to PWA
                if (mediaController != null) {
                    handler.postDelayed(() -> {
                        sendStateToWebView(mediaController.getPlaybackState(), mediaController.getMetadata());
                    }, 500);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Magnet links → use server-side downloader (no external client needed)
                if (url.startsWith("magnet:")) {
                    return true; // Block — PWA handles via API
                }
                // Keep PWA URLs inside WebView
                if (url.contains("lomastrend.com") || url.contains("googleapis.com")) {
                    return false;
                }
                // Open external URLs in system browser
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.setBackgroundColor(0xFF06060A);

        // Load PWA
        webView.loadUrl(PWA_URL);

        // Check for app updates
        checkForUpdates();

        // Handle intents (auth callback or share)
        handleIntent(getIntent());

        // Connect to MusicService
        mediaBrowser = new MediaBrowserCompat(this,
                new ComponentName(this, MusicService.class),
                new MediaBrowserCompat.ConnectionCallback() {
                    @Override
                    public void onConnected() {
                        try {
                            // Unregister old callback if reconnecting
                            if (mediaController != null) {
                                try { mediaController.unregisterCallback(controllerCallback); } catch (Exception ignored) {}
                            }
                            MediaSessionCompat.Token token = mediaBrowser.getSessionToken();
                            mediaController = new MediaControllerCompat(MainActivity.this, token);
                            MediaControllerCompat.setMediaController(MainActivity.this, mediaController);
                            mediaController.registerCallback(controllerCallback);
                            Log.d(TAG, "MediaController connected");

                            // Push current state to WebView immediately
                            handler.postDelayed(() -> {
                                if (mediaController != null) {
                                    sendStateToWebView(mediaController.getPlaybackState(), mediaController.getMetadata());
                                }
                            }, 300);
                        } catch (Exception e) {
                            Log.e(TAG, "Error connecting MediaController", e);
                        }
                    }

                    @Override
                    public void onConnectionSuspended() {
                        Log.w(TAG, "MediaBrowser connection suspended");
                        mediaController = null;
                    }

                    @Override
                    public void onConnectionFailed() {
                        Log.e(TAG, "MediaBrowser connection failed");
                        // Retry connection after a delay
                        handler.postDelayed(() -> {
                            if (!mediaBrowser.isConnected()) {
                                try { mediaBrowser.connect(); } catch (Exception ignored) {}
                            }
                        }, 2000);
                    }
                }, null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            handleAuthIntent(intent);
            return;
        }

        if (Intent.ACTION_SEND.equals(action)) {
            handleShareIntent(intent);
        }
    }

    private void handleShareIntent(Intent intent) {
        String type = intent.getType();
        if (type == null) return;

        if (type.startsWith("audio/")) {
            Uri audioUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (audioUri != null) uploadAudioToServer(audioUri);
        } else if ("text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && !sharedText.isEmpty()) handleSharedText(sharedText);
        }
    }

    private void handleSharedText(String text) {
        String url = text.trim();
        if (url.contains("http")) {
            int idx = url.indexOf("http");
            url = url.substring(idx).split("\\s")[0];
        }

        final String finalUrl = url;

        if (finalUrl.matches("(?i)https?://(www\\.)?(youtube\\.com|youtu\\.be|music\\.youtube\\.com|m\\.youtube\\.com)/.*")) {
            webView.postDelayed(() -> {
                String js = "if(typeof downloadFromYouTube==='function'){downloadFromYouTube('" +
                        finalUrl.replace("'", "\\'") + "');}else{window.location.href='" +
                        PWA_URL + "?ytdl=" + Uri.encode(finalUrl) + "';}";
                webView.evaluateJavascript(js, null);
            }, 2000);
        } else {
            webView.postDelayed(() -> {
                webView.loadUrl(PWA_URL + "?playUrl=" + Uri.encode(finalUrl));
            }, 1000);
        }
    }

    private void uploadAudioToServer(Uri audioUri) {
        Log.d(TAG, "Uploading shared audio: " + audioUri);

        String fileName = "shared_audio.mp3";
        try {
            Cursor cursor = getContentResolver().query(audioUri, null, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) fileName = cursor.getString(nameIndex);
                cursor.close();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not get file name", e);
        }

        final String finalFileName = fileName;

        new Thread(() -> {
            try {
                ContentResolver resolver = getContentResolver();
                InputStream is = resolver.openInputStream(audioUri);
                if (is == null) return;

                byte[] bytes = new byte[is.available()];
                int totalRead = 0;
                while (totalRead < bytes.length) {
                    int read = is.read(bytes, totalRead, bytes.length - totalRead);
                    if (read == -1) break;
                    totalRead += read;
                }
                is.close();

                String mimeType = resolver.getType(audioUri);
                if (mimeType == null) mimeType = "audio/mpeg";

                OkHttpClient client = new OkHttpClient.Builder()
                        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                        .writeTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                        .build();

                RequestBody fileBody = RequestBody.create(
                        MediaType.parse(mimeType), bytes, 0, totalRead);

                MultipartBody body = new MultipartBody.Builder()
                        .setType(MultipartBody.FORM)
                        .addFormDataPart("audio", finalFileName, fileBody)
                        .build();

                Request request = new Request.Builder()
                        .url(PWA_URL + "api/upload_song.php")
                        .post(body)
                        .build();

                client.newCall(request).enqueue(new Callback() {
                    @Override
                    public void onResponse(Call call, Response response) throws IOException {
                        try {
                            String responseBody = response.body().string();
                            JSONObject json = new JSONObject(responseBody);
                            if (json.optBoolean("success")) {
                                JSONObject song = json.optJSONObject("song");
                                String songId = song != null ? song.optString("id", "") : "";
                                runOnUiThread(() -> {
                                    if (!songId.isEmpty()) {
                                        webView.loadUrl(PWA_URL + "?play=" + Uri.encode(songId));
                                    } else {
                                        webView.loadUrl(PWA_URL);
                                    }
                                });
                            } else {
                                runOnUiThread(() -> webView.loadUrl(PWA_URL));
                            }
                        } catch (Exception e) {
                            runOnUiThread(() -> webView.loadUrl(PWA_URL));
                        }
                    }

                    @Override
                    public void onFailure(Call call, IOException e) {
                        runOnUiThread(() -> webView.loadUrl(PWA_URL));
                    }
                });

            } catch (Exception e) {
                Log.e(TAG, "Error reading audio file", e);
                runOnUiThread(() -> webView.loadUrl(PWA_URL));
            }
        }).start();
    }

    private void handleAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"sunoplay".equals(data.getScheme()) || !"auth".equals(data.getHost())) return;

        String token = data.getQueryParameter("token");
        String name = data.getQueryParameter("name");
        String email = data.getQueryParameter("email");
        String avatar = data.getQueryParameter("avatar");
        String id = data.getQueryParameter("id");

        if (token == null || token.isEmpty()) return;

        String safeName = (name != null ? name : "").replace("'", "\\'").replace("\\", "\\\\");
        String safeEmail = (email != null ? email : "").replace("'", "\\'");
        String safeAvatar = (avatar != null ? avatar : "").replace("'", "\\'");
        String safeId = (id != null ? id : "").replace("'", "\\'");
        String safeToken = token.replace("'", "\\'");

        String js = "javascript:void((function(){" +
                "var user = {id:'" + safeId + "', name:'" + safeName + "', email:'" + safeEmail + "', avatar:'" + safeAvatar + "'};" +
                "localStorage.setItem('sunoplay-auth-token', '" + safeToken + "');" +
                "localStorage.setItem('sunoplay-user', JSON.stringify(user));" +
                "if(typeof handleNativeAuth === 'function') { handleNativeAuth('" + safeToken + "', user); }" +
                "else { location.reload(); }" +
                "})())";

        webView.postDelayed(() -> {
            webView.evaluateJavascript(js.replace("javascript:", ""), null);
        }, 1000);
    }

    private void checkForUpdates() {
        int currentVersionCode;
        try {
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            currentVersionCode = pInfo.versionCode;
        } catch (Exception e) {
            return;
        }

        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder()
                .url(PWA_URL + "api/app_version.php")
                .header("User-Agent", "SunoPlay/" + currentVersionCode + " Android")
                .build();

        final int myVersion = currentVersionCode;
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                try {
                    String body = response.body().string();
                    JSONObject json = new JSONObject(body);
                    int serverVersion = json.optInt("version_code", 0);
                    String apkUrl = json.optString("apk_url", "");
                    String changelog = json.optString("changelog", "");
                    String versionName = json.optString("version_name", "");
                    boolean forceUpdate = json.optBoolean("force_update", false);

                    if (serverVersion > myVersion) {
                        runOnUiThread(() -> showUpdateDialog(versionName, changelog, apkUrl, forceUpdate));
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Version check failed", e);
                }
            }

            @Override
            public void onFailure(Call call, IOException e) { }
        });
    }

    private void showUpdateDialog(String version, String changelog, String apkUrl, boolean force) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog)
                .setTitle("Nueva version " + version)
                .setMessage(changelog)
                .setPositiveButton("Descargar", (dialog, which) -> {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
                    startActivity(intent);
                });

        if (!force) {
            builder.setNegativeButton("Mas tarde", null);
        } else {
            builder.setCancelable(false);
        }
        builder.show();
    }

    private void enableFullscreen() {
        // Hide status bar but keep navigation bar always visible
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableFullscreen();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (!mediaBrowser.isConnected()) {
            mediaBrowser.connect();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Do NOT disconnect mediaBrowser here — MusicService must keep running
        // when the screen is off. We only disconnect in onDestroy().
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Do NOT call webView.onPause() — it stops all WebView timers and JS execution,
        // which can interfere with the native bridge communication while music plays
        // in background with screen off.
    }

    @Override
    protected void onDestroy() {
        if (mediaController != null) {
            mediaController.unregisterCallback(controllerCallback);
        }
        if (mediaBrowser.isConnected()) {
            mediaBrowser.disconnect();
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
