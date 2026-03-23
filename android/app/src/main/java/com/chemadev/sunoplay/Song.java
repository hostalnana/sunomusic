package com.chemadev.sunoplay;

import android.net.Uri;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Song {
    public static final String BASE_URL = "https://app.lomastrend.com/sunoplay/";

    private static final Set<String> SOURCE_TAGS = new HashSet<>(Arrays.asList(
            "YouTube", "Suno AI", "Jamendo", "Torrent", "Subido"));
    private static final Set<String> STYLE_TAGS = new HashSet<>(Arrays.asList(
            "Remix", "Live", "Acoustic", "Instrumental", "Cover", "Feat", "Mix", "Unplugged", "Karaoke"));

    public String id;
    public String title;
    public String artist;
    public String genre;
    public String audioUrl;
    public String thumbUrl;
    public String source;
    public int hearts;
    public List<String> tags;

    public static Song fromJson(JSONObject json) {
        Song s = new Song();
        s.id = json.optString("id", String.valueOf(System.currentTimeMillis()));
        s.title = json.optString("title", "Sin titulo");
        s.artist = json.optString("artist", "Artista desconocido");
        s.genre = json.optString("genre", "");
        s.source = json.optString("source", "library");
        s.hearts = json.optInt("hearts", 3);

        // Parse tags array
        s.tags = new ArrayList<>();
        JSONArray tagsArr = json.optJSONArray("tags");
        if (tagsArr != null) {
            for (int i = 0; i < tagsArr.length(); i++) {
                String tag = tagsArr.optString(i, "");
                if (!tag.isEmpty()) s.tags.add(tag);
            }
        }
        // Generate tags if not present in JSON
        if (s.tags.isEmpty()) {
            s.tags = s.generateTags();
        }

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

    /**
     * Generate tags from song metadata (mirrors generateTagsJS in app_v2.js).
     */
    public List<String> generateTags() {
        Set<String> result = new HashSet<>();

        // Source tag
        if (id != null && id.startsWith("yt-") || "YouTube".equals(genre)) {
            result.add("YouTube");
        } else if (id != null && id.startsWith("torrent-") || "Torrent".equals(genre)) {
            result.add("Torrent");
        } else if (id != null && id.startsWith("upload-")) {
            result.add("Subido");
        } else if (artist != null && artist.toLowerCase().contains("jamendo")) {
            result.add("Jamendo");
        } else {
            result.add("Suno AI");
        }

        // Genre tags
        if (genre != null && !genre.isEmpty() &&
                !"YouTube".equals(genre) && !"Torrent".equals(genre) && !"Otros".equals(genre)) {
            String[] words = genre.toLowerCase().split("[\\s,;/]+");
            for (String w : words) {
                w = w.trim();
                if (w.length() >= 3) {
                    result.add(w.substring(0, 1).toUpperCase() + w.substring(1));
                }
            }
        }

        // Style tags from title keywords
        if (title != null) {
            String lower = title.toLowerCase();
            if (lower.contains("remix")) result.add("Remix");
            if (lower.contains("live")) result.add("Live");
            if (lower.contains("acoustic")) result.add("Acoustic");
            if (lower.contains("instrumental")) result.add("Instrumental");
            if (lower.contains("cover")) result.add("Cover");
            if (lower.contains("feat")) result.add("Feat");
            if (lower.contains("mix")) result.add("Mix");
            if (lower.contains("unplugged")) result.add("Unplugged");
            if (lower.contains("karaoke")) result.add("Karaoke");
        }

        return new ArrayList<>(result);
    }

    /**
     * Get tag type for color coding in Android Auto.
     */
    public static String getTagType(String tag) {
        if (SOURCE_TAGS.contains(tag)) return "source";
        if (STYLE_TAGS.contains(tag)) return "style";
        if (tag.matches("\\d{4}s")) return "decade";
        return "genre";
    }

    /**
     * Determines human-readable origin from the song id prefix or source field.
     */
    public String getOrigin() {
        if (id != null) {
            if (id.startsWith("suno-")) return "Suno AI";
            if (id.startsWith("jamendo-")) return "Jamendo";
            if (id.startsWith("yt-")) return "YouTube";
            if (id.startsWith("torrent-")) return "Torrent";
            if (id.startsWith("upload-")) return "Subido";
        }
        if (source != null) {
            switch (source) {
                case "suno": return "Suno AI";
                case "jamendo": return "Jamendo";
                case "youtube": return "YouTube";
                case "torrent": return "Torrent";
                case "upload": return "Subido";
            }
        }
        return "Biblioteca";
    }

    /**
     * Origin icon emoji for Android Auto browse tree.
     */
    public String getOriginIcon() {
        switch (getOrigin()) {
            case "Suno AI": return "\uD83E\uDD16";
            case "Jamendo": return "\uD83C\uDFB8";
            case "YouTube": return "\uD83D\uDCFA";
            case "Torrent": return "\uD83E\uDDF2";
            case "Subido": return "\uD83D\uDCE4";
            default: return "\uD83C\uDFB5";
        }
    }

    /**
     * Icon for tag type.
     */
    public static String getTagIcon(String tag) {
        switch (tag) {
            case "Suno AI": return "\uD83E\uDD16";
            case "Jamendo": return "\uD83C\uDFB8";
            case "YouTube": return "\uD83D\uDCFA";
            case "Torrent": return "\uD83E\uDDF2";
            case "Subido": return "\uD83D\uDCE4";
            default: return "\uD83C\uDFB5";
        }
    }

    public String getHeartsDisplay() {
        if (hearts > 0) return "\u2665 " + hearts;
        if (hearts < 0) return "\u2661 " + hearts;
        return "\u2661 0";
    }

    public MediaDescriptionCompat toMediaDescription() {
        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(artist + " " + getHeartsDisplay());

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
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, genre != null && !genre.isEmpty() ? genre : "ChemPlay")
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_URI, audioUrl);

        if (thumbUrl != null && !thumbUrl.isEmpty()) {
            builder.putString(MediaMetadataCompat.METADATA_KEY_ART_URI, thumbUrl);
        }

        return builder.build();
    }

    /**
     * Serialize to JSON for bridge communication.
     */
    public JSONObject toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("id", id);
            json.put("title", title);
            json.put("artist", artist);
            json.put("genre", genre);
            json.put("url", audioUrl);
            json.put("thumb", thumbUrl);
            json.put("source", source);
            json.put("hearts", hearts);
            if (tags != null && !tags.isEmpty()) {
                json.put("tags", new JSONArray(tags));
            }
        } catch (Exception ignored) {}
        return json;
    }
}
