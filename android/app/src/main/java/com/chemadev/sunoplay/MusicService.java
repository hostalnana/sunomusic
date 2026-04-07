package com.chemadev.sunoplay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MusicService extends MediaBrowserServiceCompat {
    private static final String TAG = "SunoPlayMusic";
    private static final String CHANNEL_ID = "sunoplay_playback";
    private static final int NOTIFICATION_ID = 1;

    // Browse tree IDs
    private static final String ROOT_ID = "__ROOT__";
    private static final String BIBLIOTECA_ID = "__BIBLIOTECA__";
    private static final String TAGS_ID = "__TAGS__";
    private static final String TOP_RATED_ID = "__TOP_RATED__";
    private static final String SORPRESA_ID = "__SORPRESA__";
    private static final String TAG_PREFIX = "__TAG__";

    // Custom action IDs for Android Auto
    private static final String ACTION_LIKE = "com.chemadev.sunoplay.LIKE";
    private static final String ACTION_DISLIKE = "com.chemadev.sunoplay.DISLIKE";
    private static final String ACTION_SHUFFLE_SKIP = "com.chemadev.sunoplay.SHUFFLE_SKIP";
    private static final String ACTION_SURPRISE = "com.chemadev.sunoplay.SURPRISE";

    private MediaSessionCompat mediaSession;
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private Handler handler;
    private WifiManager.WifiLock wifiLock;

    private ApiClient apiClient;
    private ArtworkLoader artworkLoader;

    private List<Song> library = null;
    private boolean isLoadingLibrary = false;
    private Map<String, List<Song>> tagMap = new LinkedHashMap<>();
    private Map<String, Integer> heartsMap = new HashMap<>();
    private List<Song> topRated = new ArrayList<>();
    private List<Song> currentQueue = new ArrayList<>();
    private int currentIndex = -1;
    private boolean isPrepared = false;
    private Bitmap currentArtwork = null;
    private boolean shuffleEnabled = false;
    private int repeatMode = PlaybackStateCompat.REPEAT_MODE_NONE;
    private boolean wasPlayingBeforeFocusLoss = false;

    // Next song cache for gapless playback
    private MediaPlayer nextMediaPlayer = null;
    private Song nextCachedSong = null;
    private boolean nextPrepared = false;
    private Bitmap nextArtwork = null;

    // Position update runnable
    private final Runnable positionUpdater = new Runnable() {
        @Override
        public void run() {
            if (isPrepared && mediaPlayer != null && mediaPlayer.isPlaying()) {
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                handler.postDelayed(this, 1000);
            }
        }
    };

    // Pending loads for async library
    private final List<PendingLoad> pendingLoads = new ArrayList<>();

    private static class PendingLoad {
        String parentId;
        Result<List<MediaBrowserCompat.MediaItem>> result;
        PendingLoad(String parentId, Result<List<MediaBrowserCompat.MediaItem>> result) {
            this.parentId = parentId;
            this.result = result;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        apiClient = new ApiClient();
        artworkLoader = new ArtworkLoader();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);

        // WiFi lock para mantener red activa durante streaming
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "ChemPlay:WifiLock");

        createNotificationChannel();
        initMediaSession();
        initMediaPlayer();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            // Service recreated by system after being killed — nothing to handle
            return START_STICKY;
        }
        if (intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_LIKE:
                    handleHeartsAction(1);
                    return START_STICKY;
                case ACTION_DISLIKE:
                    handleHeartsAction(-1);
                    return START_STICKY;
                case ACTION_SHUFFLE_SKIP:
                    handleShuffleSkip();
                    return START_STICKY;
                case ACTION_SURPRISE:
                    handleSurprise();
                    return START_STICKY;
            }
        }
        try {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        } catch (Exception e) {
            Log.w(TAG, "Error handling media button intent", e);
        }
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "ChemPlay", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Controles de reproduccion");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "SunoPlay");
        setSessionToken(mediaSession.getSessionToken());
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS |
                        MediaSessionCompat.FLAG_HANDLES_QUEUE_COMMANDS);
        mediaSession.setCallback(new SessionCallback());
        mediaSession.setActive(true);

        updatePlaybackState(PlaybackStateCompat.STATE_NONE);
    }

    private void initMediaPlayer() {
        mediaPlayer = createMediaPlayer();
        setupMainPlayerListeners();
    }

    private MediaPlayer createMediaPlayer() {
        MediaPlayer mp = new MediaPlayer();
        mp.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .build());
        // WakeLock parcial: mantiene CPU activa con pantalla apagada
        mp.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
        return mp;
    }

    private void setupMainPlayerListeners() {
        mediaPlayer.setOnPreparedListener(mp -> {
            isPrepared = true;
            mp.start();
            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
            updateNotification();
            // Start position updates
            handler.removeCallbacks(positionUpdater);
            handler.postDelayed(positionUpdater, 1000);
            // Update metadata with duration
            updateMetadataWithDuration();
            // Preload next song in background
            preloadNextSong();
        });

        mediaPlayer.setOnCompletionListener(mp -> {
            handler.removeCallbacks(positionUpdater);
            // Notify WebView
            mediaSession.sendSessionEvent("songComplete", null);

            // +1 heart for completing a song (same behavior as PWA)
            if (currentIndex >= 0 && currentIndex < currentQueue.size()) {
                handleHeartsAction(1);
            }

            if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ONE) {
                playSong(currentQueue.get(currentIndex));
            } else {
                skipToNextWithCache();
            }
        });

        mediaPlayer.setOnErrorListener((mp, what, extra) -> {
            Log.e(TAG, "MediaPlayer error: " + what + "/" + extra);
            isPrepared = false;
            handler.removeCallbacks(positionUpdater);
            Bundle b = new Bundle();
            b.putString("message", "Error de reproduccion (" + what + ")");
            mediaSession.sendSessionEvent("error", b);
            handler.postDelayed(this::skipToNext, 500);
            return true;
        });
    }

    // === Browse tree ===

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        if (ROOT_ID.equals(parentId)) {
            result.sendResult(buildChildren(parentId));
            loadLibraryIfNeeded();
            return;
        }

        if (library == null) {
            result.detach();
            pendingLoads.add(new PendingLoad(parentId, result));
            loadLibraryIfNeeded();
            return;
        }

        result.sendResult(buildChildren(parentId));
    }

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        if (library == null) {
            result.detach();
            loadLibraryIfNeeded();
            // Simple retry after library loads
            handler.postDelayed(() -> {
                if (library != null) {
                    result.sendResult(searchLibrary(query));
                } else {
                    result.sendResult(new ArrayList<>());
                }
            }, 3000);
            return;
        }
        result.sendResult(searchLibrary(query));
    }

    private List<MediaBrowserCompat.MediaItem> searchLibrary(String query) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
        if (library == null || query == null) return items;

        String q = query.toLowerCase().trim();
        for (Song s : library) {
            if ((s.title != null && s.title.toLowerCase().contains(q)) ||
                    (s.artist != null && s.artist.toLowerCase().contains(q))) {
                items.add(makePlayable(s.id, s.title, s.artist, s.thumbUrl));
                if (items.size() >= 30) break;
            }
        }
        return items;
    }

    private void loadLibraryIfNeeded() {
        if (library != null || isLoadingLibrary) return;
        isLoadingLibrary = true;

        apiClient.fetchLibrary(songs -> {
            library = songs;
            isLoadingLibrary = false;

            // Fetch user hearts and merge into library songs
            apiClient.fetchHearts(hearts -> {
                if (hearts != null && !hearts.isEmpty()) {
                    heartsMap.putAll(hearts);
                    // Apply hearts to library songs
                    for (Song s : library) {
                        if (heartsMap.containsKey(s.id)) {
                            s.hearts = heartsMap.get(s.id);
                        }
                    }
                }
                buildMaps();

                List<PendingLoad> pending = new ArrayList<>(pendingLoads);
                pendingLoads.clear();
                for (PendingLoad pl : pending) {
                    try {
                        pl.result.sendResult(buildChildren(pl.parentId));
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to send pending result for " + pl.parentId, e);
                    }
                }
            });
        });
    }

    private void buildMaps() {
        tagMap.clear();
        topRated.clear();
        if (library == null) return;

        for (Song song : library) {
            // Tag map — each tag points to list of songs
            List<String> songTags = song.tags != null && !song.tags.isEmpty()
                    ? song.tags : song.generateTags();
            for (String tag : songTags) {
                tagMap.computeIfAbsent(tag, k -> new ArrayList<>()).add(song);
            }
        }

        // Top rated: sort by hearts descending, take top 20
        List<Song> sorted = new ArrayList<>(library);
        Collections.sort(sorted, (a, b) -> b.hearts - a.hearts);
        for (int i = 0; i < Math.min(sorted.size(), 20); i++) {
            if (sorted.get(i).hearts > 0) topRated.add(sorted.get(i));
        }
    }

    private List<MediaBrowserCompat.MediaItem> buildChildren(String parentId) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

        switch (parentId) {
            case ROOT_ID:
                items.add(makeBrowsable(BIBLIOTECA_ID, "Biblioteca", "Tus canciones guardadas"));
                items.add(makeBrowsable(TAGS_ID, "Etiquetas", "Filtra por etiquetas"));
                items.add(makeBrowsable(TOP_RATED_ID, "Mas valoradas", "Tus favoritas"));
                items.add(makePlayable(SORPRESA_ID, "Sorpresa", "Cancion aleatoria", null));
                break;

            case BIBLIOTECA_ID:
                if (library != null) {
                    for (int i = 0; i < Math.min(library.size(), 200); i++) {
                        Song s = library.get(i);
                        String subtitle = s.artist;
                        if (s.hearts != 0) subtitle += " | " + heartsString(s.hearts);
                        items.add(makePlayable(s.id, s.title, subtitle, s.thumbUrl));
                    }
                }
                break;

            case TAGS_ID:
                // Sort tags: source first, then genre, style, decade — each by count descending
                List<Map.Entry<String, List<Song>>> tagEntries = new ArrayList<>(tagMap.entrySet());
                Collections.sort(tagEntries, (a, b) -> {
                    int orderA = getTagSortOrder(a.getKey());
                    int orderB = getTagSortOrder(b.getKey());
                    if (orderA != orderB) return orderA - orderB;
                    return b.getValue().size() - a.getValue().size();
                });
                for (Map.Entry<String, List<Song>> entry : tagEntries) {
                    String tag = entry.getKey();
                    int count = entry.getValue().size();
                    String icon = Song.getTagIcon(tag);
                    items.add(makeBrowsable(TAG_PREFIX + tag, icon + " " + tag, count + " canciones"));
                }
                break;

            case TOP_RATED_ID:
                for (Song s : topRated) {
                    String subtitle = s.artist + " | " + heartsString(s.hearts);
                    items.add(makePlayable(s.id, s.title, subtitle, s.thumbUrl));
                }
                break;

            default:
                if (parentId.startsWith(TAG_PREFIX)) {
                    String tag = parentId.substring(TAG_PREFIX.length());
                    List<Song> tagSongs = tagMap.get(tag);
                    if (tagSongs != null) {
                        // Sort by hearts descending
                        List<Song> sorted = new ArrayList<>(tagSongs);
                        Collections.sort(sorted, (a, b) -> b.hearts - a.hearts);
                        for (Song s : sorted) {
                            String subtitle = s.artist + " | " + heartsString(s.hearts);
                            items.add(makePlayable(s.id, s.title, subtitle, s.thumbUrl));
                        }
                    }
                }
                break;
        }

        return items;
    }

    private int getTagSortOrder(String tag) {
        String type = Song.getTagType(tag);
        switch (type) {
            case "source": return 0;
            case "genre": return 1;
            case "style": return 2;
            case "decade": return 3;
            default: return 4;
        }
    }

    private String heartsString(int hearts) {
        if (hearts > 0) return "\u2665 " + hearts;
        if (hearts < 0) return "\u2661 " + hearts;
        return "";
    }

    private MediaBrowserCompat.MediaItem makeBrowsable(String id, String title, String subtitle) {
        MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .build();
        return new MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    private MediaBrowserCompat.MediaItem makePlayable(String id, String title, String subtitle, String iconUrl) {
        MediaDescriptionCompat.Builder b = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle);
        if (iconUrl != null && !iconUrl.isEmpty()) {
            b.setIconUri(Uri.parse(iconUrl));
        }
        return new MediaBrowserCompat.MediaItem(b.build(), MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    private void updateQueue() {
        List<MediaSessionCompat.QueueItem> queueItems = new ArrayList<>();
        for (int i = 0; i < Math.min(currentQueue.size(), 100); i++) {
            Song s = currentQueue.get(i);
            MediaDescriptionCompat desc = new MediaDescriptionCompat.Builder()
                    .setMediaId(s.id)
                    .setTitle(s.title)
                    .setSubtitle(s.artist)
                    .build();
            queueItems.add(new MediaSessionCompat.QueueItem(desc, i));
        }
        mediaSession.setQueue(queueItems);
        mediaSession.setQueueTitle("ChemPlay");
    }

    // === Playback ===

    private void playSong(Song song) {
        if (song == null) return;

        // Always request audio focus and ensure foreground service
        requestAudioFocus();

        // Check if this song is already cached in nextMediaPlayer
        if (nextPrepared && nextCachedSong != null && nextCachedSong.id.equals(song.id)) {
            Log.d(TAG, "Using cached player for: " + song.title);
            useCachedPlayer(song);
            return;
        }

        // Normal path: reset and prepare
        isPrepared = false;
        currentArtwork = null;
        handler.removeCallbacks(positionUpdater);
        releaseNextPlayer();

        try {
            mediaPlayer.reset();
            setupMainPlayerListeners();
            mediaPlayer.setDataSource(song.audioUrl);
            mediaPlayer.prepareAsync();

            // Update metadata immediately (without artwork or duration)
            mediaSession.setMetadata(song.toMediaMetadata());
            updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
            updateNotification();

            // Load artwork async
            loadArtworkForSong(song, true);

        } catch (Exception e) {
            Log.e(TAG, "Error playing song: " + song.title, e);
            Bundle b = new Bundle();
            b.putString("message", "Error: " + e.getMessage());
            mediaSession.sendSessionEvent("error", b);
            handler.postDelayed(this::skipToNext, 500);
        }
    }

    /** Swap in the cached next player as the current player — instant start, no buffering */
    private void useCachedPlayer(Song song) {
        handler.removeCallbacks(positionUpdater);

        // Save references before modifying state
        MediaPlayer cachedPlayer = nextMediaPlayer;
        Bitmap cachedArtwork = nextArtwork;

        // Clear next-cache references (even if we fail, cache is consumed)
        nextMediaPlayer = null;
        nextCachedSong = null;
        nextPrepared = false;
        nextArtwork = null;

        try {
            // Release current player
            try { mediaPlayer.reset(); } catch (Exception ignored) {}
            try { mediaPlayer.release(); } catch (Exception ignored) {}

            // Swap in cached player
            mediaPlayer = cachedPlayer;

            // Set completion/error listeners (skip onPrepared — player is already prepared)
            mediaPlayer.setOnCompletionListener(mp -> {
                handler.removeCallbacks(positionUpdater);
                mediaSession.sendSessionEvent("songComplete", null);
                if (currentIndex >= 0 && currentIndex < currentQueue.size()) {
                    handleHeartsAction(1);
                }
                if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ONE) {
                    playSong(currentQueue.get(currentIndex));
                } else {
                    skipToNextWithCache();
                }
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error (cached): " + what + "/" + extra);
                isPrepared = false;
                handler.removeCallbacks(positionUpdater);
                handler.postDelayed(this::skipToNext, 500);
                return true;
            });

            // Start playback
            mediaPlayer.start();
            isPrepared = true;
            currentArtwork = cachedArtwork;

            // Verify playback actually started
            if (!mediaPlayer.isPlaying()) {
                throw new IllegalStateException("Cached player start() did not produce playback");
            }

            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
            mediaSession.setMetadata(song.toMediaMetadata());
            updateMetadataWithDuration();
            updateNotification();

            handler.removeCallbacks(positionUpdater);
            handler.postDelayed(positionUpdater, 1000);

            // Update artwork if cached
            if (currentArtwork != null) {
                updateMetadataWithArtwork(song, currentArtwork);
            } else {
                loadArtworkForSong(song, true);
            }

            // Preload the NEXT next song
            preloadNextSong();

        } catch (Exception e) {
            Log.w(TAG, "Cached player failed, falling back to normal playback: " + e.getMessage());
            // Release the broken cached player
            try { cachedPlayer.reset(); } catch (Exception ignored) {}
            try { cachedPlayer.release(); } catch (Exception ignored) {}

            // Create a fresh player and use normal playback path
            isPrepared = false;
            currentArtwork = null;
            mediaPlayer = createMediaPlayer();
            setupMainPlayerListeners();

            try {
                mediaPlayer.setDataSource(song.audioUrl);
                mediaPlayer.prepareAsync();
                mediaSession.setMetadata(song.toMediaMetadata());
                updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
                updateNotification();
                loadArtworkForSong(song, true);
            } catch (Exception e2) {
                Log.e(TAG, "Fallback playback also failed: " + song.title, e2);
                handler.postDelayed(this::skipToNext, 500);
            }
        }
    }

    /** Preload the next song in the queue in background */
    private void preloadNextSong() {
        releaseNextPlayer();

        if (currentQueue.isEmpty() || currentIndex < 0) return;

        int nextIdx = currentIndex + 1;
        if (nextIdx >= currentQueue.size()) {
            if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ALL) {
                nextIdx = 0;
            } else {
                return; // No next song
            }
        }

        Song next = currentQueue.get(nextIdx);
        if (next.audioUrl == null || next.audioUrl.isEmpty()) return;

        Log.d(TAG, "Preloading next: " + next.title);
        nextCachedSong = next;

        try {
            nextMediaPlayer = createMediaPlayer();
            nextMediaPlayer.setDataSource(next.audioUrl);

            nextMediaPlayer.setOnPreparedListener(mp -> {
                nextPrepared = true;
                Log.d(TAG, "Next song cached OK: " + next.title);
            });

            nextMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.w(TAG, "Error preloading next song: " + what);
                releaseNextPlayer();
                return true;
            });

            nextMediaPlayer.prepareAsync();

            // Also preload artwork for next song
            artworkLoader.load(next.thumbUrl, bitmap -> {
                if (nextCachedSong != null && nextCachedSong.id.equals(next.id)) {
                    nextArtwork = bitmap;
                }
            });

        } catch (Exception e) {
            Log.w(TAG, "Error setting up preload for: " + next.title, e);
            releaseNextPlayer();
        }
    }

    /** Release and clear the cached next player */
    private void releaseNextPlayer() {
        if (nextMediaPlayer != null) {
            try {
                nextMediaPlayer.reset();
                nextMediaPlayer.release();
            } catch (Exception ignored) {}
            nextMediaPlayer = null;
        }
        nextCachedSong = null;
        nextPrepared = false;
        nextArtwork = null;
    }

    private void loadArtworkForSong(Song song, boolean isCurrentSong) {
        artworkLoader.load(song.thumbUrl, bitmap -> {
            if (isCurrentSong) {
                currentArtwork = bitmap;
                if (bitmap != null) {
                    updateMetadataWithArtwork(song, bitmap);
                    updateNotification();
                }
            }
        });
    }

    /** Build artist string with hearts count visible */
    private String artistWithHearts(Song song) {
        if (song.hearts > 0) return song.artist + " | \u2665 " + song.hearts;
        if (song.hearts < 0) return song.artist + " | \u2661 " + song.hearts;
        return song.artist;
    }

    private void updateMetadataWithArtwork(Song song, Bitmap bitmap) {
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, song.id)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artistWithHearts(song))
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.genre != null ? song.genre : "ChemPlay")
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, song.thumbUrl)
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_URI, song.audioUrl);
        if (isPrepared) {
            metaBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, mediaPlayer.getDuration());
        }
        mediaSession.setMetadata(metaBuilder.build());
    }

    private void updateMetadataWithDuration() {
        if (!isPrepared || currentQueue.isEmpty() || currentIndex < 0) return;
        Song song = currentQueue.get(currentIndex);

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, song.id)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artistWithHearts(song))
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.genre != null ? song.genre : "ChemPlay")
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_URI, song.audioUrl)
                .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, song.thumbUrl != null ? song.thumbUrl : "")
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, mediaPlayer.getDuration());

        if (currentArtwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork);
        }

        mediaSession.setMetadata(metaBuilder.build());
    }

    private void skipToNext() {
        if (currentQueue.isEmpty()) return;
        if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ONE) {
            playSong(currentQueue.get(currentIndex));
        } else {
            int nextIdx = currentIndex + 1;
            if (nextIdx >= currentQueue.size()) {
                if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ALL) {
                    nextIdx = 0;
                } else {
                    updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                    updateNotification();
                    return;
                }
            }
            currentIndex = nextIdx;
            playSong(currentQueue.get(currentIndex));
        }
    }

    /** Skip to next using cache — called on natural song completion */
    private void skipToNextWithCache() {
        if (currentQueue.isEmpty()) return;

        int nextIdx = currentIndex + 1;
        if (nextIdx >= currentQueue.size()) {
            if (repeatMode == PlaybackStateCompat.REPEAT_MODE_ALL) {
                nextIdx = 0;
            } else {
                updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                updateNotification();
                return;
            }
        }
        currentIndex = nextIdx;
        Song nextSong = currentQueue.get(currentIndex);

        // If next song is cached, use it for instant playback
        if (nextPrepared && nextCachedSong != null && nextCachedSong.id.equals(nextSong.id)) {
            Log.d(TAG, "Instant skip using cached player: " + nextSong.title);
            useCachedPlayer(nextSong);
        } else {
            playSong(nextSong);
        }
    }

    private void skipToPrevious() {
        if (currentQueue.isEmpty()) return;
        if (isPrepared && mediaPlayer.getCurrentPosition() > 3000) {
            mediaPlayer.seekTo(0);
            return;
        }
        currentIndex = (currentIndex - 1 + currentQueue.size()) % currentQueue.size();
        playSong(currentQueue.get(currentIndex));
    }

    private Song findSongById(String mediaId) {
        if (library != null) {
            for (Song s : library) {
                if (s.id.equals(mediaId)) return s;
            }
        }
        return null;
    }

    private void requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Reuse the same focus request to avoid creating orphan requests
            if (focusRequest == null) {
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                                .build())
                        .setOnAudioFocusChangeListener(this::onAudioFocusChange)
                        .build();
            }
            audioManager.requestAudioFocus(focusRequest);
        }
        // Mantener WiFi activo para streaming
        if (wifiLock != null && !wifiLock.isHeld()) {
            wifiLock.acquire();
        }
    }

    private void onAudioFocusChange(int focusChange) {
        if (mediaPlayer == null) return;
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                // Perdida permanente (otra app tomó el audio)
                wasPlayingBeforeFocusLoss = false;
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                    updateNotification();
                }
                if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                // Perdida temporal (llamada, notificación) — recordar estado para reanudar
                wasPlayingBeforeFocusLoss = isPrepared && mediaPlayer.isPlaying();
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
                    updateNotification();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                mediaPlayer.setVolume(0.2f, 0.2f);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                mediaPlayer.setVolume(1.0f, 1.0f);
                // Reanudar reproducción si estaba sonando antes de la pérdida transitoria
                if (wasPlayingBeforeFocusLoss && isPrepared && !mediaPlayer.isPlaying()) {
                    mediaPlayer.start();
                    updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                    updateNotification();
                    handler.removeCallbacks(positionUpdater);
                    handler.postDelayed(positionUpdater, 1000);
                }
                wasPlayingBeforeFocusLoss = false;
                // Recuperar WiFi lock si es necesario
                if (wifiLock != null && !wifiLock.isHeld() && isPrepared) {
                    wifiLock.acquire();
                }
                break;
        }
    }

    // === Playback state & notification ===

    private void updatePlaybackState(int state) {
        long position = 0;
        float speed = 0f;
        if (isPrepared) {
            position = mediaPlayer.getCurrentPosition();
            speed = state == PlaybackStateCompat.STATE_PLAYING ? 1.0f : 0f;
        }

        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_STOP
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_SET_SHUFFLE_MODE
                | PlaybackStateCompat.ACTION_SET_REPEAT_MODE
                | PlaybackStateCompat.ACTION_SKIP_TO_QUEUE_ITEM
                | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH;

        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, position, speed);

        // Custom actions for Android Auto: Like, Dislike, Shuffle Skip
        builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_LIKE, "Me gusta", R.drawable.ic_heart).build());
        builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_DISLIKE, "No me gusta", R.drawable.ic_heart_broken).build());
        builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_SHUFFLE_SKIP, "Al azar", R.drawable.ic_shuffle).build());
        builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_SURPRISE, "Sorpresa", R.drawable.ic_surprise).build());

        mediaSession.setPlaybackState(builder.build());
        mediaSession.setShuffleMode(shuffleEnabled
                ? PlaybackStateCompat.SHUFFLE_MODE_ALL
                : PlaybackStateCompat.SHUFFLE_MODE_NONE);
        mediaSession.setRepeatMode(repeatMode);
    }

    private void updateNotification() {
        Song song = (currentIndex >= 0 && currentIndex < currentQueue.size())
                ? currentQueue.get(currentIndex) : null;
        if (song == null) return;

        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE);

        boolean isPlaying = isPrepared && mediaPlayer.isPlaying();

        // Notification: [Like] [Prev] [Play/Pause] [Next] [Dislike]
        // Compact view shows indices 1,2,3 (Prev, Play/Pause, Next)
        androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
                new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(1, 2, 3);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(song.title)
                .setContentText(artistWithHearts(song))
                .setSubText(song.genre)
                .setSmallIcon(R.drawable.ic_music_note)
                .setContentIntent(contentIntent)
                .setStyle(mediaStyle)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .addAction(R.drawable.ic_heart, "Me gusta",
                        buildCustomActionIntent(ACTION_LIKE))           // 0
                .addAction(R.drawable.ic_skip_previous, "Anterior",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS))  // 1
                .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                        isPlaying ? "Pausa" : "Play",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY_PAUSE))  // 2
                .addAction(R.drawable.ic_skip_next, "Siguiente",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT))  // 3
                .addAction(R.drawable.ic_heart_broken, "No me gusta",
                        buildCustomActionIntent(ACTION_DISLIKE));        // 4

        if (currentArtwork != null) {
            builder.setLargeIcon(currentArtwork);
        }

        Notification notification = builder.build();

        // Always keep as foreground service so lock screen controls stay functional.
        // On Android 12+, stopForeground kills the service and notification buttons stop working.
        startForeground(NOTIFICATION_ID, notification);
    }

    private PendingIntent buildCustomActionIntent(String action) {
        Intent intent = new Intent(this, MusicService.class);
        intent.setAction(action);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return PendingIntent.getForegroundService(this, action.hashCode(), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        return PendingIntent.getService(this, action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // === MediaSession callbacks ===

    private class SessionCallback extends MediaSessionCompat.Callback {

        @Override
        public void onPlay() {
            if (isPrepared && !mediaPlayer.isPlaying()) {
                // Simple resume from pause
                requestAudioFocus();
                mediaPlayer.start();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                updateNotification();
                handler.removeCallbacks(positionUpdater);
                handler.postDelayed(positionUpdater, 1000);
            } else if (!isPrepared && !currentQueue.isEmpty() && currentIndex >= 0) {
                // Player lost state (error/stopped) — re-play current song
                requestAudioFocus();
                playSong(currentQueue.get(Math.min(currentIndex, currentQueue.size() - 1)));
            } else if (!isPrepared && currentQueue.isEmpty() && library != null && !library.isEmpty()) {
                // No queue at all — build one from library and start
                currentQueue = new ArrayList<>(library);
                if (shuffleEnabled) Collections.shuffle(currentQueue);
                currentIndex = 0;
                updateQueue();
                requestAudioFocus();
                playSong(currentQueue.get(0));
            }
        }

        @Override
        public void onPause() {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.pause();
            }
            handler.removeCallbacks(positionUpdater);
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
            updateNotification();
        }

        @Override
        public void onStop() {
            mediaPlayer.stop();
            isPrepared = false;
            handler.removeCallbacks(positionUpdater);
            releaseNextPlayer();
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
            // Liberar WiFi lock
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
            // Only remove foreground + notification on explicit stop
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        }

        @Override
        public void onSkipToNext() {
            skipToNext();
        }

        @Override
        public void onSkipToPrevious() {
            skipToPrevious();
        }

        @Override
        public void onSeekTo(long pos) {
            if (isPrepared) {
                mediaPlayer.seekTo((int) pos);
                updatePlaybackState(
                        mediaPlayer.isPlaying() ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
            }
        }

        @Override
        public void onSetShuffleMode(int shuffleMode) {
            shuffleEnabled = (shuffleMode == PlaybackStateCompat.SHUFFLE_MODE_ALL
                    || shuffleMode == PlaybackStateCompat.SHUFFLE_MODE_GROUP);
            if (shuffleEnabled && !currentQueue.isEmpty()) {
                Song current = (currentIndex >= 0 && currentIndex < currentQueue.size())
                        ? currentQueue.get(currentIndex) : null;
                Collections.shuffle(currentQueue);
                if (current != null) {
                    currentIndex = currentQueue.indexOf(current);
                    if (currentIndex < 0) currentIndex = 0;
                }
            }
            // Queue order changed — invalidate cache and preload correct next song
            releaseNextPlayer();
            if (isPrepared) preloadNextSong();
            updatePlaybackState(isPrepared && mediaPlayer.isPlaying()
                    ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
        }

        @Override
        public void onSetRepeatMode(int mode) {
            repeatMode = mode;
            updatePlaybackState(isPrepared && mediaPlayer.isPlaying()
                    ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED);
        }

        @Override
        public void onPlayFromMediaId(String mediaId, Bundle extras) {
            // Bridge play from WebView
            if ("__BRIDGE_PLAY__".equals(mediaId) && extras != null) {
                String songJson = extras.getString("songJson", "");
                handleBridgePlay(songJson);
                return;
            }

            if (SORPRESA_ID.equals(mediaId)) {
                handleSurprise();
                return;
            }

            Song song = findSongById(mediaId);
            if (song != null) {
                List<Song> queue;
                if (library != null && library.contains(song)) {
                    queue = new ArrayList<>(library);
                } else {
                    queue = new ArrayList<>();
                    queue.add(song);
                }
                if (shuffleEnabled) {
                    Song target = song;
                    Collections.shuffle(queue);
                    // Move target to front
                    queue.remove(target);
                    queue.add(0, target);
                }
                currentQueue = queue;
                currentIndex = currentQueue.indexOf(song);
                if (currentIndex < 0) currentIndex = 0;

                updateQueue();
                requestAudioFocus();
                playSong(song);
            }
        }

        @Override
        public void onPlayFromSearch(String query, Bundle extras) {
            handleVoiceSearch(query, extras);
        }

        @Override
        public void onCustomAction(String action, Bundle extras) {
            switch (action) {
                case ACTION_LIKE:
                    handleHeartsAction(1);
                    break;
                case ACTION_DISLIKE:
                    handleHeartsAction(-1);
                    break;
                case ACTION_SHUFFLE_SKIP:
                    handleShuffleSkip();
                    break;
                case ACTION_SURPRISE:
                    handleSurprise();
                    break;
                case "SET_VOLUME":
                    if (extras != null) {
                        float vol = extras.getFloat("volume", 1.0f);
                        if (mediaPlayer != null) mediaPlayer.setVolume(vol, vol);
                    }
                    break;
                case "SET_QUEUE":
                    if (extras != null) {
                        String queueJson = extras.getString("queueJson", "[]");
                        handleSetQueue(queueJson);
                    }
                    break;
                case "SET_AUTH_TOKEN":
                    if (extras != null) {
                        String token = extras.getString("authToken", "");
                        if (!token.isEmpty() && apiClient != null) {
                            apiClient.setAuthToken(token);
                            Log.d(TAG, "Auth token set from bridge");
                        }
                    }
                    break;
            }
        }

        @Override
        public void onSkipToQueueItem(long id) {
            int index = (int) id;
            if (index >= 0 && index < currentQueue.size()) {
                currentIndex = index;
                requestAudioFocus();
                playSong(currentQueue.get(currentIndex));
            }
        }
    }

    private void handleBridgePlay(String songJson) {
        try {
            JSONObject json = new JSONObject(songJson);
            Song song = Song.fromJson(json);
            if (song.audioUrl.isEmpty()) return;

            // Build queue: if song is in library, use library as queue
            List<Song> queue;
            Song libSong = findSongById(song.id);
            if (libSong != null && library != null) {
                queue = new ArrayList<>(library);
                song = libSong; // Use library version with full metadata
            } else {
                queue = new ArrayList<>();
                queue.add(song);
                // Also add library songs after
                if (library != null) {
                    for (Song s : library) {
                        if (!s.id.equals(song.id)) queue.add(s);
                    }
                }
            }

            currentQueue = queue;
            currentIndex = currentQueue.indexOf(song);
            if (currentIndex < 0) currentIndex = 0;

            updateQueue();
            requestAudioFocus();
            playSong(song);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing bridge play JSON", e);
        }
    }

    private void handleSetQueue(String queueJson) {
        try {
            JSONArray arr = new JSONArray(queueJson);
            List<Song> queue = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                Song s = Song.fromJson(arr.getJSONObject(i));
                if (!s.audioUrl.isEmpty()) queue.add(s);
            }
            if (!queue.isEmpty()) {
                // Keep current song if playing
                Song currentSong = (currentIndex >= 0 && currentIndex < currentQueue.size())
                        ? currentQueue.get(currentIndex) : null;

                currentQueue = queue;
                if (currentSong != null) {
                    currentIndex = currentQueue.indexOf(currentSong);
                    if (currentIndex < 0) currentIndex = 0;
                }
                updateQueue();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing queue JSON", e);
        }
    }

    private void handleSurprise() {
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);

        // Pick random source: suno (fast), youtube, torrent
        String[] sources = {"suno", "suno", "youtube", "suno"};
        String source = sources[new java.util.Random().nextInt(sources.length)];
        Log.d(TAG, "Surprise from: " + source);

        apiClient.fetchSurpriseFromSource(source, song -> {
            if (song != null && song.audioUrl != null && !song.audioUrl.isEmpty()) {
                Log.d(TAG, "Surprise got: " + song.title + " from " + source);
                // Add to front of queue
                currentQueue.add(0, song);
                currentIndex = 0;
                updateQueue();
                requestAudioFocus();
                playSong(song);
            } else {
                // Fallback: shuffle library
                Log.d(TAG, "Surprise API failed, shuffling library");
                if (library != null && !library.isEmpty()) {
                    currentQueue = new ArrayList<>(library);
                    Collections.shuffle(currentQueue);
                    currentIndex = 0;
                    updateQueue();
                    requestAudioFocus();
                    playSong(currentQueue.get(0));
                } else {
                    updatePlaybackState(PlaybackStateCompat.STATE_ERROR);
                }
            }
        });
    }

    // === Hearts (Like/Dislike) ===

    private void handleHeartsAction(int delta) {
        if (currentIndex < 0 || currentIndex >= currentQueue.size()) return;
        Song song = currentQueue.get(currentIndex);

        song.hearts += delta;
        heartsMap.put(song.id, song.hearts);
        Log.d(TAG, "Hearts " + (delta > 0 ? "+" : "") + delta + " for " + song.title + " → " + song.hearts);

        // Persist to server
        apiClient.saveHearts(song.id, song.hearts, success -> {
            if (success) {
                Log.d(TAG, "Hearts saved OK for " + song.id);
            } else {
                Log.w(TAG, "Hearts save FAILED for " + song.id);
            }
        });

        // Notify WebView so phone UI updates hearts display
        Bundle heartsBundle = new Bundle();
        heartsBundle.putString("songId", song.id);
        heartsBundle.putInt("hearts", song.hearts);
        heartsBundle.putInt("delta", delta);
        mediaSession.sendSessionEvent("heartsUpdate", heartsBundle);

        // Si dislike y hearts <= -1 → borrar canción de la cola y saltar
        if (delta < 0 && song.hearts <= -1) {
            Log.d(TAG, "Removing disliked song from queue: " + song.title);
            releaseNextPlayer();
            currentQueue.remove(currentIndex);
            // También eliminar de la biblioteca en memoria
            if (library != null) library.remove(song);

            if (currentQueue.isEmpty()) {
                isPrepared = false;
                mediaPlayer.stop();
                updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
                stopForeground(true);
                return;
            }
            // Ajustar índice si nos pasamos del final
            if (currentIndex >= currentQueue.size()) currentIndex = 0;
            updateQueue();
            playSong(currentQueue.get(currentIndex));
            return;
        }

        // Update metadata to reflect new hearts
        updateMetadataWithDuration();
        updateNotification();
    }

    // === Shuffle Skip (saltar a canción aleatoria) ===

    private void handleShuffleSkip() {
        if (currentQueue.size() <= 1) return;
        releaseNextPlayer();

        // Elegir índice aleatorio diferente al actual
        int randomIdx;
        java.util.Random rnd = new java.util.Random();
        do {
            randomIdx = rnd.nextInt(currentQueue.size());
        } while (randomIdx == currentIndex && currentQueue.size() > 1);

        currentIndex = randomIdx;
        Log.d(TAG, "Shuffle skip to: " + currentQueue.get(currentIndex).title);
        requestAudioFocus();
        playSong(currentQueue.get(currentIndex));
    }

    // === Voice Search ===

    private void handleVoiceSearch(String query, Bundle extras) {
        Log.d(TAG, "Voice search: \"" + query + "\"");

        // Empty query → shuffle library
        if (query == null || query.trim().isEmpty()) {
            handleSurprise();
            return;
        }

        // Wait for library if not loaded
        if (library == null) {
            loadLibraryIfNeeded();
            String finalQuery = query;
            handler.postDelayed(() -> handleVoiceSearch(finalQuery, extras), 2000);
            return;
        }

        String q = query.toLowerCase().trim();
        List<Song> results = new ArrayList<>();

        // 1. Search by title/artist match
        for (Song s : library) {
            if ((s.title != null && s.title.toLowerCase().contains(q)) ||
                    (s.artist != null && s.artist.toLowerCase().contains(q))) {
                results.add(s);
            }
        }

        // 2. If no results, try matching tags
        if (results.isEmpty()) {
            for (Map.Entry<String, List<Song>> entry : tagMap.entrySet()) {
                if (entry.getKey().toLowerCase().contains(q)) {
                    results.addAll(entry.getValue());
                }
            }
        }

        // 3. If still no results, try genre field
        if (results.isEmpty()) {
            for (Song s : library) {
                if (s.genre != null && s.genre.toLowerCase().contains(q)) {
                    results.add(s);
                }
            }
        }

        if (results.isEmpty()) {
            // Nothing found — play surprise
            Log.d(TAG, "Voice search no results, playing surprise");
            handleSurprise();
            return;
        }

        // Remove duplicates
        List<Song> unique = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (Song s : results) {
            if (seen.add(s.id)) unique.add(s);
        }

        currentQueue = unique;
        if (shuffleEnabled) Collections.shuffle(currentQueue);
        currentIndex = 0;
        updateQueue();
        requestAudioFocus();
        playSong(currentQueue.get(0));
        Log.d(TAG, "Voice search playing " + unique.size() + " results for \"" + query + "\"");
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(positionUpdater);
        mediaSession.setActive(false);
        mediaSession.release();
        releaseNextPlayer();
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (focusRequest != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            wifiLock.release();
        }
        super.onDestroy();
    }
}
