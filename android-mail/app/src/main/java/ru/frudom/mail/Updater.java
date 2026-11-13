package ru.frudom.mail;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;

/** Новая версия «Почты ФД»: экраны теперь настоящие, поэтому изменения приходят новой версией приложения.
 *  Раз в 6 часов приложение смотрит frudom-mail.json рядом с сайтом; есть новее — плашка «Есть новая версия»,
 *  нажатие скачивает frudom-mail.apk и открывает установку (поверх старой, вход и настройки сохраняются). */
final class Updater {
    private Updater() {}
    static final String BASE = "https://dskoby-maker.github.io/frudom-docs/";

    static final class Info { long code; String name, url; }
    interface Cb { void on(Info i); }

    static long mine(Context c) {
        try { android.content.pm.PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0); return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode; }
        catch (Exception e) { return Long.MAX_VALUE; }
    }

    static Info parse(String s) {
        try { JSONObject j = new JSONObject(s); Info i = new Info(); i.code = j.optLong("code"); i.name = j.optString("name", "новая"); i.url = j.optString("url", BASE + "frudom-mail.apk"); return i; }
        catch (Exception e) { return null; }
    }

    static void check(Activity a, Cb cb) {
        SharedPreferences s = MailNotifier.prefs(a);
        Info last = parse(s.getString("updInfo", ""));
        cb.on(last != null && last.code > mine(a) ? last : null);
        if (System.currentTimeMillis() - s.getLong("updAt", 0) < 6 * 3600_000L) return;
        s.edit().putLong("updAt", System.currentTimeMillis()).apply();
        MainActivity.IO.execute(() -> {
            try {
                String t = MailNotifier.get(BASE + "frudom-mail.json?t=" + System.currentTimeMillis());
                Info i = parse(t); if (i == null) return;
                s.edit().putString("updInfo", t).apply();
                a.runOnUiThread(() -> cb.on(i.code > mine(a) ? i : null));
            } catch (Exception ignored) {}
        });
    }

    static void install(Activity a, Info inf) {
        if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(a, "Разрешите «Почте ФД» устанавливать приложения и нажмите плашку ещё раз", Toast.LENGTH_LONG).show();
            try { a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()))); } catch (Exception e) { browser(a, inf); }
            return;
        }
        try {
            File dir = a.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS); if (dir == null) { browser(a, inf); return; }
            File f = new File(dir, "frudom-mail-" + inf.code + ".apk"); if (f.exists()) f.delete();
            DownloadManager dm = (DownloadManager) a.getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(inf.url)).setTitle("Почта ФД " + inf.name)
                .setDestinationUri(Uri.fromFile(f)).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
            long id = dm.enqueue(r);
            Toast.makeText(a, "Скачиваю новую версию…", Toast.LENGTH_SHORT).show();
            BroadcastReceiver br = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    if (i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;
                    try { a.getApplicationContext().unregisterReceiver(this); } catch (Exception ignored) {}
                    if (!f.exists() || f.length() < 100_000) { browser(a, inf); return; }
                    Uri u = FileProvider.getUriForFile(a, "ru.frudom.mail.files", f);
                    try { a.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK)); }
                    catch (Exception e) { browser(a, inf); }
                }
            };
            IntentFilter fl = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= 33) a.getApplicationContext().registerReceiver(br, fl, Context.RECEIVER_EXPORTED); else a.getApplicationContext().registerReceiver(br, fl);
        } catch (Exception e) { browser(a, inf); }
    }

    static void browser(Activity a, Info inf) {
        try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(inf.url))); } catch (Exception e) { Toast.makeText(a, "Скачайте новую версию по ссылке: " + inf.url, Toast.LENGTH_LONG).show(); }
    }
}
