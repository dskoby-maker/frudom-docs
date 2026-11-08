package ru.frudom.docs;

import android.Manifest;
import android.app.Activity;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;

/** Экран «Уведомления»: что присылать, как часто, тихие часы, время утренней сводки, проверка. */
public class NotifySettingsActivity extends Activity {
    static final int PLUM = 0xFF5B2A48, INK = 0xFF1F1D1A, MUTED = 0xFF6F6A63, CARD = 0xFFFFFFFF;
    SharedPreferences s;
    LinearLayout root;
    TextView status;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        s = Notifier.prefs(this);
        Notifier.channels(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        build();
    }

    @Override protected void onResume() { super.onResume(); if (root != null) build(); }
    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) { build(); }

    int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    void build() {
        ScrollView sv = new ScrollView(this); sv.setBackgroundColor(0xFFF4F2EE); sv.setFillViewport(true);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(16), dp(20), dp(16), dp(32));
        sv.addView(root);

        TextView h = text("Уведомления", 24, INK, true); root.addView(h);
        String user = s.getString("user", "");
        root.addView(text(user.isEmpty() ? "Сначала войдите на сайте в приложении — тогда телефон начнёт проверять новое."
            : "Телефон сам проверяет таблицу и присылает новое, даже когда приложение закрыто. Вход: " + user + ".", 14, MUTED, false));

        status = text(statusText(), 14, INK, false);
        LinearLayout st = card(); st.addView(status); root.addView(st);

        /* виджет: как выглядит и как растянуть на 2 ряда */
        if (getIntent() != null && getIntent().getBooleanExtra("wdemo", false) && s.getString("wSum", "").isEmpty())
            s.edit().putString("wSum", "{\"cells\":[{\"l\":\"Ждём оплату\",\"v\":\"412 тыс ₽\",\"s\":\"23 накл.\"},{\"l\":\"Долг > 30 дн\",\"v\":\"86 тыс ₽\",\"s\":\"4 накл.\",\"w\":1},{\"l\":\"Сегодня\",\"v\":\"6 накл.\",\"s\":\"58 тыс ₽\"}],\"go\":\"profit\"}")
                .putString("wMsg", "Обновлено в 21:58").apply();
        root.addView(section("Виджет на рабочем столе"));
        LinearLayout wc = card();
        wc.addView(text("Сверху — быстрые кнопки, снизу — сводка. Чтобы видеть сводку, растяните виджет на 2 ряда: долгое нажатие на виджет → потяните за нижний край. Цифры обновляются раз в час и по «↻».", 13, MUTED, false));
        try {
            View pv = QuickWidget.preview(this).apply(this, wc);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(168)); lp.topMargin = dp(10);
            wc.addView(pv, lp);
        } catch (Exception ignored) {}
        if (QuickWidget.has(this)) wc.addView(button("Обновить цифры сейчас", false, v -> new Thread(() -> { Notifier.widgetSync(this); runOnUiThread(this::build); }).start()));
        root.addView(wc);

        if (!Notifier.canNotify(this)) {
            LinearLayout w = card(); w.addView(text("Android сейчас не разрешает приложению показывать уведомления.", 15, 0xFFB3473C, true));
            w.addView(button("Разрешить уведомления", true, v -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED && !s.getBoolean("askedPerm", false)) {
                    s.edit().putBoolean("askedPerm", true).apply(); requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
                } else startActivity(Notifier.appSettings(this));
            }));
            root.addView(w);
        }

        LinearLayout main = card();
        main.addView(sw("Присылать уведомления", "Общий выключатель", s.getBoolean("enabled", true), on -> { s.edit().putBoolean("enabled", on).apply(); Notifier.schedule(this, true); build(); }));
        root.addView(main);

        boolean en = s.getBoolean("enabled", true);
        root.addView(section("О чём"));
        LinearLayout kinds = card();
        for (String[] k : Notifier.KINDS) {
            if ((k[0].equals("bank") || k[0].equals("debt")) && !s.getBoolean("admin", true)) continue;   // деньги видит только Даниил
            kinds.addView(sw(k[1], k[2], s.getBoolean("on_" + k[0], true), on -> s.edit().putBoolean("on_" + k[0], on).apply()));
        }
        setEnabled(kinds, en); root.addView(kinds);

        root.addView(section("Как часто проверять"));
        LinearLayout per = card();
        RadioGroup rg = new RadioGroup(this);
        long cur = s.getLong("period", 60);
        for (int i = 0; i < Notifier.PERIODS.length; i++) {
            RadioButton r = new RadioButton(this); r.setText(Notifier.PERIOD_NAMES[i] + (Notifier.PERIODS[i] == 60 ? " (советую)" : "")); r.setTextSize(16); r.setTextColor(INK);
            r.setId(1000 + i); r.setPadding(dp(4), dp(8), 0, dp(8)); rg.addView(r); if (Notifier.PERIODS[i] == cur) r.setChecked(true);
        }
        rg.setOnCheckedChangeListener((g, id) -> { s.edit().putLong("period", Notifier.PERIODS[id - 1000]).apply(); Notifier.schedule(this, true); });
        per.addView(rg);
        per.addView(text("Android может сдвигать проверку на несколько минут, чтобы беречь батарею.", 13, MUTED, false));
        setEnabled(per, en); root.addView(per);

        root.addView(section("Когда"));
        LinearLayout when = card();
        int qf = s.getInt("qFrom", 22 * 60), qt = s.getInt("qTo", 8 * 60), mo = s.getInt("morning", 9 * 60);
        when.addView(sw("Не беспокоить ночью", "С " + Notifier.hm(qf) + " до " + Notifier.hm(qt) + " — всё новое придёт утром", s.getBoolean("quiet", true), on -> { s.edit().putBoolean("quiet", on).apply(); build(); }));
        LinearLayout row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
        row.addView(button("С " + Notifier.hm(qf), false, v -> time(qf, m -> s.edit().putInt("qFrom", m).apply())), new LinearLayout.LayoutParams(0, -2, 1));
        row.addView(button("До " + Notifier.hm(qt), false, v -> time(qt, m -> s.edit().putInt("qTo", m).apply())), new LinearLayout.LayoutParams(0, -2, 1));
        if (s.getBoolean("quiet", true)) when.addView(row);
        when.addView(text("Утренняя сводка (долги и задачи на сегодня) — не раньше " + Notifier.hm(mo), 15, INK, false));
        when.addView(button("Изменить время сводки: " + Notifier.hm(mo), false, v -> time(mo, m -> s.edit().putInt("morning", m).apply())));
        when.addView(text("Сводка по долгам:", 15, INK, false));
        RadioGroup dg = new RadioGroup(this);
        RadioButton d1 = new RadioButton(this); d1.setText("каждый день"); d1.setTextSize(16); d1.setId(2001); dg.addView(d1);
        RadioButton d2 = new RadioButton(this); d2.setText("только по понедельникам"); d2.setTextSize(16); d2.setId(2002); dg.addView(d2);
        (("mon".equals(s.getString("debtWhen", "day"))) ? d2 : d1).setChecked(true);
        dg.setOnCheckedChangeListener((g, id) -> s.edit().putString("debtWhen", id == 2002 ? "mon" : "day").apply());
        when.addView(dg);
        setEnabled(when, en); root.addView(when);

        root.addView(section("Проверка и звук"));
        LinearLayout act = card();
        act.addView(button("Проверить сейчас", true, v -> {
            status.setText("Проверяю…");
            new Thread(() -> { String r = Notifier.check(getApplicationContext(), true); runOnUiThread(() -> status.setText(statusText())); }).start();
        }));
        act.addView(text("Покажет всё, что есть сейчас, даже в тихие часы.", 13, MUTED, false));
        act.addView(button("Звук и вид уведомлений", false, v -> startActivity(Notifier.appSettings(this))));
        act.addView(text("Для каждого вида можно выбрать свой звук или сделать его беззвучным — это настройки Android.", 13, MUTED, false));
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
            act.addView(button("Разрешить проверять в фоне", false, v -> {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                catch (Exception e) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            }));
            act.addView(text("Некоторые телефоны (Xiaomi, Huawei, Samsung) усыпляют приложения. Если уведомления приходят с опозданием — нажмите и выберите «Разрешить».", 13, MUTED, false));
        }
        root.addView(act);

        root.addView(section("Виджет на рабочем столе"));
        LinearLayout wg = card();
        wg.addView(text("Кнопки «Расход», «Доход», «Личное» сразу открывают окно новой записи.\nКак добавить: долгое нажатие на пустое место рабочего стола → «Виджеты» → «Документы ФД» → перетащить на экран.\nТе же кнопки — при долгом нажатии на значок приложения.", 14, INK, false));
        root.addView(wg);

        setContentView(sv);
    }

    String statusText() {
        String at = s.getString("lastAt", ""), msg = s.getString("lastMsg", "");
        if (at.isEmpty()) return "Проверок ещё не было. Нажмите «Проверить сейчас» внизу.";
        return "Последняя проверка " + at + ": " + msg;
    }

    interface OnBool { void on(boolean v); }
    interface OnMin { void on(int m); }

    void time(int cur, OnMin cb) {
        new TimePickerDialog(this, (tp, hh, mm) -> { cb.on(hh * 60 + mm); build(); }, cur / 60, cur % 60, true).show();
    }

    TextView text(String t, int size, int color, boolean bold) {
        TextView v = new TextView(this); v.setText(t); v.setTextSize(size); v.setTextColor(color); v.setLineSpacing(0, 1.15f);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD); v.setPadding(0, dp(4), 0, dp(4)); return v;
    }

    TextView section(String t) { TextView v = text(t, 13, MUTED, true); v.setAllCaps(true); v.setPadding(dp(4), dp(18), 0, dp(6)); return v; }

    LinearLayout card() {
        LinearLayout c = new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setPadding(dp(14), dp(10), dp(14), dp(10));
        GradientDrawable g = new GradientDrawable(); g.setColor(CARD); g.setCornerRadius(dp(14)); g.setStroke(1, 0x1A000000); c.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.topMargin = dp(8); c.setLayoutParams(lp); return c;
    }

    View sw(String title, String sub, boolean val, OnBool cb) {
        LinearLayout r = new LinearLayout(this); r.setOrientation(LinearLayout.HORIZONTAL); r.setGravity(Gravity.CENTER_VERTICAL); r.setPadding(0, dp(6), 0, dp(6));
        LinearLayout t = new LinearLayout(this); t.setOrientation(LinearLayout.VERTICAL);
        t.addView(text(title, 16, INK, true)); if (sub != null && !sub.isEmpty()) t.addView(text(sub, 13, MUTED, false));
        r.addView(t, new LinearLayout.LayoutParams(0, -2, 1));
        Switch w = new Switch(this); w.setChecked(val); w.setOnCheckedChangeListener((x, on) -> cb.on(on)); r.addView(w);
        r.setOnClickListener(v -> w.toggle());
        return r;
    }

    Button button(String t, boolean main, View.OnClickListener l) {
        Button b = new Button(this); b.setText(t); b.setAllCaps(false); b.setTextSize(15); b.setOnClickListener(l);
        GradientDrawable g = new GradientDrawable(); g.setCornerRadius(dp(12));
        if (main) { g.setColor(PLUM); b.setTextColor(0xFFFFFFFF); } else { g.setColor(0xFFF1ECEF); b.setTextColor(PLUM); }
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(48)); lp.topMargin = dp(6); lp.bottomMargin = dp(2); lp.leftMargin = dp(2); lp.rightMargin = dp(2); b.setLayoutParams(lp);
        return b;
    }

    void setEnabled(View v, boolean en) {
        v.setAlpha(en ? 1f : 0.45f); v.setEnabled(en);
        if (v instanceof android.view.ViewGroup) { android.view.ViewGroup g = (android.view.ViewGroup) v; for (int i = 0; i < g.getChildCount(); i++) setEnabled(g.getChildAt(i), en); }
        if (v instanceof LinearLayout) v.setAlpha(1f);
    }
}
