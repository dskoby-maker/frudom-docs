package ru.frudom.docs;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Виджет на рабочем столе: «Расход», «Доход», «Личное» — сразу открывают окно новой записи на сайте. */
public class QuickWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_quick);
            v.setOnClickPendingIntent(R.id.w_exp, quick(c, "exp", 1));
            v.setOnClickPendingIntent(R.id.w_inc, quick(c, "inc", 2));
            v.setOnClickPendingIntent(R.id.w_per, quick(c, "per", 3));
            m.updateAppWidget(id, v);
        }
    }
    static PendingIntent quick(Context c, String k, int code) {
        Intent i = new Intent(c, MainActivity.class).setAction("ru.frudom.docs.QUICK_" + k)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("quick", k);
        return PendingIntent.getActivity(c, 100 + code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
