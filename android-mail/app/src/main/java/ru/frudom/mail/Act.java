package ru.frudom.mail;

import android.app.Activity;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Отметки писем — так же, как на сайте (mail_seg.js: mlBulk, mlRestore, mlOrdPatch):
 *  сразу на экране, потом в таблицу. В таблицу уходит patch — только то, что поменяли (две отметки разных людей не затирают друг друга),
 *  и order целиком — для старого Code.gs. Не сохранилось — вернуть как было и сказать. У массовых отметок есть «Отменить». */
final class Act {
    private Act() {}

    interface Done { void run(); }

    /** что было до отметки — для «Отменить» */
    static final class Undo {
        final List<String[]> rows = new ArrayList<>();   // {id, read, order}
        final List<String> tagged = new ArrayList<>(), untagged = new ArrayList<>();
        String text = ""; long at; int n;
    }
    static Undo last;   // последняя отметка из окна письма — список покажет «Отменить», когда к нему вернутся

    static String label(String act, int n) {
        String w = n > 1 ? ": " + n + " " + plural(n, "письмо", "письма", "писем") : "";
        if (act.startsWith("fld:")) { String f = act.substring(4); return (f.isEmpty() ? "Снова во «Входящих»" : "В папке «" + MailApi.folderName("u:" + f) + "»") + w; }
        switch (act) {
            case "read": return "Прочитано" + w;
            case "unread": return "Не прочитано" + w;
            case "done": return "Обработано" + w;
            case "todo": return "Не обработано" + w;
            case "unmark": return "Пометка снята" + w;
            case "minor": return "В «Неважных»" + w;
            case "major": return "Снова во «Входящих»" + w;
            case "spam": return "В спаме" + w;
            case "nospam": return "Не спам — снова во «Входящих»" + w;
            case "notord": return "Отмечено: не заявка";
            case "isord": return "Отмечено: заявка";
            default: return act;
        }
    }
    static String plural(int n, String a, String b, String c) { int x = n % 100, y = n % 10; return x >= 11 && x <= 14 ? c : y == 1 ? a : y >= 2 && y <= 4 ? b : c; }

    /** отметить письма; after — перерисовать экран (вызывается сразу и, если таблица отказала, после возврата) */
    static Undo apply(Activity a, List<JSONObject> L, String act, Done after) {
        Undo u = new Undo(); u.at = System.currentTimeMillis();
        List<JSONObject> out = new ArrayList<>(); String now = MailApi.nowIso(), me = MailApi.user(a);
        for (JSONObject r : L) {
            if (r == null || MailApi.sent(r)) continue;
            JSONObject o = MailApi.ord(r), P = new JSONObject(); Boolean rd = null; boolean ord = true;
            String id = r.optString("id"), read0 = r.optString("read"), ord0 = r.optString("order");
            try {
                switch (act) {
                    case "read": rd = true; ord = false; break;
                    case "unread": rd = false; ord = false; break;
                    case "done": P.put("done", new JSONObject().put("by", me).put("at", now)).put("todo", JSONObject.NULL); rd = true; break;
                    case "todo": P.put("todo", new JSONObject().put("by", me).put("at", now)).put("done", JSONObject.NULL); break;
                    case "unmark": P.put("done", JSONObject.NULL).put("todo", JSONObject.NULL); break;
                    case "minor": P.put("minor", 1); rd = true; break;
                    case "major": P.put("minor", JSONObject.NULL); break;
                    case "spam": P.put("spam", 1).put("minor", JSONObject.NULL); rd = true;
                        { String em = MailApi.addr(r); if (!em.isEmpty() && !"spam".equals(MailApi.tagKind(r)) && !u.tagged.contains(em)) u.tagged.add(em); } break;
                    case "nospam": P.put("spam", 0);
                        { String em = MailApi.addr(r); if (!em.isEmpty() && "spam".equals(MailApi.tagKind(r)) && !u.untagged.contains(em)) u.untagged.add(em); } break;
                    case "notord": P.put("st", "no").put("at", now).put("by", me); MailApi.forceOrd.remove(id); break;
                    case "isord": P.put("st", JSONObject.NULL); MailApi.forceOrd.add(id); break;
                    default:
                        if (act.startsWith("fld:")) { String f = act.substring(4); P.put("fld", f.isEmpty() ? JSONObject.NULL : f).put("minor", JSONObject.NULL); }
                        else continue;
                }
            } catch (Exception ignored) {}
            /* ничего не меняется — не трогать */
            if (!ord && rd != null && rd == !read0.isEmpty()) continue;
            u.rows.add(new String[]{id, read0, ord0});
            try {
                JSONObject x = new JSONObject().put("id", id);
                if (rd != null) { r.put("read", rd ? "1" : ""); x.put("read", rd); }
                if (ord) {
                    java.util.Iterator<String> it = P.keys();
                    while (it.hasNext()) { String k = it.next(); Object v = P.opt(k); if (v == null || v == JSONObject.NULL) o.remove(k); else o.put(k, v); }
                    r.put("order", o.length() == 0 ? "" : o.toString());
                    x.put("order", r.optString("order")).put("patch", P);
                }
                out.add(x);
                if (rd != null && rd) MailNotifier.dismiss(a, id);
            } catch (Exception ignored) {}
        }
        u.n = u.rows.size(); u.text = label(act, u.n);
        after.run();
        if (u.n == 0 || MailApi.demo) return u;
        send(a, out, u, after);
        return u;
    }

    static void send(Activity a, List<JSONObject> out, Undo u, Done after) {
        long t = System.currentTimeMillis(); for (JSONObject x : out) MailApi.pend.put(x.optString("id"), t);
        MainActivity.SAVE.execute(() -> {
            String e = null;
            try { MailApi.setMany(a, out);
                for (String em : u.tagged) MailApi.tag(a, em, "spam");
                for (String em : u.untagged) MailApi.tag(a, em, "");
                MailApi.saveCache(a);
            } catch (Exception x) { e = x.getMessage(); }
            for (JSONObject x : out) { Long p = MailApi.pend.get(x.optString("id")); if (p != null && p == t) MailApi.pend.remove(x.optString("id")); }
            final String err = e;
            if (err != null) a.runOnUiThread(() -> {
                back(u); after.run();
                Toast.makeText(a, "Не сохранилось: " + err, Toast.LENGTH_LONG).show();
            });
            else if (!u.tagged.isEmpty() || !u.untagged.isEmpty()) a.runOnUiThread(after::run);
        });
    }

    /** вернуть письма как было (на экране) */
    static void back(Undo u) {
        for (String[] s : u.rows) { JSONObject r = MailApi.find(s[0]); if (r == null) continue; try { r.put("read", s[1]); r.put("order", s[2]); } catch (Exception ignored) {} }
    }

    /** «Отменить»: вернуть отметки и в таблице (целиком, как было) */
    static void undo(Activity a, Undo u, Done after) {
        if (u == null || u.n == 0) return;
        back(u); after.run(); if (MailApi.demo) return;
        List<JSONObject> out = new ArrayList<>();
        for (String[] s : u.rows) { try { out.add(new JSONObject().put("id", s[0]).put("read", !s[1].isEmpty()).put("order", s[2])); } catch (Exception ignored) {} }
        Undo rev = new Undo(); rev.tagged.addAll(u.untagged); rev.untagged.addAll(u.tagged);
        send(a, out, rev, after);
    }

    /* ---------- одно письмо (из экрана письма и меню) ---------- */
    static Undo one(Activity a, JSONObject r, String act, Done after) { return apply(a, Collections.singletonList(r), act, after); }
    static void read(Activity a, JSONObject r, boolean on, Done after) { one(a, r, on ? "read" : "unread", after); }
}
