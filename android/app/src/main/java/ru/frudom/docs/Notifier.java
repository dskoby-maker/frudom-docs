package ru.frudom.docs;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/** Уведомления «Документов ФД»: приложение само спрашивает таблицу (действие notes в Code.gs) — раз в час или как настроено.
 *  Настройки — в SharedPreferences «notify» (экран NotifySettingsActivity). */
public final class Notifier {
    static final String P = "notify";
    static final int JOB = 7701, JOB_W = 7702;
    /* виды уведомлений: ключ, название, пояснение */
    static final String[][] KINDS = {
        {"bank",  "Деньги пришли из банка", "Каждое новое поступление на счёт ИП: сумма, плательщик, назначение"},
        {"debt",  "Долги по накладным", "Сводка: что не оплачено больше 30 дней — один раз утром"},
        {"staff", "Что сделали сотрудники", "Документы, склад, задачи — действия Натальи, Гриши и Склада"},
        {"tasks", "Задачи на сегодня", "Утром — список невыполненных задач на день"},
    };
    static final long[] PERIODS = {15, 60, 180, 360};          // минуты
    static final String[] PERIOD_NAMES = {"Каждые 15 минут", "Раз в час", "Раз в 3 часа", "Раз в 6 часов"};

    private Notifier() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }
    static boolean on(Context c, String kind) { return prefs(c).getBoolean("on_" + kind, true); }
    static boolean enabled(Context c) { return prefs(c).getBoolean("enabled", true); }
    static boolean hasAccount(Context c) { SharedPreferences s = prefs(c); return !s.getString("user", "").isEmpty() && !s.getString("key", "").isEmpty() && !s.getString("url", "").isEmpty(); }
    static long periodMin(Context c) { return prefs(c).getLong("period", 60); }

    /** сайт сообщил, кто вошёл (или что вышли) */
    static void setAccount(Context c, String json) {
        try {
            JSONObject a = new JSONObject(json);
            String url = a.optString("url"), user = a.optString("user"), key = a.optString("key");
            SharedPreferences s = prefs(c);
            boolean same = url.equals(s.getString("url", "")) && user.equals(s.getString("user", "")) && key.equals(s.getString("key", ""));
            if (same) { if (!user.isEmpty()) schedule(c, false); return; }
            SharedPreferences.Editor e = s.edit().putString("url", url).putString("user", user).putString("key", key).putBoolean("admin", a.optBoolean("admin"));
            if (!user.equals(s.getString("user", ""))) e.putBoolean("init", false).remove("evAfter").remove("seen");   // другой человек — начать заново, без старых уведомлений
            e.apply();
            if (user.isEmpty() || key.isEmpty()) { cancel(c); s.edit().remove("wSum").putString("wMsg", "").apply(); QuickWidget.renderAll(c); } else schedule(c, true);
            widgetSoon(c);
        } catch (Exception ignored) {}
    }

    static void schedule(Context c, boolean replace) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if ((!enabled(c) && !QuickWidget.has(c)) || !hasAccount(c)) { js.cancel(JOB); return; }   // виджету тоже нужна проверка раз в час
        long ms = periodMin(c) * 60_000L;
        JobInfo cur = js.getPendingJob(JOB);
        if (!replace && cur != null && cur.getIntervalMillis() == ms) return;
        JobInfo.Builder b = new JobInfo.Builder(JOB, new ComponentName(c, NotifyJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPersisted(true);
        if (Build.VERSION.SDK_INT >= 24) b.setPeriodic(ms, Math.max(5 * 60_000L, ms / 4)); else b.setPeriodic(ms);
        try { js.schedule(b.build()); } catch (Exception ignored) {}
    }

    static void cancel(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB);
    }

    static boolean canNotify(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled();
    }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        int[] imp = {NotificationManager.IMPORTANCE_HIGH, NotificationManager.IMPORTANCE_DEFAULT, NotificationManager.IMPORTANCE_DEFAULT, NotificationManager.IMPORTANCE_DEFAULT};
        for (int i = 0; i < KINDS.length; i++) {
            NotificationChannel ch = new NotificationChannel(KINDS[i][0], KINDS[i][1], imp[i]);
            ch.setDescription(KINDS[i][2]);
            nm.createNotificationChannel(ch);
        }
    }

    static boolean quietNow(Context c) {
        SharedPreferences s = prefs(c);
        if (!s.getBoolean("quiet", true)) return false;
        int from = s.getInt("qFrom", 22 * 60), to = s.getInt("qTo", 8 * 60);
        Calendar k = Calendar.getInstance(); int m = k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE);
        return from <= to ? (m >= from && m < to) : (m >= from || m < to);
    }

    static String hm(int min) { return String.format(Locale.US, "%02d:%02d", min / 60, min % 60); }

    /** Одна проверка. force — по кнопке «Проверить сейчас»: без тихих часов, сводки утра показываются сразу.
     *  Возвращает понятный текст для экрана настроек. */
    static synchronized String check(Context c, boolean force) {
        SharedPreferences s = prefs(c);
        String now = new SimpleDateFormat("dd.MM HH:mm", new Locale("ru")).format(new Date());
        if (!hasAccount(c)) return save(s, now, "Нет входа: откройте приложение и войдите на сайте");
        if (QuickWidget.has(c)) widgetSync(c);
        if (!force && !enabled(c)) return "Уведомления выключены";
        if (!force && quietNow(c)) return save(s, now, "Тихие часы — проверю позже");
        StringBuilder kinds = new StringBuilder();
        for (String[] k : KINDS) if (on(c, k[0])) kinds.append(kinds.length() > 0 ? "," : "").append(k[0]);
        if (kinds.length() == 0) return save(s, now, "Все виды уведомлений выключены");
        JSONObject r;
        try {
            String q = "?action=notes&user=" + enc(s.getString("user", "")) + "&key=" + enc(s.getString("key", "")) + "&kinds=" + enc(kinds.toString())
                + "&evAfter=" + enc(s.getString("evAfter", "")) + (on(c, "bank") ? "&sync=1" : "") + "&device=" + enc("Android");
            r = new JSONObject(get(s.getString("url", "") + q));
        } catch (Exception e) { return save(s, now, "Нет связи с таблицей (" + e.getClass().getSimpleName() + ") — попробую позже"); }
        if (!r.optBoolean("ok")) {
            String er = r.optString("error");
            if ("auth".equals(er)) return save(s, now, "Пароль не подошёл: откройте приложение и войдите заново");
            if (er.contains("unknown action")) return save(s, now, "Скрипт таблицы старый: обновите Code.gs (инструкция в описании изменений)");
            return save(s, now, "Таблица ответила ошибкой: " + er);
        }
        channels(c);
        String today = r.optString("today");
        int mor = s.getInt("morning", 9 * 60);
        Calendar k = Calendar.getInstance(); int m = k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE);
        boolean morning = force || m >= mor;
        boolean debtDay = force || !"mon".equals(s.getString("debtWhen", "day")) || k.get(Calendar.DAY_OF_WEEK) == Calendar.MONDAY;
        boolean first = !s.getBoolean("init", false);
        LinkedHashSet<String> seen = new LinkedHashSet<>(Arrays.asList(s.getString("seen", "").split("\n")));
        SharedPreferences.Editor e = s.edit();
        JSONArray items = r.optJSONArray("items"); if (items == null) items = new JSONArray();
        List<JSONObject> staff = new ArrayList<>();
        int shown = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i); if (it == null) continue;
            String t = it.optString("t"), id = it.optString("id");
            if (!on(c, t)) continue;
            if (t.equals("bank")) {
                if (seen.contains(id)) continue; seen.add(id);
                if (first && !force) continue;                 // первая проверка: старые поступления не присылать
                show(c, t, id, it.optString("title"), it.optString("text"), it.optString("go")); shown++;
            } else if (t.equals("staff")) {
                if (first && !force) continue;
                staff.add(it);
            } else if (t.equals("debt") || t.equals("tasks")) {
                String last = s.getString("day_" + t, "");
                if (!force && (last.equals(today) || !morning || (t.equals("debt") && !debtDay))) continue;
                e.putString("day_" + t, today);
                show(c, t, t, it.optString("title"), it.optString("text"), it.optString("go")); shown++;
            }
        }
        if (!staff.isEmpty()) {
            if (staff.size() <= 3) for (JSONObject it : staff) { String[] x = evShort(it); show(c, "staff", it.optString("id"), it.optString("title") + " · " + x[0], x[1], it.optString("go")); shown++; }
            else {
                StringBuilder b = new StringBuilder();
                for (JSONObject it : staff) { String[] x = evShort(it); b.append(b.length() > 0 ? "\n" : "").append(it.optString("title")).append(" · ").append(x[0].toLowerCase(new Locale("ru"))).append(" · ").append(x[1]); }
                show(c, "staff", "staff-" + staff.get(staff.size() - 1).optString("id"), "Сотрудники: " + staff.size() + " действий", b.toString(), staff.get(0).optString("go")); shown++;
            }
        }
        String evLast = r.optString("evLast");
        if (!evLast.isEmpty()) e.putString("evAfter", evLast);
        List<String> keep = new ArrayList<>(seen); if (keep.size() > 400) keep = keep.subList(keep.size() - 400, keep.size());
        e.putString("seen", String.join("\n", keep)).putBoolean("init", true).apply();
        String res = shown == 0 ? "Всё в порядке, нового нет" : "Показано уведомлений: " + shown;
        if (!canNotify(c)) res += " (но уведомления запрещены в Android — нажмите «Разрешить уведомления»)";
        return save(s, now, res);
    }

    /** действие сотрудника коротко: {действие одним словом, «что № · заказчик»} */
    static String[] evShort(JSONObject it) {
        String act = it.optString("act"), raw = it.optString("raw");
        if (raw.isEmpty()) { String t = it.optString("text"); int k = t.indexOf(": "); if (k > 0 && k < 30) { act = t.substring(0, k); raw = t.substring(k + 2); } else raw = t; }
        return EvShort.of(act, raw);
    }

    /** виджет: попросить Android скоро (при первой связи) обновить цифры — одной разовой задачей */
    static void widgetSoon(Context c) {
        if (!QuickWidget.has(c)) return;
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        try { js.schedule(new JobInfo.Builder(JOB_W, new ComponentName(c, NotifyJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setOverrideDeadline(60_000L).build()); } catch (Exception ignored) {}
    }

    /** виджет: сводка из таблицы (action=notes, kinds=sum; Code.gs ≥ 23) → SharedPreferences → перерисовать виджеты */
    static synchronized void widgetSync(Context c) {
        SharedPreferences s = prefs(c);
        String hm = new SimpleDateFormat("HH:mm", new Locale("ru")).format(new Date()), msg;
        if (!hasAccount(c)) msg = "Войдите в приложении, чтобы видеть сводку";
        else try {
            JSONObject r = new JSONObject(get(s.getString("url", "") + "?action=notes&user=" + enc(s.getString("user", "")) + "&key=" + enc(s.getString("key", "")) + "&kinds=sum&device=" + enc("Android")));
            if (!r.optBoolean("ok")) msg = "auth".equals(r.optString("error")) ? "Войдите в приложении заново" : r.optString("error").contains("unknown action") ? "Обновите Code.gs в таблице" : "Таблица ответила ошибкой · " + hm;
            else if (r.optJSONObject("sum") == null) msg = "Для сводки обновите Code.gs в таблице";
            else { s.edit().putString("wSum", r.optJSONObject("sum").toString()).apply(); msg = "Обновлено в " + hm; }
        } catch (Exception e) { msg = (s.getString("wSum", "").isEmpty() ? "Нет связи" : "Нет связи · данные старые") + " · " + hm; }
        s.edit().putString("wMsg", msg).apply();
        QuickWidget.renderAll(c);
    }

    static String save(SharedPreferences s, String at, String msg) { s.edit().putString("lastAt", at).putString("lastMsg", msg).apply(); return msg; }

    static void show(Context c, String ch, String id, String title, String text, String go) {
        if (!canNotify(c)) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        int nid = id.hashCode();
        Intent open = new Intent(c, MainActivity.class).setAction("ru.frudom.docs.GO." + nid)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("go", go == null ? "" : go);
        PendingIntent pi = PendingIntent.getActivity(c, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent set = PendingIntent.getActivity(c, 9001, new Intent(c, NotifySettingsActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat).setColor(0xFF5B2A48).setContentTitle(title).setContentText(text.replace('\n', ' '))
            .setStyle(new Notification.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(pi)
            .setShowWhen(true).setWhen(System.currentTimeMillis())
            .addAction(new Notification.Action.Builder(null, "Настроить", set).build());
        if (Build.VERSION.SDK_INT < 26) b.setPriority(ch.equals("bank") ? Notification.PRIORITY_HIGH : Notification.PRIORITY_DEFAULT).setDefaults(Notification.DEFAULT_ALL);
        try { nm.notify(nid, b.build()); } catch (Exception ignored) {}
    }

    static String enc(String v) { try { return URLEncoder.encode(v, "UTF-8"); } catch (Exception e) { return ""; } }

    /** GET с переходами (Apps Script отвечает через перенаправление на googleusercontent.com) */
    static String get(String url) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
            h.setInstanceFollowRedirects(false); h.setConnectTimeout(20000); h.setReadTimeout(60000);
            h.setRequestProperty("User-Agent", "FrudomDocsApp/notify");
            int code = h.getResponseCode();
            if (code >= 300 && code < 400) { String loc = h.getHeaderField("Location"); h.disconnect(); if (loc == null) throw new Exception("redirect"); url = new URL(new URL(url), loc).toString(); continue; }
            InputStream in = code >= 400 ? h.getErrorStream() : h.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
            if (in != null) { while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            h.disconnect();
            if (code >= 400) throw new Exception("HTTP " + code);
            return b.toString(StandardCharsets.UTF_8.name());
        }
        throw new Exception("redirects");
    }

    static Intent appSettings(Context c) {
        if (Build.VERSION.SDK_INT >= 26) return new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        return new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
    }
}
