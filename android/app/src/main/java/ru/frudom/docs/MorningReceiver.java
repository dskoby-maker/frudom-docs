package ru.frudom.docs;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Утренний будильник (Notifier.alarm) и перезагрузка телефона: присылает сводку задач и ставит будильник на следующий день. */
public class MorningReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        final Context app = c.getApplicationContext();
        String a = i == null ? "" : String.valueOf(i.getAction());
        if (!"ru.frudom.docs.MORNING".equals(a)) { Notifier.alarm(app); Notifier.schedule(app, false); return; }   // перезагрузка, смена времени
        final PendingResult pr = goAsync();
        new Thread(() -> { try { Notifier.morning(app); } catch (Throwable ignored) {} finally { pr.finish(); } }, "frudom-morning").start();
    }
}
