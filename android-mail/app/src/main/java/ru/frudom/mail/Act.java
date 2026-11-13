package ru.frudom.mail;

import android.app.Activity;
import android.widget.Toast;

import org.json.JSONObject;

/** Отметки письма из настоящих экранов — так же, как на сайте (mail_seg.js: mlOrdPatch, mlSpam, mlMark):
 *  сразу на экране, потом в таблицу; не получилось — вернуть как было и сказать. */
final class Act {
    private Act() {}

    interface Done { void run(); }

    static void save(Activity a, JSONObject r, String before, String beforeOrder, Done after, String ok) {
        after.run();
        if (MailApi.demo) return;
        MainActivity.IO.execute(() -> {
            String e = null;
            try { MailApi.set(a, r); } catch (Exception x) { e = x.getMessage(); }
            final String err = e;
            a.runOnUiThread(() -> {
                if (err != null) {
                    try { r.put("read", before); r.put("order", beforeOrder); } catch (Exception ignored) {}
                    after.run(); Toast.makeText(a, "Не сохранилось: " + err, Toast.LENGTH_LONG).show();
                } else if (ok != null) Toast.makeText(a, ok, Toast.LENGTH_SHORT).show();
            });
        });
    }

    static void read(Activity a, JSONObject r, boolean on, Done after) {
        String b = r.optString("read"), bo = r.optString("order");
        try { r.put("read", on ? "1" : ""); } catch (Exception ignored) {}
        if (on) MailNotifier.dismiss(a, r.optString("id"));
        save(a, r, b, bo, after, null);
    }

    static void done(Activity a, JSONObject r, boolean on, Done after) {
        String b = r.optString("read"), bo = r.optString("order");
        try {
            MailApi.ordPatch(r, "done", on ? new JSONObject().put("by", MailApi.user(a)).put("at", MailApi.nowIso()) : null);
            MailApi.ordPatch(r, "todo", null);
            if (on) r.put("read", "1");
        } catch (Exception ignored) {}
        if (on) MailNotifier.dismiss(a, r.optString("id"));
        save(a, r, b, bo, after, on ? "Обработано" : "Пометка снята");
    }

    static void minor(Activity a, JSONObject r, boolean on, Done after) {
        String b = r.optString("read"), bo = r.optString("order");
        MailApi.ordPatch(r, "minor", on ? 1 : null);
        if (on) { try { r.put("read", "1"); } catch (Exception ignored) {} MailNotifier.dismiss(a, r.optString("id")); }
        save(a, r, b, bo, after, on ? "В «Неважных»" : "Во «Входящих»");
    }

    /** спам: письмо и отправитель (все его письма — в «Спам», как на сайте); «Не спам» снимает и отметку отправителя */
    static void spam(Activity a, JSONObject r, boolean on, Done after) {
        String b = r.optString("read"), bo = r.optString("order"), em = MailApi.addr(r);
        MailApi.ordPatch(r, "spam", on ? 1 : 0); if (on) MailApi.ordPatch(r, "minor", null);
        if (on) { try { r.put("read", "1"); } catch (Exception ignored) {} MailNotifier.dismiss(a, r.optString("id")); }
        save(a, r, b, bo, after, on ? "Отправитель — в «Спам»" : "Не спам");
        if (!em.isEmpty()) MainActivity.IO.execute(() -> {
            try { MailApi.tag(a, em, on ? "spam" : ""); a.runOnUiThread(after::run); } catch (Exception ignored) {}
        });
    }
}
