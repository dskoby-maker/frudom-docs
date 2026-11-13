package ru.frudom.mail;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationChannelGroup;
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
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.StyleSpan;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/** Уведомления «Почты ФД»: телефон сам (раз в 15 минут или как настроено) спрашивает таблицу о новых письмах —
 *  действие notes с kinds=mail в Code.gs ≥ 36; таблица заодно забирает письма из ящиков.
 *  Одно письмо — одно уведомление (отправитель, тема, начало письма; «Прочитано», «Ответить»), несколько — ещё и сводка.
 *  Прочитали письмо где угодно (в приложении, на сайте, на компьютере) — уведомление убирается само.
 *  Настройки — SharedPreferences «mail» (экран MailSettingsActivity). */
public final class MailNotifier {
    static final String P = "mail", GROUP = "frudom-mail";
    static final int JOB = 8801, SUMMARY = 8800;
    static final long[] PERIODS = {15, 30, 60, 180};          // минуты
    static final String[] PERIOD_NAMES = {"Каждые 15 минут", "Каждые 30 минут", "Раз в час", "Раз в 3 часа"};

    private MailNotifier() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }
    static boolean enabled(Context c) { return prefs(c).getBoolean("enabled", true); }
    static boolean hasAccount(Context c) { SharedPreferences s = prefs(c); return !s.getString("user", "").isEmpty() && !s.getString("key", "").isEmpty() && !s.getString("url", "").isEmpty(); }
    static boolean readOnly(Context c) { return prefs(c).getBoolean("staff", false); }
    static long periodMin(Context c) { return prefs(c).getLong("period", 15); }

    /** сайт сообщил, кто вошёл (или что вышли) */
    static void setAccount(Context c, String json) {
        try {
            JSONObject a = new JSONObject(json);
            String url = a.optString("url"), user = a.optString("user"), key = a.optString("key");
            SharedPreferences s = prefs(c);
            boolean same = url.equals(s.getString("url", "")) && user.equals(s.getString("user", "")) && key.equals(s.getString("key", ""));
            if (same) { if (!user.isEmpty()) schedule(c, false); return; }
            SharedPreferences.Editor e = s.edit().putString("url", url).putString("user", user).putString("key", key)
                .putBoolean("admin", a.optBoolean("admin")).putBoolean("staff", a.optBoolean("staff"));
            if (!user.equals(s.getString("user", ""))) { e.putBoolean("init", false).remove("seen").remove("act"); clearAll(c); }   // другой человек — без старых уведомлений
            e.apply();
            if (user.isEmpty() || key.isEmpty()) { cancel(c); clearAll(c); } else schedule(c, true);
        } catch (Exception ignored) {}
    }

    static void schedule(Context c, boolean replace) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (!enabled(c) || !hasAccount(c)) { js.cancel(JOB); return; }
        long ms = periodMin(c) * 60_000L;
        JobInfo cur = js.getPendingJob(JOB);
        if (!replace && cur != null && cur.getIntervalMillis() == ms) return;
        JobInfo.Builder b = new JobInfo.Builder(JOB, new ComponentName(c, MailJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true);
        b.setPeriodic(ms, Math.max(5 * 60_000L, ms / 3));
        try { js.schedule(b.build()); } catch (Exception ignored) {}
    }

    static void cancel(Context c) { JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE); if (js != null) js.cancel(JOB); }

    static boolean canNotify(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = nm(c);
        return nm == null || nm.areNotificationsEnabled();
    }

    static NotificationManager nm(Context c) { return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); }

    /** каналы Android: звук и вид каждого можно поменять в настройках телефона */
    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = nm(c); if (nm == null) return;
        nm.createNotificationChannelGroup(new NotificationChannelGroup("mailg", "Почта"));
        NotificationChannel a = new NotificationChannel("mail", "Новые письма", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Каждое новое письмо: от кого, тема и начало письма"); a.setGroup("mailg"); a.setShowBadge(true);
        NotificationChannel b = new NotificationChannel("order", "Заявки в письмах", NotificationManager.IMPORTANCE_HIGH);
        b.setDescription("Письма, похожие на заявку: «заявка», «заказ», «поставка» в теме или тексте"); b.setGroup("mailg"); b.setShowBadge(true);
        NotificationChannel d = new NotificationChannel("sum", "Сводка писем", NotificationManager.IMPORTANCE_LOW);
        d.setDescription("Общая строка «N новых писем», когда писем несколько"); d.setGroup("mailg"); d.setShowBadge(false);
        nm.createNotificationChannel(a); nm.createNotificationChannel(b); nm.createNotificationChannel(d);
    }

    static boolean quietNow(Context c) {
        SharedPreferences s = prefs(c);
        if (!s.getBoolean("quiet", false)) return false;
        int from = s.getInt("qFrom", 22 * 60), to = s.getInt("qTo", 8 * 60);
        Calendar k = Calendar.getInstance(); int m = k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE);
        return from <= to ? (m >= from && m < to) : (m >= from || m < to);
    }

    static String hm(int min) { return String.format(Locale.US, "%02d:%02d", min / 60, min % 60); }

    /** Одна проверка. force — по кнопке «Проверить сейчас» (без тихих часов). Возвращает понятный текст для экрана настроек. */
    static synchronized String check(Context c, boolean force) {
        SharedPreferences s = prefs(c);
        String now = new SimpleDateFormat("dd.MM HH:mm", new Locale("ru")).format(new Date());
        if (!hasAccount(c)) return save(s, now, "Нет входа: откройте «Почту ФД» и войдите");
        if (!force && !enabled(c)) return "Уведомления выключены";
        boolean quiet = !force && quietNow(c);
        JSONObject r;
        try {
            String q = "?action=notes&kinds=mail&msync=1&user=" + enc(s.getString("user", "")) + "&key=" + enc(s.getString("key", "")) + "&device=" + enc("Android: Почта ФД");
            r = new JSONObject(get(s.getString("url", "") + q));
        } catch (Exception e) { return save(s, now, "Нет связи с таблицей (" + e.getClass().getSimpleName() + ") — попробую позже"); }
        if (!r.optBoolean("ok")) {
            String er = r.optString("error");
            if ("auth".equals(er)) return save(s, now, "Пароль не подошёл: откройте «Почту ФД» и войдите заново");
            if (er.contains("unknown action")) return save(s, now, "Скрипт таблицы старый: обновите Code.gs (нужна версия 36)");
            return save(s, now, "Таблица ответила ошибкой: " + er);
        }
        JSONObject mi = r.optJSONObject("mail");
        if (mi == null) return save(s, now, "Скрипт таблицы старый: обновите Code.gs (нужна версия 36), тогда придут уведомления о письмах");
        SharedPreferences.Editor e = s.edit();
        JSONArray boxes = mi.optJSONArray("boxes"); if (boxes != null) e.putString("boxes", boxes.toString());
        e.putBoolean("staff", mi.optBoolean("ro", s.getBoolean("staff", false)));
        channels(c);

        /* прочитанные где угодно — убрать их уведомления (только у тех, кто отмечает прочитанное) */
        JSONArray ids = mi.optJSONArray("ids");
        if (ids != null) { Set<String> keep = new HashSet<>(); for (int i = 0; i < ids.length(); i++) keep.add(ids.optString(i)); dropExcept(c, keep); }

        boolean first = !s.getBoolean("init", false), onlyOrd = s.getBoolean("onlyOrd", false);
        LinkedHashSet<String> seen = new LinkedHashSet<>(Arrays.asList(s.getString("seen", "").split("\n")));
        JSONArray items = r.optJSONArray("items"); if (items == null) items = new JSONArray();
        int shown = 0, skipped = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i); if (it == null || !"mail".equals(it.optString("t"))) continue;
            String id = it.optString("id");
            if (seen.contains(id)) continue;
            if (first && !force) { seen.add(id); continue; }            // первая проверка: старые письма не присылать
            if (quiet) { skipped++; continue; }                         // тихие часы: покажем после них (в seen не кладём)
            seen.add(id);
            if (!s.getBoolean("box_" + it.optString("acc"), true)) continue;
            boolean ord = it.optInt("ord") == 1;
            if (onlyOrd && !ord) continue;
            show(c, it, ord); shown++;
        }
        List<String> keep = new ArrayList<>(seen); if (keep.size() > 600) keep = keep.subList(keep.size() - 600, keep.size());
        e.putString("seen", String.join("\n", keep)).putBoolean("init", true).putInt("unread", mi.optInt("unread")).apply();
        summary(c);
        String res = shown > 0 ? "Новых писем: " + shown : quiet && skipped > 0 ? "Тихие часы — " + skipped + " новых покажу после " + hm(s.getInt("qTo", 8 * 60)) : first ? "Готово. Дальше буду присылать каждое новое письмо" : "Новых писем нет";
        String serr = mi.optString("err");
        if (!serr.isEmpty()) res += ". Ящик не ответил: " + (serr.length() > 140 ? serr.substring(0, 140) + "…" : serr);
        if (!canNotify(c)) res += " (уведомления запрещены в Android — нажмите «Разрешить уведомления»)";
        return save(s, now, res);
    }

    static String save(SharedPreferences s, String at, String msg) { s.edit().putString("lastAt", at).putString("lastMsg", msg).apply(); return msg; }

    /* ---------- показанные уведомления: id письма → строка для сводки (act в настройках) ---------- */
    static JSONObject act(Context c) { try { return new JSONObject(prefs(c).getString("act", "{}")); } catch (Exception e) { return new JSONObject(); } }
    static void actSave(Context c, JSONObject a) { prefs(c).edit().putString("act", a.toString()).apply(); }
    static int nid(String id) { return ("m:" + id).hashCode() & 0x7FFFFFFF | 0x10000; }

    static void show(Context c, JSONObject it, boolean ord) {
        if (!canNotify(c)) return;
        NotificationManager nm = nm(c); if (nm == null) return;
        String id = it.optString("id"), who = it.optString("title"), subj = it.optString("text"), snip = it.optString("snip").trim(), box = it.optString("box"), atts = it.optString("atts");
        int n = nid(id);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ord ? "order" : "mail") : new Notification.Builder(c);
        SpannableStringBuilder big = new SpannableStringBuilder(subj);
        big.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, subj.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (!snip.isEmpty()) big.append("\n").append(snip.length() > 300 ? snip.substring(0, 300) + "…" : snip);
        if (!atts.isEmpty()) big.append("\n📎 ").append(atts);
        long when = time(it.optString("at"));
        b.setSmallIcon(R.drawable.ic_stat_mail).setColor(0xFF1E4A5C)
            .setContentTitle(who).setContentText(subj).setStyle(new Notification.BigTextStyle().bigText(big))
            .setSubText(ord ? "Заявка · " + box : box)
            .setWhen(when > 0 ? when : System.currentTimeMillis()).setShowWhen(true)
            .setAutoCancel(true).setGroup(GROUP).setCategory(Notification.CATEGORY_EMAIL)
            .setContentIntent(open(c, id, "", n))
            .setDeleteIntent(MailAction.pi(c, MailAction.DISMISS, id, n));
        if (!readOnly(c)) {
            b.addAction(new Notification.Action.Builder(null, "Прочитано", MailAction.pi(c, MailAction.READ, id, n)).build());
            b.addAction(new Notification.Action.Builder(null, "Ответить", open(c, id, "reply", n + 1)).build());
        }
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        try { nm.notify(n, b.build()); } catch (Exception ignored) { return; }
        JSONObject a = act(c);
        try { a.put(id, new JSONObject().put("w", who).put("s", subj).put("t", when).put("o", ord ? 1 : 0)); } catch (Exception ignored) {}
        actSave(c, a);
    }

    /** сводка «N новых писем» — Android складывает под неё письма, когда их больше одного */
    static void summary(Context c) {
        NotificationManager nm = nm(c); if (nm == null) return;
        JSONObject a = act(c);
        if (a.length() < 2 || !canNotify(c)) { nm.cancel(SUMMARY); return; }
        Notification.InboxStyle st = new Notification.InboxStyle();
        List<JSONObject> L = new ArrayList<>();
        for (Iterator<String> k = a.keys(); k.hasNext(); ) { JSONObject x = a.optJSONObject(k.next()); if (x != null) L.add(x); }
        L.sort((x, y) -> Long.compare(y.optLong("t"), x.optLong("t")));
        for (int i = 0; i < Math.min(6, L.size()); i++) {
            JSONObject x = L.get(i); String w = x.optString("w");
            SpannableStringBuilder line = new SpannableStringBuilder(w); line.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, w.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            line.append("  ").append(x.optString("s")); st.addLine(line);
        }
        if (L.size() > 6) st.setSummaryText("и ещё " + (L.size() - 6));
        String t = L.size() + " " + word(L.size());
        st.setBigContentTitle(t);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "sum") : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_mail).setColor(0xFF1E4A5C).setContentTitle(t).setContentText(L.get(0).optString("w") + " — " + L.get(0).optString("s"))
            .setStyle(st).setGroup(GROUP).setGroupSummary(true).setAutoCancel(true).setNumber(L.size())
            .setContentIntent(open(c, "", "in", SUMMARY));
        if (Build.VERSION.SDK_INT >= 26) b.setGroupAlertBehavior(Notification.GROUP_ALERT_CHILDREN);
        try { nm.notify(SUMMARY, b.build()); } catch (Exception ignored) {}
    }

    static String word(int n) { int a = n % 100, b = n % 10; return a >= 11 && a <= 14 ? "новых писем" : b == 1 ? "новое письмо" : b >= 2 && b <= 4 ? "новых письма" : "новых писем"; }

    static PendingIntent open(Context c, String id, String how, int req) {
        Intent i = new Intent(c, MainActivity.class).setAction("ru.frudom.mail.OPEN." + req)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("mail", id).putExtra("how", how);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** убрать уведомление письма (открыли, прочитали, смахнули) */
    static void dismiss(Context c, String id) {
        NotificationManager nm = nm(c); if (nm != null) nm.cancel(nid(id));
        JSONObject a = act(c); if (a.has(id)) { a.remove(id); actSave(c, a); }
        summary(c);
    }

    /** оставить уведомления только о письмах, которые ещё не прочитаны */
    static void dropExcept(Context c, Set<String> unread) {
        JSONObject a = act(c); List<String> gone = new ArrayList<>();
        for (Iterator<String> k = a.keys(); k.hasNext(); ) { String id = k.next(); if (!unread.contains(id)) gone.add(id); }
        if (gone.isEmpty()) return;
        NotificationManager nm = nm(c);
        for (String id : gone) { a.remove(id); if (nm != null) nm.cancel(nid(id)); }
        actSave(c, a); summary(c);
    }

    /** сайт в приложении сообщил, что сейчас не прочитано ({loaded, ro, unread:[id…]}) */
    static void syncRead(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json); JSONArray L = o.optJSONArray("unread");
            if (!o.optBoolean("loaded") || L == null) return;
            Set<String> keep = new HashSet<>(); for (int i = 0; i < L.length(); i++) keep.add(L.optString(i));
            dropExcept(c, keep);
        } catch (Exception ignored) {}
    }

    static void clearAll(Context c) {
        NotificationManager nm = nm(c); JSONObject a = act(c);
        if (nm != null) { for (Iterator<String> k = a.keys(); k.hasNext(); ) nm.cancel(nid(k.next())); nm.cancel(SUMMARY); }
        prefs(c).edit().putString("act", "{}").apply();
    }

    /** отметить письмо прочитанным в таблице (кнопка «Прочитано» в уведомлении) */
    static boolean markRead(Context c, String id) {
        SharedPreferences s = prefs(c);
        try {
            JSONObject body = new JSONObject().put("action", "mail").put("op", "set").put("user", s.getString("user", "")).put("key", s.getString("key", ""))
                .put("rows", new JSONArray().put(new JSONObject().put("id", id).put("read", 1)));
            JSONObject r = new JSONObject(post(s.getString("url", ""), body.toString()));
            return r.optBoolean("ok");
        } catch (Exception e) { return false; }
    }

    static long time(String iso) {
        if (iso == null || iso.isEmpty()) return 0;
        for (String f : new String[]{"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'"}) {
            try { SimpleDateFormat d = new SimpleDateFormat(f, Locale.US); d.setTimeZone(TimeZone.getTimeZone("UTC")); return d.parse(iso).getTime(); } catch (Exception ignored) {}
        }
        return 0;
    }

    static String enc(String v) { try { return URLEncoder.encode(v, "UTF-8"); } catch (Exception e) { return ""; } }

    static String read(HttpURLConnection h, int code) throws Exception {
        InputStream in = code >= 400 ? h.getErrorStream() : h.getInputStream();
        ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
        if (in != null) { while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
        return b.toString(StandardCharsets.UTF_8.name());
    }

    /** GET с переходами (Apps Script отвечает через перенаправление на googleusercontent.com) */
    static String get(String url) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
            h.setInstanceFollowRedirects(false); h.setConnectTimeout(20000); h.setReadTimeout(120000);
            h.setRequestProperty("User-Agent", "FrudomMailApp/notify");
            int code = h.getResponseCode();
            if (code >= 300 && code < 400) { String loc = h.getHeaderField("Location"); h.disconnect(); if (loc == null) throw new Exception("redirect"); url = new URL(new URL(url), loc).toString(); continue; }
            String out = read(h, code); h.disconnect();
            if (code >= 400) throw new Exception("HTTP " + code);
            return out;
        }
        throw new Exception("redirects");
    }

    /** POST JSON; после перенаправления Apps Script ответ забирается обычным GET */
    static String post(String url, String json) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setInstanceFollowRedirects(false); h.setConnectTimeout(20000); h.setReadTimeout(60000);
        h.setRequestMethod("POST"); h.setDoOutput(true); h.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
        h.setRequestProperty("User-Agent", "FrudomMailApp/notify");
        try (OutputStream o = h.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
        int code = h.getResponseCode();
        if (code >= 300 && code < 400) { String loc = h.getHeaderField("Location"); h.disconnect(); if (loc == null) throw new Exception("redirect"); return get(new URL(new URL(url), loc).toString()); }
        String out = read(h, code); h.disconnect();
        if (code >= 400) throw new Exception("HTTP " + code);
        return out;
    }

    static Intent appSettings(Context c) {
        if (Build.VERSION.SDK_INT >= 26) return new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        return new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
    }
}
