package com.chemadev.sunoplay;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.LruCache;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ArtworkLoader {
    private static final String TAG = "ArtworkLoader";
    private static final int MAX_SIZE = 300;
    private static final int CACHE_SIZE = 20;

    private final LruCache<String, Bitmap> cache;
    private final ExecutorService executor;
    private final Handler handler;

    public interface OnBitmapLoaded {
        void onLoaded(Bitmap bitmap);
    }

    public ArtworkLoader() {
        cache = new LruCache<>(CACHE_SIZE);
        executor = Executors.newFixedThreadPool(2);
        handler = new Handler(Looper.getMainLooper());
    }

    public void load(String url, OnBitmapLoaded callback) {
        if (url == null || url.isEmpty()) {
            callback.onLoaded(null);
            return;
        }

        Bitmap cached = cache.get(url);
        if (cached != null) {
            callback.onLoaded(cached);
            return;
        }

        executor.execute(() -> {
            Bitmap bitmap = downloadBitmap(url);
            if (bitmap != null) {
                cache.put(url, bitmap);
            }
            handler.post(() -> callback.onLoaded(bitmap));
        });
    }

    private Bitmap downloadBitmap(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoInput(true);
            conn.connect();

            if (conn.getResponseCode() != 200) return null;

            InputStream is = conn.getInputStream();

            // Decode with downsampling for memory efficiency
            BitmapFactory.Options opts = new BitmapFactory.Options();
            Bitmap raw = BitmapFactory.decodeStream(is, null, opts);
            is.close();
            conn.disconnect();

            if (raw == null) return null;

            // Scale to max size
            if (raw.getWidth() > MAX_SIZE || raw.getHeight() > MAX_SIZE) {
                float scale = Math.min((float) MAX_SIZE / raw.getWidth(), (float) MAX_SIZE / raw.getHeight());
                Bitmap scaled = Bitmap.createScaledBitmap(raw,
                        (int) (raw.getWidth() * scale),
                        (int) (raw.getHeight() * scale), true);
                if (scaled != raw) raw.recycle();
                return scaled;
            }

            return raw;
        } catch (Exception e) {
            Log.w(TAG, "Failed to load artwork: " + urlStr, e);
            return null;
        }
    }
}
