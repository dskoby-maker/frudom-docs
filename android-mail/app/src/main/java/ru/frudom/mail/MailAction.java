package ru.frudom.mail;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

/** Кнопки в уведомлении: «Прочитано» (отметить в таблице и убрать) и смахивание уведомления. */
public class MailAction extends BroadcastReceiver {
    static final String READ = "ru.frudom.mail.READ", DISMISS = "ru.frudom.mail.DISMISS";

    static PendingIntent pi(Context c, String act, String id, int req) {
        Intent i = new Intent(c, MailAction.class).setAction(act).putExtra("id", id);
        return PendingIntent.getBroadcast(c, req + (READ.equals(act) ? 3 : 7), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override public void onReceive(Context c, Intent i) {
        final String id = i.getStringExtra("id"); if (id == null) return;
        final Context app = c.getApplicationContext();
        if (DISMISS.equals(i.getAction())) { MailNotifier.dismiss(app, id); return; }
        if (!READ.equals(i.getAction())) return;
        MailNotifier.dismiss(app, id);
        final PendingResult pr = goAsync();
        new Thread(() -> {
            boolean ok = MailNotifier.markRead(app, id);
            if (!ok) new android.os.Handler(android.os.Looper.getMainLooper()).post(() ->
                Toast.makeText(app, "Не получилось отметить письмо прочитанным — нет связи. Откройте его в «Почте ФД».", Toast.LENGTH_LONG).show());
            pr.finish();
        }, "frudom-mail-read").start();
    }
}
