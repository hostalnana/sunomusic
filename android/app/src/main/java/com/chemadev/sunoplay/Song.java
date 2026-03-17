package com.chemadev.sunoplay;

import android.net.Uri;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;

import org.json.JSONObject;

public class Song {
    public static final String BASE_URL = "https://app.lomastrend.com/sunoplay/";

    public String id;
    public String title;
    public String artist;
    public String genre;
    public String audioUrl;
    public String thumbUrl;
    public String source;

    public static Song fromJson(JSONObject json) {
        Song s = new Song();
        s.id = json.optString("id", String.valueOf(System.currentTimeMillis()));
        s.title = json.optString("title", "Sin titulo");
        s.artist = json.optString("artist", "Artista desconocido");
        s.genre = json.optString("genre", "");
        s.source = json.optString("source", "library");

        // Audio URL: library uses "url", suno/jamendo APIs use "audio"
        String rawUrl = json.optString("url", "");
        if (rawUrl.isEmpty()) rawUrl = json.optString("audio", "");
        if (!rawUrl.isEmpty() && !rawUrl.startsWith("http")) {
            rawUrl = BASE_URL + rawUrl;
        }
        s.audioUrl = rawUrl;

        // Thumbnail URL
        String rawThumb = json.optString("thumb", "");
        if (!rawThumb.isEmpty() && !rawThumb.startsWith("http")) {
            rawThumb = BASE_URL + rawThumb;
        }
        s.thumbUrl = rawThumb;

        return s;
    }

    public MediaDescriptionCompat toMediaDescription() {
        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(artist);

        if (thumbUrl != null && !thumbUrl.isEmpty()) {
            builder.setIconUri(Uri.parse(thumbUrl));
        }

        return builder.build();
    }

    public MediaMetadataCompat toMediaMetadata() {
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, id)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, genre != null && !genre.isEmpty() ? genre : "Suno Play")
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_URI, audioUrl);

        if (thumbUrl != null && !thumbUrl.isEmpty()) {
            builder.putString(MediaMetadataCompat.METADATA_KEY_ART_URI, thumbUrl);
        }

        return builder.build();
    }
}
