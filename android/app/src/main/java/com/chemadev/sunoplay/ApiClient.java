package com.chemadev.sunoplay;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ApiClient {
    private static final String TAG = "SunoPlayAPI";
    private static final String API_BASE = "https://app.lomastrend.com/sunoplay/api/";
    private static final MediaType JSON_TYPE = MediaType.parse("application/json; charset=utf-8");

    private final OkHttpClient client;
    private final Handler handler;
    private String authToken;

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
                                .header("User-Agent", "SunoPlayApp/3.0 Android")
                                .build()))
                .build();
        handler = new Handler(Looper.getMainLooper());
    }

    public void setAuthToken(String token) {
        this.authToken = token;
    }

    public String getAuthToken() {
        return authToken;
    }

    private Request.Builder authorizedRequest(String url) {
        Request.Builder builder = new Request.Builder().url(url);
        if (authToken != null && !authToken.isEmpty()) {
            builder.header("Authorization", "Bearer " + authToken);
        }
        return builder;
    }

    // ========================
    // Library
    // ========================
    public void fetchLibrary(final OnResultListener<List<Song>> listener) {
        Request request = authorizedRequest(API_BASE + "get_library.php").build();

        Log.d(TAG, "Fetching library from: " + API_BASE + "get_library.php");

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                List<Song> songs = new ArrayList<>();
                try {
                    String body = response.body().string();
                    Log.d(TAG, "Library response code=" + response.code() + " length=" + body.length());
                    if (response.code() == 200) {
                        JSONArray arr = new JSONArray(body);
                        for (int i = 0; i < arr.length(); i++) {
                            Song song = Song.fromJson(arr.getJSONObject(i));
                            if (!song.audioUrl.isEmpty()) {
                                songs.add(song);
                            }
                        }
                        Log.d(TAG, "Library loaded: " + songs.size() + " songs");
                    } else {
                        Log.e(TAG, "Library HTTP error: " + response.code());
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

    // ========================
    // Surprise (Suno + Jamendo)
    // ========================
    public void fetchSurprise(final OnResultListener<List<Song>> listener) {
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

    // ========================
    // By genre
    // ========================
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

    // ========================
    // Search (Suno + Jamendo)
    // ========================
    public void searchOnline(String query, final OnResultListener<List<Song>> listener) {
        Request request = new Request.Builder()
                .url(API_BASE + "search.php?q=" + query + "&limit=10")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                List<Song> songs = new ArrayList<>();
                try {
                    String body = response.body().string();
                    if (response.code() == 200) {
                        JSONArray arr = new JSONArray(body);
                        for (int i = 0; i < arr.length(); i++) {
                            Song song = Song.fromJson(arr.getJSONObject(i));
                            if (!song.audioUrl.isEmpty()) {
                                songs.add(song);
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing search", e);
                }
                handler.post(() -> listener.onResult(songs));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error searching: " + e.getMessage(), e);
                handler.post(() -> listener.onResult(new ArrayList<>()));
            }
        });
    }

    // ========================
    // Hearts — fetch all for user
    // ========================
    public void fetchHearts(final OnResultListener<Map<String, Integer>> listener) {
        if (authToken == null || authToken.isEmpty()) {
            handler.post(() -> listener.onResult(new HashMap<>()));
            return;
        }

        Request request = authorizedRequest(API_BASE + "get_hearts.php").build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                Map<String, Integer> hearts = new HashMap<>();
                try {
                    String body = response.body().string();
                    if (response.code() == 200) {
                        JSONObject json = new JSONObject(body);
                        Iterator<String> keys = json.keys();
                        while (keys.hasNext()) {
                            String songId = keys.next();
                            hearts.put(songId, json.getInt(songId));
                        }
                        Log.d(TAG, "Hearts loaded: " + hearts.size() + " songs");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing hearts", e);
                }
                handler.post(() -> listener.onResult(hearts));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error fetching hearts: " + e.getMessage(), e);
                handler.post(() -> listener.onResult(new HashMap<>()));
            }
        });
    }

    // ========================
    // Hearts — save for a song
    // ========================
    public void saveHearts(String songId, int hearts, final OnResultListener<Boolean> listener) {
        if (authToken == null || authToken.isEmpty()) {
            handler.post(() -> listener.onResult(false));
            return;
        }

        JSONObject json = new JSONObject();
        try {
            json.put("songId", songId);
            json.put("hearts", hearts);
        } catch (Exception ignored) {}

        Request request = authorizedRequest(API_BASE + "save_hearts.php")
                .post(RequestBody.create(json.toString(), JSON_TYPE))
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                boolean ok = false;
                try {
                    String body = response.body().string();
                    JSONObject result = new JSONObject(body);
                    ok = result.optBoolean("success", false);
                    Log.d(TAG, "Save hearts: " + body);
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing save_hearts", e);
                }
                boolean finalOk = ok;
                handler.post(() -> listener.onResult(finalOk));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error saving hearts: " + e.getMessage(), e);
                handler.post(() -> listener.onResult(false));
            }
        });
    }

    // ========================
    // Surprise from specific source (suno/youtube/torrent/random)
    // ========================
    public void fetchSurpriseFromSource(String source, final OnResultListener<Song> listener) {
        Request request = new Request.Builder()
                .url(API_BASE + "surprise.php?source=" + source)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                Song song = null;
                try {
                    String body = response.body().string();
                    Log.d(TAG, "Surprise response: " + body.substring(0, Math.min(body.length(), 200)));
                    JSONObject json = new JSONObject(body);
                    if (json.optBoolean("success", false)) {
                        JSONObject track = json.optJSONObject("track");
                        if (track != null) {
                            String id = track.optString("id", "surprise-" + System.currentTimeMillis());
                            String title = track.optString("title", "Sorpresa");
                            String artist = track.optString("artist", source);
                            String url = track.optString("url", "");
                            String thumb = track.optString("thumb", "");
                            String genre = json.optString("query", source);

                            if (!url.isEmpty()) {
                                song = new Song();
                                song.id = id;
                                song.title = title;
                                song.artist = artist;
                                song.audioUrl = url;
                                song.thumbUrl = thumb;
                                song.genre = genre;
                                song.hearts = 0;
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error parsing surprise", e);
                }
                Song finalSong = song;
                handler.post(() -> listener.onResult(finalSong));
            }

            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Error fetching surprise: " + e.getMessage(), e);
                handler.post(() -> listener.onResult(null));
            }
        });
    }

    // ========================
    // Internal endpoint fetch
    // ========================
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
