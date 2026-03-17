package com.chemadev.sunoplay;

import android.content.ComponentName;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaControllerCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.BaseAdapter;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private MediaBrowserCompat mediaBrowser;
    private MediaControllerCompat mediaController;
    private ArtworkLoader artworkLoader;

    private ImageView artworkView;
    private TextView titleView, artistView;
    private ImageButton btnPlayPause, btnPrev, btnNext;
    private ListView songListView;

    private List<MediaBrowserCompat.MediaItem> songItems = new ArrayList<>();
    private SongAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen immersive
        enableFullscreen();

        setContentView(R.layout.activity_main);

        artworkLoader = new ArtworkLoader();

        artworkView = findViewById(R.id.artwork);
        titleView = findViewById(R.id.title);
        artistView = findViewById(R.id.artist);
        btnPlayPause = findViewById(R.id.btn_play_pause);
        btnPrev = findViewById(R.id.btn_prev);
        btnNext = findViewById(R.id.btn_next);
        songListView = findViewById(R.id.song_list);

        adapter = new SongAdapter();
        songListView.setAdapter(adapter);

        // Enable marquee on title
        titleView.setSelected(true);

        btnPlayPause.setOnClickListener(v -> {
            if (mediaController == null) return;
            int state = mediaController.getPlaybackState() != null
                    ? mediaController.getPlaybackState().getState() : PlaybackStateCompat.STATE_NONE;
            if (state == PlaybackStateCompat.STATE_PLAYING) {
                mediaController.getTransportControls().pause();
            } else {
                mediaController.getTransportControls().play();
            }
        });

        btnPrev.setOnClickListener(v -> {
            if (mediaController != null) mediaController.getTransportControls().skipToPrevious();
        });

        btnNext.setOnClickListener(v -> {
            if (mediaController != null) mediaController.getTransportControls().skipToNext();
        });

        songListView.setOnItemClickListener((parent, view, position, id) -> {
            if (mediaController != null && position < songItems.size()) {
                String mediaId = songItems.get(position).getMediaId();
                if (mediaId != null) {
                    mediaController.getTransportControls().playFromMediaId(mediaId, null);
                }
            }
        });

        mediaBrowser = new MediaBrowserCompat(this,
                new ComponentName(this, MusicService.class),
                connectionCallback, null);
    }

    private void enableFullscreen() {
        // Extend content behind system bars
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        // Hide system bars with immersive sticky mode
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullscreen();
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        mediaBrowser.connect();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (mediaBrowser.isConnected()) {
            mediaBrowser.disconnect();
        }
    }

    private final MediaBrowserCompat.ConnectionCallback connectionCallback =
            new MediaBrowserCompat.ConnectionCallback() {
                @Override
                public void onConnected() {
                    try {
                        MediaSessionCompat.Token token = mediaBrowser.getSessionToken();
                        mediaController = new MediaControllerCompat(MainActivity.this, token);
                        MediaControllerCompat.setMediaController(MainActivity.this, mediaController);
                        mediaController.registerCallback(controllerCallback);

                        updateUI(mediaController.getMetadata());
                        updatePlayPause(mediaController.getPlaybackState());

                        mediaBrowser.subscribe("__BIBLIOTECA__", subscriptionCallback);
                    } catch (Exception e) {
                        // Ignore
                    }
                }
            };

    private final MediaBrowserCompat.SubscriptionCallback subscriptionCallback =
            new MediaBrowserCompat.SubscriptionCallback() {
                @Override
                public void onChildrenLoaded(@NonNull String parentId, @NonNull List<MediaBrowserCompat.MediaItem> children) {
                    songItems.clear();
                    songItems.addAll(children);
                    adapter.notifyDataSetChanged();
                }
            };

    private final MediaControllerCompat.Callback controllerCallback =
            new MediaControllerCompat.Callback() {
                @Override
                public void onMetadataChanged(MediaMetadataCompat metadata) {
                    updateUI(metadata);
                }

                @Override
                public void onPlaybackStateChanged(PlaybackStateCompat state) {
                    updatePlayPause(state);
                }
            };

    private void updateUI(MediaMetadataCompat metadata) {
        if (metadata == null) return;
        titleView.setText(metadata.getString(MediaMetadataCompat.METADATA_KEY_TITLE));
        artistView.setText(metadata.getString(MediaMetadataCompat.METADATA_KEY_ARTIST));

        Bitmap art = metadata.getBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART);
        if (art != null) {
            artworkView.setImageBitmap(art);
        } else {
            String artUri = metadata.getString(MediaMetadataCompat.METADATA_KEY_ART_URI);
            if (artUri != null && !artUri.isEmpty()) {
                artworkLoader.load(artUri, bitmap -> {
                    if (bitmap != null) artworkView.setImageBitmap(bitmap);
                    else artworkView.setImageResource(R.drawable.ic_music_note);
                });
            } else {
                artworkView.setImageResource(R.drawable.ic_music_note);
            }
        }
    }

    private void updatePlayPause(PlaybackStateCompat state) {
        if (state == null) return;
        boolean isPlaying = state.getState() == PlaybackStateCompat.STATE_PLAYING;
        btnPlayPause.setImageResource(isPlaying ? R.drawable.ic_pause : R.drawable.ic_play);
    }

    private class SongAdapter extends BaseAdapter {
        @Override
        public int getCount() { return songItems.size(); }

        @Override
        public Object getItem(int position) { return songItems.get(position); }

        @Override
        public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            if (convertView == null) {
                convertView = LayoutInflater.from(MainActivity.this)
                        .inflate(R.layout.item_song, parent, false);
            }

            MediaBrowserCompat.MediaItem item = songItems.get(position);
            TextView title = convertView.findViewById(R.id.item_title);
            TextView artist = convertView.findViewById(R.id.item_artist);

            title.setText(item.getDescription().getTitle());
            artist.setText(item.getDescription().getSubtitle());

            return convertView;
        }
    }
}
