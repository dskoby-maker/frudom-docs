package ru.frudom.mail;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.regex.Pattern;

/** Почта для настоящих экранов Android: те же действия Code.gs, что и у сайта (mail: list / sync / get / att / set / tag).
 *  Последний список писем хранится на телефоне (mail-list.json) — открывается сразу и без интернета.
 *  Правила папок те же, что на сайте (mail_seg.js: mlSpam, mlMinor, mlFld, mlUnread, «Заявки»). */
final class MailApi {
    private MailApi() {}
    static volatile boolean dirty;          // вернулись с сайта (ответили, переложили…) — обновить список

    static JSONArray rows = new JSONArray(), acc = new JSONArray(), folders = new JSONArray();
    static Map<String, JSONObject> tags = new HashMap<>();
    static long at;                          // когда список пришёл из таблицы
    static String err = "";

    static SharedPreferences p(Context c) { return MailNotifier.prefs(c); }
    static boolean ro(Context c) { return p(c).getBoolean("staff", false); }
    static String user(Context c) { return p(c).getString("user", ""); }

    /* ---------- запросы к таблице ---------- */
    static JSONObject call(Context c, JSONObject body) throws Exception {
        SharedPreferences s = p(c);
        body.put("action", "mail").put("user", s.getString("user", "")).put("key", s.getString("key", ""));
        JSONObject r = new JSONObject(MailNotifier.post(s.getString("url", ""), body.toString()));
        if (!r.optBoolean("ok")) {
            String e = r.optString("error");
            throw new Exception("auth".equals(e) ? "Пароль не подошёл — войдите заново" : e.contains("unknown action") ? "Скрипт таблицы старый — обновите Code.gs" : e.isEmpty() ? "таблица ответила ошибкой" : e);
        }
        return r;
    }

    /** список писем; sync — сначала забрать новые из ящиков (до минуты) */
    static void load(Context c, boolean sync) throws Exception {
        JSONObject r = call(c, new JSONObject().put("op", sync ? "sync" : "list"));
        take(r); at = System.currentTimeMillis(); dirty = false;
        try (FileOutputStream o = new FileOutputStream(cache(c))) { o.write(new JSONObject().put("rows", rows).put("acc", acc).put("folders", folders).put("tags", new JSONArray(tags.values())).put("at", at).toString().getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) {}
        JSONObject e = r.optJSONObject("errs"); err = "";
        if (e != null && e.length() > 0) err = "Ящик не ответил: " + e.optString(e.keys().next());
    }

    static void take(JSONObject r) {
        if (r.optJSONArray("rows") != null) rows = r.optJSONArray("rows");
        if (r.optJSONArray("acc") != null) acc = r.optJSONArray("acc");
        if (r.optJSONArray("folders") != null) folders = r.optJSONArray("folders");
        JSONArray t = r.optJSONArray("tags");
        if (t != null) { tags.clear(); for (int i = 0; i < t.length(); i++) { JSONObject x = t.optJSONObject(i); if (x != null) tags.put(x.optString("id").toLowerCase(), x); } }
    }

    static File cache(Context c) { return new File(c.getFilesDir(), "mail-list.json"); }

    /** список с телефона (пока таблица не ответила) */
    static boolean loadCache(Context c) {
        try {
            File f = cache(c); if (!f.exists()) return false;
            JSONObject o = new JSONObject(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
            take(o); at = o.optLong("at"); return rows.length() > 0;
        } catch (Exception e) { return false; }
    }

    static void forget(Context c) { rows = new JSONArray(); acc = new JSONArray(); folders = new JSONArray(); tags.clear(); at = 0; cache(c).delete(); }

    /** полный текст письма {text, html, err} */
    static JSONObject get(Context c, String id) throws Exception { return call(c, new JSONObject().put("op", "get").put("id", id)); }

    /** вложение {name, mime, data (base64)} */
    static JSONObject att(Context c, String id, int i) throws Exception { return call(c, new JSONObject().put("op", "att").put("id", id).put("i", i)); }

    /** отметки письма: прочитано и поле order (заявка, обработано, неважные, спам, своя папка) */
    static void set(Context c, JSONObject row) throws Exception {
        JSONObject x = new JSONObject().put("id", row.optString("id")).put("read", !row.optString("read").isEmpty()).put("order", row.optString("order"));
        call(c, new JSONObject().put("op", "set").put("rows", new JSONArray().put(x)));
    }

    static void tag(Context c, String email, String kind) throws Exception {
        JSONObject r = call(c, new JSONObject().put("op", "tag").put("email", email).put("kind", kind).put("cid", ""));
        take(r);
    }

    /* ---------- что за письмо ---------- */
    static JSONObject ord(JSONObject r) { try { String s = r.optString("order"); return s.isEmpty() ? new JSONObject() : new JSONObject(s); } catch (Exception e) { return new JSONObject(); } }
    static void ordPatch(JSONObject r, String k, Object v) {
        JSONObject o = ord(r);
        try { if (v == null) o.remove(k); else o.put(k, v); } catch (Exception ignored) {}
        try { r.put("order", o.length() == 0 ? "" : o.toString()); } catch (Exception ignored) {}
    }
    static String addr(JSONObject r) { return r.optString("from").trim().toLowerCase(); }
    static String tagKind(JSONObject r) { JSONObject t = tags.get(addr(r)); return t == null ? "" : t.optString("kind"); }
    static boolean sent(JSONObject r) { return "sent".equals(r.optString("dir")); }
    static boolean spam(JSONObject r) {
        if (sent(r)) return false; JSONObject o = ord(r);
        if (o.has("spam")) { int v = o.optInt("spam", -1); if (v == 1) return true; if (v == 0) return false; }
        return "spam".equals(tagKind(r));
    }
    static boolean minor(JSONObject r) { return !sent(r) && !spam(r) && ord(r).optInt("minor") == 1; }
    static String fld(JSONObject r) { return ord(r).optString("fld"); }
    static boolean unread(Context c, JSONObject r) { return !sent(r) && r.optString("read").isEmpty() && !ro(c) && !spam(r) && !minor(r); }
    static boolean done(JSONObject r) { return ord(r).optJSONObject("done") != null; }
    static boolean todo(JSONObject r) { return ord(r).optJSONObject("todo") != null; }
    static final Pattern ORD = Pattern.compile("заявк|заказ|поставк|отгрузк", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    static boolean isOrd(JSONObject r) {
        JSONObject o = ord(r);
        if ("no".equals(o.optString("st")) || spam(r) || "no".equals(tagKind(r)) || sent(r)) return false;
        return "taken".equals(o.optString("st")) || ORD.matcher(r.optString("subject") + " " + r.optString("snippet") + " " + r.optString("attsText")).find();
    }

    static final String[][] FOLDERS = {{"in", "Входящие"}, {"ord", "Заявки"}, {"unread", "Непрочитанные"}, {"undone", "Не обработаны"}, {"all", "Все письма"}, {"sent", "Отправленные"}, {"minor", "Неважные"}, {"spam", "Спам"}};
    static String folderName(String f) {
        for (String[] x : FOLDERS) if (x[0].equals(f)) return x[1];
        if (f.startsWith("u:")) for (int i = 0; i < folders.length(); i++) { JSONObject x = folders.optJSONObject(i); if (x != null && f.substring(2).equals(x.optString("id"))) return x.optString("name"); }
        return "Входящие";
    }

    /** письма папки f, ящика box (пусто — все), по поиску q — новые сверху */
    static List<JSONObject> list(Context c, String f, String box, String q) {
        List<JSONObject> L = new ArrayList<>(); String uf = f.startsWith("u:") ? f.substring(2) : "", qq = q == null ? "" : q.trim().toLowerCase();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject r = rows.optJSONObject(i); if (r == null) continue;
            if (!box.isEmpty() && !box.equals(r.optString("acc"))) continue;
            boolean ok;
            switch (f) {
                case "all": ok = true; break;
                case "sent": ok = sent(r); break;
                case "spam": ok = spam(r); break;
                case "minor": ok = minor(r); break;
                case "unread": ok = unread(c, r); break;
                case "undone": ok = !sent(r) && !spam(r) && !minor(r) && todo(r); break;
                case "ord": ok = !spam(r) && !minor(r) && isOrd(r); break;
                default: ok = !uf.isEmpty() ? !sent(r) && !spam(r) && uf.equals(fld(r)) : !sent(r) && !spam(r) && !minor(r) && fld(r).isEmpty();
            }
            if (!ok) continue;
            if (!qq.isEmpty() && !(r.optString("subject") + " " + r.optString("fromName") + " " + r.optString("from") + " " + r.optString("to") + " " + r.optString("snippet") + " " + r.optString("attsText")).toLowerCase().contains(qq)) continue;
            L.add(r);
        }
        L.sort((a, b) -> b.optString("date").compareTo(a.optString("date")));
        return L;
    }

    static int count(Context c, String f) {
        if (f.equals("unread")) { int n = 0; for (int i = 0; i < rows.length(); i++) { JSONObject r = rows.optJSONObject(i); if (r != null && unread(c, r)) n++; } return n; }
        if (f.equals("in")) { int n = 0; for (int i = 0; i < rows.length(); i++) { JSONObject r = rows.optJSONObject(i); if (r != null && unread(c, r) && fld(r).isEmpty()) n++; } return n; }
        if (f.equals("undone")) return list(c, f, "", "").size();
        if (f.equals("spam")) return list(c, f, "", "").size();
        if (f.startsWith("u:")) { int n = 0; for (JSONObject r : list(c, f, "", "")) if (unread(c, r)) n++; return n; }
        return 0;
    }

    static JSONObject find(String id) { for (int i = 0; i < rows.length(); i++) { JSONObject r = rows.optJSONObject(i); if (r != null && id.equals(r.optString("id"))) return r; } return null; }
    static JSONObject accOf(String id) { for (int i = 0; i < acc.length(); i++) { JSONObject a = acc.optJSONObject(i); if (a != null && id.equals(a.optString("id"))) return a; } return null; }
    static JSONArray atts(JSONObject r) { try { return new JSONArray(r.optString("atts", "[]")); } catch (Exception e) { return new JSONArray(); } }

    /* ---------- даты ---------- */
    static Date date(String iso) { long t = MailNotifier.time(iso); return t > 0 ? new Date(t) : null; }
    static String day(Date d) {
        if (d == null) return "";
        SimpleDateFormat k = new SimpleDateFormat("yyyy-MM-dd", Locale.US); String x = k.format(d), t = k.format(new Date()), y = k.format(new Date(System.currentTimeMillis() - 86400000L));
        if (x.equals(t)) return "Сегодня"; if (x.equals(y)) return "Вчера";
        String s = new SimpleDateFormat(x.substring(0, 4).equals(t.substring(0, 4)) ? "EEEE, d MMMM" : "d MMMM yyyy", new Locale("ru")).format(d);
        return s.substring(0, 1).toUpperCase(new Locale("ru")) + s.substring(1);
    }
    static String shortTime(Date d) {
        if (d == null) return "";
        SimpleDateFormat k = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        if (k.format(d).equals(k.format(new Date()))) return new SimpleDateFormat("HH:mm", Locale.US).format(d);
        return new SimpleDateFormat("d MMM", new Locale("ru")).format(d).replace(".", "");
    }
    static String full(Date d) { return d == null ? "" : new SimpleDateFormat("d MMMM yyyy, HH:mm", new Locale("ru")).format(d); }
    static String nowIso() { SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US); f.setTimeZone(TimeZone.getTimeZone("UTC")); return f.format(new Date()); }
    /** проверка на эмуляторе без входа (--ez demo true): несколько писем для снимков экрана */
    static boolean demo;
    static void demo(Context c) {
        demo = true;
        try {
            long n = System.currentTimeMillis(); SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US); f.setTimeZone(TimeZone.getTimeZone("UTC"));
            acc = new JSONArray().put(new JSONObject().put("id", "mA").put("email", "frudom.ru@mail.ru")).put(new JSONObject().put("id", "mB").put("email", "info@frudom.ru"));
            Object[][] L = {
                {"d1", "mB", "Цирк бухгалтерия", "buh@circus.ru", "Акт сверки за октябрь", "Добрый день! Пришлите, пожалуйста, акт сверки за октябрь, подписанный с вашей стороны.", 0.3, "", "акт.xlsx", "[{\"n\":\"акт.xlsx\",\"s\":48211}]"},
                {"d2", "mA", "МГУ Комбинат питания", "zakaz@msu.ru", "Заявка на 14.11", "Прошу поставить: помидоры 10 кг, огурцы 5 кг, укроп 1 кг. Приёмка с 8 до 12.", 2.0, "", "", "[]"},
                {"d3", "mA", "НИИР им. Насоновой", "snab@niir.ru", "Документ о приёмке подписан", "Документ о приёмке по контракту 142-2026 подписан в ЕИС.", 5.0, "1", "", "[]"},
                {"d4", "mB", "Клиническая больница № 1", "pitanie@kb1.ru", "Шампиньоны на пятницу", "Добрый день, на пятницу нужно 3 коробки шампиньонов.", 26.0, "1", "", "[]"},
            };
            rows = new JSONArray();
            for (Object[] x : L) rows.put(new JSONObject().put("id", x[0]).put("acc", x[1]).put("fromName", x[2]).put("from", x[3]).put("to", "frudom.ru@mail.ru").put("subject", x[4]).put("snippet", x[5])
                .put("date", f.format(new Date(n - Math.round((double) x[6] * 3600_000)))).put("read", x[7]).put("attsText", x[8]).put("atts", x[9]).put("dir", "in").put("order", x[0].equals("d3") ? "{\"done\":{\"by\":\"Наталья\",\"at\":\"\"}}" : ""));
            at = n;
            for (int i = 0; i < rows.length(); i++) LetterActivity.BODY.put(rows.optJSONObject(i).optString("id"), new JSONObject().put("text", rows.optJSONObject(i).optString("snippet") + "\n\nС уважением,\n" + rows.optJSONObject(i).optString("fromName")));
        } catch (Exception ignored) {}
    }

    static String size(long s) { return s >= 1048576 ? String.format(new Locale("ru"), "%.1f МБ", s / 1048576.0) : Math.max(1, Math.round(s / 1024.0)) + " КБ"; }
}
