package com.chemadev.sunoplay;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class ApiClient {
    private static final String TAG = "SunoPlayAPI";
    private static final String API_BASE = "https://app.lomastrend.com/sunoplay/api/";

    private final OkHttpClient client;
    private final Handler handler;

    public interface OnResultListener<T> {
        void onResult(T result);
    }

    public ApiClient() {
        client = new OkHttpClient.Builder()
                .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                .followRedirects(true)
                .addInterceptor(chain -> chain.proceed(
                        chain.request().newBuilder()
                                .header("User-Agent", "SunoPlay/1.0 Android")
                                .build()))
                .build();
        handler = new Handler(Looper.getMainLooper());
    }

    public void fetchLibrary(final OnResultListener<List<Song>> listener) {
        Request request = new Request.Builder()
                .url(API_BASE + "get_library.php")
                .build();

        Log.d(TAG, "Fetching library from: " + API_BASE + "get_library.php");

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                List<Song> songs = new ArrayList<>();
                try {
                    String body = response.body().string();
                    Log.d(TAG, "Library response code=" + response.code() + " length=" + body.length());
                    if (response.code() != 200) {
                        Log.e(TAG, "Library HTTP error: " + response.code() + " body=" + body.substring(0, Math.min(200, body.length())));
                    } else {
                        JSONArray arr = new JSONArray(body);
                        for (int i = 0; i < arr.length(); i++) {
                            Song song = Song.fromJson(arr.getJSONObject(i));
                            if (!song.audioUrl.isEmpty()) {
                                songs.add(song);
                            }
                        }
                        Log.d(TAG, "Library loaded: " + songs.size() + " songs");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing library", e);
                }
                handler.post(() -> listener.onResult(songs));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error fetching library: " + e.getMessage(), e);
                handler.post(() -> listener.onResult(new ArrayList<>()));
            }
        });
    }

    public void fetchSurprise(final OnResultListener<List<Song>> listener) {
        // Fetch from both Suno and Jamendo for variety
        final List<Song> allResults = Collections.synchronizedList(new ArrayList<>());
        final int[] pending = {2};

        fetchFromEndpoint("suno.php?tag=&limit=5", results -> {
            allResults.addAll(results);
            synchronized (pending) {
                pending[0]--;
                if (pending[0] == 0) {
                    Collections.shuffle(allResults);
                    listener.onResult(allResults);
                }
            }
        });

        fetchFromEndpoint("jamendo.php?tag=pop", results -> {
            allResults.addAll(results);
            synchronized (pending) {
                pending[0]--;
                if (pending[0] == 0) {
                    Collections.shuffle(allResults);
                    listener.onResult(allResults);
                }
            }
        });
    }

    public void fetchByGenre(String genre, final OnResultListener<List<Song>> listener) {
        final List<Song> allResults = Collections.synchronizedList(new ArrayList<>());
        final int[] pending = {2};

        fetchFromEndpoint("suno.php?tag=" + genre + "&limit=5", results -> {
            allResults.addAll(results);
            synchronized (pending) {
                pending[0]--;
                if (pending[0] == 0) {
                    listener.onResult(allResults);
                }
            }
        });

        fetchFromEndpoint("jamendo.php?tag=" + genre, results -> {
            allResults.addAll(results);
            synchronized (pending) {
                pending[0]--;
                if (pending[0] == 0) {
                    listener.onResult(allResults);
                }
            }
        });
    }

    private void fetchFromEndpoint(String endpoint, final OnResultListener<List<Song>> listener) {
        Request request = new Request.Builder()
                .url(API_BASE + endpoint)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                List<Song> songs = new ArrayList<>();
                try {
                    String body = response.body().string();
                    JSONArray arr = new JSONArray(body);
                    for (int i = 0; i < arr.length(); i++) {
                        Song song = Song.fromJson(arr.getJSONObject(i));
                        if (!song.audioUrl.isEmpty()) {
                            songs.add(song);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing " + endpoint, e);
                }
                handler.post(() -> listener.onResult(songs));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error fetching " + endpoint, e);
                handler.post(() -> listener.onResult(new ArrayList<>()));
            }
        });
    }
}
