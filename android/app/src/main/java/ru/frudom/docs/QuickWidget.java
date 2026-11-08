package ru.frudom.docs;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Виджет на рабочем столе. Верхний ряд — «Расход», «Доход», «Личное» (сразу окно новой записи на сайте).
 *  Нижний ряд (виджет 4×2) — сводка из таблицы: Даниилу — «Ждём оплату», «Долг > 30 дн», «Сегодня»; остальным — сегодня/завтра/задачи.
 *  Цифры приносит Notifier.widgetSync (раз в час вместе с уведомлениями, при добавлении виджета и по «↻»). */
public class QuickWidget extends AppWidgetProvider {
    static final String REFRESH = "ru.frudom.docs.WIDGET_REFRESH";
    static final int[] L = {R.id.w_l1, R.id.w_l2, R.id.w_l3}, V = {R.id.w_v1, R.id.w_v2, R.id.w_v3}, S = {R.id.w_s1, R.id.w_s2, R.id.w_s3};

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(c, m, id);
        Notifier.schedule(c, false);
        Notifier.widgetSoon(c);
    }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { render(c, m, id); }
    @Override public void onReceive(Context c, Intent i) {
        if (REFRESH.equals(i.getAction())) {
            prefs(c).edit().putString("wMsg", "Обновляю…").apply(); renderAll(c);
            Notifier.widgetSoon(c); return;
        }
        super.onReceive(c, i);
    }

    static SharedPreferences prefs(Context c) { return Notifier.prefs(c); }
    static int[] ids(Context c) {
        try { return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, QuickWidget.class)); } catch (Exception e) { return new int[0]; }
    }
    static boolean has(Context c) { return ids(c).length > 0; }
    static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : ids(c)) try { render(c, m, id); } catch (Exception ignored) {}
    }

    static void render(Context c, AppWidgetManager m, int id) {
        Bundle o = m.getAppWidgetOptions(id);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        boolean full = h == 0 || h >= 96;                  // в один ряд — только кнопки
        RemoteViews v = new RemoteViews(c.getPackageName(), full ? R.layout.widget_full : R.layout.widget_quick);
        v.setOnClickPendingIntent(R.id.w_exp, quick(c, "exp", 1));
        v.setOnClickPendingIntent(R.id.w_inc, quick(c, "inc", 2));
        v.setOnClickPendingIntent(R.id.w_per, quick(c, "per", 3));
        if (full) fill(c, v);
        m.updateAppWidget(id, v);
    }

    /** как выглядит виджет 4×2 — для экрана «Уведомления» */
    static RemoteViews preview(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_full);
        fill(c, v); return v;
    }

    static void fill(Context c, RemoteViews v) {
        SharedPreferences s = prefs(c);
        String go = "profit", msg = s.getString("wMsg", "");
        try {
            JSONObject sum = new JSONObject(s.getString("wSum", "{}"));
            JSONArray cells = sum.optJSONArray("cells");
            go = sum.optString("go", go);
            for (int i = 0; i < 3; i++) {
                JSONObject x = cells != null ? cells.optJSONObject(i) : null;
                v.setTextViewText(L[i], x == null ? "—" : x.optString("l"));
                v.setTextViewText(V[i], x == null ? "—" : x.optString("v"));
                v.setTextViewText(S[i], x == null ? "" : x.optString("s"));
                v.setTextColor(V[i], c.getResources().getColor(x != null && x.optInt("w") == 1 ? R.color.w_warn : R.color.w_fg, c.getTheme()));
            }
        } catch (Exception ignored) {}
        if (msg.isEmpty()) msg = Notifier.hasAccount(c) ? "Загружаю…" : "Войдите в приложении, чтобы видеть сводку";
        v.setTextViewText(R.id.w_upd, msg);
        Intent open = new Intent(c, MainActivity.class).setAction("ru.frudom.docs.GO.widget")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("go", go);
        v.setOnClickPendingIntent(R.id.w_info, PendingIntent.getActivity(c, 110, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent ref = new Intent(c, QuickWidget.class).setAction(REFRESH);
        v.setOnClickPendingIntent(R.id.w_ref, PendingIntent.getBroadcast(c, 111, ref, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    static PendingIntent quick(Context c, String k, int code) {
        Intent i = new Intent(c, MainActivity.class).setAction("ru.frudom.docs.QUICK_" + k)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("quick", k);
        return PendingIntent.getActivity(c, 100 + code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
