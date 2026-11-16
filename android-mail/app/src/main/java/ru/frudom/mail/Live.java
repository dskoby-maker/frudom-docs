package ru.frudom.mail;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.util.ArrayList;
import java.util.List;

/** Живое обновление: пока приложение открыто, раз в 15 секунд из таблицы забираются только изменённые письма —
 *  Наталья отметила «Обработано», письмо прочитали на сайте, пришло новое письмо. Открытые экраны перерисовываются сами. */
final class Live {
    private Live() {}
    interface L { void changed(); }

    static final long EVERY = 15_000;
    static final Handler H = new Handler(Looper.getMainLooper());
    static final List<L> subs = new ArrayList<>();
    static Context app;
    static boolean busy, running;
    static long lastOk;

    static void on(Context c, L l) {
        app = c.getApplicationContext();
        if (!subs.contains(l)) subs.add(l);
        if (!running) { running = true; H.removeCallbacks(TICK); H.postDelayed(TICK, 1500); }
    }
    static void off(L l) {
        subs.remove(l);
        if (subs.isEmpty()) { running = false; H.removeCallbacks(TICK); }
    }
    /** сразу проверить (после своей отметки, возврата в приложение) */
    static void now() { if (running) { H.removeCallbacks(TICK); H.postDelayed(TICK, 400); } }

    static final Runnable TICK = new Runnable() {
        @Override public void run() {
            if (!running) return;
            if (busy || MailApi.demo || app == null || !MailNotifier.hasAccount(app)) { H.postDelayed(this, EVERY); return; }
            busy = true;
            MainActivity.IO.execute(() -> {
                boolean ch = false;
                try { ch = MailApi.changes(app); lastOk = System.currentTimeMillis(); } catch (Exception ignored) {}
                final boolean c = ch;
                H.post(() -> {
                    busy = false;
                    if (c) for (L l : new ArrayList<>(subs)) { try { l.changed(); } catch (Exception ignored) {} }
                    if (running) { H.removeCallbacks(TICK); H.postDelayed(TICK, EVERY); }
                });
            });
        }
    };
}
