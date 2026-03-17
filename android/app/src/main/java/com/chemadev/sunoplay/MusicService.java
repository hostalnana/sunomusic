package com.chemadev.sunoplay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

public class MusicService extends MediaBrowserServiceCompat {
    private static final String TAG = "SunoPlayMusic";
    private static final String CHANNEL_ID = "sunoplay_playback";
    private static final int NOTIFICATION_ID = 1;

    private static final String ROOT_ID = "__ROOT__";
    private static final String BIBLIOTECA_ID = "__BIBLIOTECA__";
    private static final String GENEROS_ID = "__GENEROS__";
    private static final String SORPRESA_ID = "__SORPRESA__";
    private static final String GENRE_PREFIX = "__GENRE__";

    private MediaSessionCompat mediaSession;
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private Handler handler;

    private ApiClient apiClient;
    private ArtworkLoader artworkLoader;

    private List<Song> library = null;
    private boolean isLoadingLibrary = false;
    private Map<String, List<Song>> genreMap = new LinkedHashMap<>();
    private List<Song> currentQueue = new ArrayList<>();
    private int currentIndex = -1;
    private boolean isPrepared = false;
    private Bitmap currentArtwork = null;

    // Pending results for async library loading
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

        createNotificationChannel();
        initMediaSession();
        initMediaPlayer();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Suno Play", NotificationManager.IMPORTANCE_LOW);
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
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new SessionCallback());
        mediaSession.setActive(true);

        updatePlaybackState(PlaybackStateCompat.STATE_NONE);
    }

    private void initMediaPlayer() {
        mediaPlayer = new MediaPlayer();
        mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .build());

        mediaPlayer.setOnPreparedListener(mp -> {
            isPrepared = true;
            mp.start();
            updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
            updateNotification();
        });

        mediaPlayer.setOnCompletionListener(mp -> skipToNext());

        mediaPlayer.setOnErrorListener((mp, what, extra) -> {
            Log.e(TAG, "MediaPlayer error: " + what + "/" + extra);
            isPrepared = false;
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
        Log.d(TAG, "onLoadChildren parentId=" + parentId + " library=" + (library == null ? "null" : library.size()));

        // ROOT_ID can be returned immediately - it's static
        if (ROOT_ID.equals(parentId)) {
            result.sendResult(buildChildren(parentId));
            // Start loading library in background for later
            loadLibraryIfNeeded();
            return;
        }

        // For other IDs, we need the library
        if (library == null) {
            result.detach();
            pendingLoads.add(new PendingLoad(parentId, result));
            loadLibraryIfNeeded();
            return;
        }

        result.sendResult(buildChildren(parentId));
    }

    private void loadLibraryIfNeeded() {
        if (library != null || isLoadingLibrary) return;
        isLoadingLibrary = true;
        Log.d(TAG, "Starting library fetch...");

        apiClient.fetchLibrary(songs -> {
            library = songs;
            isLoadingLibrary = false;
            buildGenreMap();
            Log.d(TAG, "Library loaded: " + songs.size() + " songs, " + genreMap.size() + " genres, " + pendingLoads.size() + " pending");

            // Resolve all pending loads
            List<PendingLoad> pending = new ArrayList<>(pendingLoads);
            pendingLoads.clear();
            for (PendingLoad pl : pending) {
                try {
                    List<MediaBrowserCompat.MediaItem> children = buildChildren(pl.parentId);
                    Log.d(TAG, "Resolving pending " + pl.parentId + " with " + children.size() + " items");
                    pl.result.sendResult(children);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to send pending result for " + pl.parentId, e);
                }
            }
        });
    }

    private void buildGenreMap() {
        genreMap.clear();
        if (library == null) return;
        for (Song song : library) {
            String genre = song.genre;
            if (genre != null && !genre.isEmpty()) {
                genreMap.computeIfAbsent(genre, k -> new ArrayList<>()).add(song);
            }
        }
    }

    private List<MediaBrowserCompat.MediaItem> buildChildren(String parentId) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

        switch (parentId) {
            case ROOT_ID:
                items.add(makeBrowsable(BIBLIOTECA_ID, "Biblioteca", "Tus canciones guardadas"));
                items.add(makeBrowsable(GENEROS_ID, "Generos", "Explora por genero"));
                items.add(makePlayable(SORPRESA_ID, "Sorpresa", "Cancion aleatoria", null));
                break;

            case BIBLIOTECA_ID:
                if (library != null) {
                    for (int i = 0; i < Math.min(library.size(), 100); i++) {
                        Song s = library.get(i);
                        items.add(makePlayable(s.id, s.title, s.artist, s.thumbUrl));
                    }
                }
                break;

            case GENEROS_ID:
                List<String> genres = new ArrayList<>(genreMap.keySet());
                Collections.sort(genres);
                for (String genre : genres) {
                    int count = genreMap.get(genre).size();
                    items.add(makeBrowsable(GENRE_PREFIX + genre, genre, count + " canciones"));
                }
                break;

            default:
                if (parentId.startsWith(GENRE_PREFIX)) {
                    String genre = parentId.substring(GENRE_PREFIX.length());
                    List<Song> genreSongs = genreMap.get(genre);
                    if (genreSongs != null) {
                        for (Song s : genreSongs) {
                            items.add(makePlayable(s.id, s.title, s.artist, s.thumbUrl));
                        }
                    }
                }
                break;
        }

        return items;
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

    // === Playback ===

    private void playSong(Song song) {
        isPrepared = false;
        currentArtwork = null;

        try {
            mediaPlayer.reset();
            mediaPlayer.setDataSource(song.audioUrl);
            mediaPlayer.prepareAsync();

            // Update metadata immediately (without artwork)
            mediaSession.setMetadata(song.toMediaMetadata());
            updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);
            updateNotification();

            // Load artwork async
            artworkLoader.load(song.thumbUrl, bitmap -> {
                currentArtwork = bitmap;
                if (bitmap != null) {
                    MediaMetadataCompat meta = new MediaMetadataCompat.Builder()
                            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, song.id)
                            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, song.title)
                            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, song.artist)
                            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, song.genre != null ? song.genre : "Suno Play")
                            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_URI, song.audioUrl)
                            .build();
                    mediaSession.setMetadata(meta);
                    updateNotification();
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Error playing song: " + song.title, e);
            handler.postDelayed(this::skipToNext, 500);
        }
    }

    private void skipToNext() {
        if (currentQueue.isEmpty()) return;
        currentIndex = (currentIndex + 1) % currentQueue.size();
        playSong(currentQueue.get(currentIndex));
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
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                    .setOnAudioFocusChangeListener(this::onAudioFocusChange)
                    .build();
            audioManager.requestAudioFocus(focusRequest);
        }
    }

    private void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
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

        PlaybackStateCompat psc = new PlaybackStateCompat.Builder()
                .setActions(
                        PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_PLAY_PAUSE |
                        PlaybackStateCompat.ACTION_STOP |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackStateCompat.ACTION_SEEK_TO)
                .setState(state, position, speed)
                .build();

        mediaSession.setPlaybackState(psc);
    }

    private void updateNotification() {
        Song song = (currentIndex >= 0 && currentIndex < currentQueue.size())
                ? currentQueue.get(currentIndex) : null;
        if (song == null) return;

        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE);

        boolean isPlaying = isPrepared && mediaPlayer.isPlaying();

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
                new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(song.title)
                .setContentText(song.artist)
                .setSmallIcon(R.drawable.ic_music_note)
                .setContentIntent(contentIntent)
                .setStyle(mediaStyle)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .addAction(R.drawable.ic_skip_previous, "Anterior",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS))
                .addAction(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                        isPlaying ? "Pausa" : "Play",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY_PAUSE))
                .addAction(R.drawable.ic_skip_next, "Siguiente",
                        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT));

        if (currentArtwork != null) {
            builder.setLargeIcon(currentArtwork);
        }

        Notification notification = builder.build();

        if (isPlaying) {
            startForeground(NOTIFICATION_ID, notification);
        } else {
            stopForeground(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
        }
    }

    // === MediaSession callbacks ===

    private class SessionCallback extends MediaSessionCompat.Callback {
        @Override
        public void onPlay() {
            if (isPrepared && !mediaPlayer.isPlaying()) {
                requestAudioFocus();
                mediaPlayer.start();
                updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
                updateNotification();
            } else if (!isPrepared && !currentQueue.isEmpty()) {
                requestAudioFocus();
                playSong(currentQueue.get(Math.max(0, currentIndex)));
            } else if (currentQueue.isEmpty() && library != null && !library.isEmpty()) {
                // Start playing library from the beginning
                currentQueue = new ArrayList<>(library);
                Collections.shuffle(currentQueue);
                currentIndex = 0;
                requestAudioFocus();
                playSong(currentQueue.get(0));
            }
        }

        @Override
        public void onPause() {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.pause();
            }
            updatePlaybackState(PlaybackStateCompat.STATE_PAUSED);
            updateNotification();
        }

        @Override
        public void onStop() {
            mediaPlayer.stop();
            isPrepared = false;
            updatePlaybackState(PlaybackStateCompat.STATE_STOPPED);
            stopForeground(true);
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
        public void onPlayFromMediaId(String mediaId, Bundle extras) {
            if (SORPRESA_ID.equals(mediaId)) {
                handleSurprise();
                return;
            }

            Song song = findSongById(mediaId);
            if (song != null) {
                // Build queue: all songs from same context, starting from this one
                List<Song> queue;
                if (library != null && library.contains(song)) {
                    queue = new ArrayList<>(library);
                } else {
                    queue = new ArrayList<>();
                    queue.add(song);
                }

                currentQueue = queue;
                currentIndex = queue.indexOf(song);
                if (currentIndex < 0) currentIndex = 0;

                requestAudioFocus();
                playSong(song);
            }
        }
    }

    private void handleSurprise() {
        updatePlaybackState(PlaybackStateCompat.STATE_BUFFERING);

        // If library is loaded, pick random from it
        if (library != null && !library.isEmpty()) {
            currentQueue = new ArrayList<>(library);
            Collections.shuffle(currentQueue);
            currentIndex = 0;
            requestAudioFocus();
            playSong(currentQueue.get(0));
            return;
        }

        // Otherwise fetch from API
        apiClient.fetchSurprise(songs -> {
            if (!songs.isEmpty()) {
                currentQueue = songs;
                currentIndex = 0;
                requestAudioFocus();
                playSong(songs.get(0));
            } else {
                updatePlaybackState(PlaybackStateCompat.STATE_ERROR);
            }
        });
    }

    @Override
    public void onDestroy() {
        mediaSession.setActive(false);
        mediaSession.release();
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (focusRequest != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        }
        super.onDestroy();
    }
}
