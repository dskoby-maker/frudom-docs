package ru.frudom.mail;

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

import org.json.JSONArray;
import org.json.JSONObject;

/** Экран «Уведомления о письмах»: включить, какие письма (все / только заявки, по ящикам), как часто, тихие часы, проверка. */
public class MailSettingsActivity extends Activity {
    static final int BRAND = 0xFF1E4A5C, INK = 0xFF1F1D1A, MUTED = 0xFF6F6A63, CARD = 0xFFFFFFFF;
    SharedPreferences s;
    LinearLayout root;
    TextView status;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        s = MailNotifier.prefs(this);
        MailNotifier.channels(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED && !s.getBoolean("askedPerm", false)) {
            s.edit().putBoolean("askedPerm", true).apply(); requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        }
        build();
        /* проверка на эмуляторе: --ez ndemo true — показать два примера уведомлений (письмо и заявку) */
        if (getIntent() != null && getIntent().getBooleanExtra("ndemo", false)) {
            try {
                MailNotifier.show(this, new org.json.JSONObject().put("id", "demo:1").put("title", "Цирк бухгалтерия").put("text", "Акт сверки за октябрь")
                    .put("snip", "Добрый день! Пришлите, пожалуйста, акт сверки за октябрь, подписанный с вашей стороны.").put("box", "info@frudom.ru").put("atts", "акт.xlsx"), false);
                MailNotifier.show(this, new org.json.JSONObject().put("id", "demo:2").put("title", "МГУ Комбинат питания").put("text", "Заявка на 14.11")
                    .put("snip", "Прошу поставить: помидоры 10 кг, огурцы 5 кг, укроп 1 кг").put("box", "frudom.ru@mail.ru"), true);
                MailNotifier.summary(this);
            } catch (Exception ignored) {}
        }
    }

    @Override protected void onResume() { super.onResume(); if (root != null) build(); }
    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) { build(); }

    int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    void build() {
        ScrollView sv = new ScrollView(this); sv.setBackgroundColor(0xFFF4F2EE); sv.setFillViewport(true);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(16), dp(20), dp(16), dp(32));
        sv.addView(root);

        root.addView(text("Уведомления о письмах", 24, INK, true));
        String user = s.getString("user", "");
        root.addView(text(user.isEmpty() ? "Сначала войдите в «Почте ФД» — тогда телефон начнёт сам проверять новые письма."
            : "Телефон сам проверяет ящики frudom.ru@mail.ru и info@frudom.ru и присылает каждое новое письмо, даже когда приложение закрыто. Вход: " + user + ".", 14, MUTED, false));

        status = text(statusText(), 14, INK, false);
        LinearLayout st = card(); st.addView(status); root.addView(st);

        if (!MailNotifier.canNotify(this)) {
            LinearLayout w = card(); w.addView(text("Android сейчас не разрешает «Почте ФД» показывать уведомления.", 15, 0xFFB3473C, true));
            w.addView(button("Разрешить уведомления", true, v -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED && !s.getBoolean("askedPerm2", false)) {
                    s.edit().putBoolean("askedPerm2", true).apply(); requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
                } else startActivity(MailNotifier.appSettings(this));
            }));
            root.addView(w);
        }

        LinearLayout main = card();
        main.addView(sw("Присылать уведомления о письмах", "Общий выключатель", MailNotifier.enabled(this), on -> { s.edit().putBoolean("enabled", on).apply(); MailNotifier.schedule(this, true); if (!on) MailNotifier.clearAll(this); build(); }));
        root.addView(main);
        boolean en = MailNotifier.enabled(this);

        root.addView(section("Какие письма"));
        LinearLayout which = card();
        RadioGroup wg = new RadioGroup(this);
        RadioButton w1 = radio("Все новые письма", 3001), w2 = radio("Только заявки (заявка, заказ, поставка)", 3002);
        wg.addView(w1); wg.addView(w2); (s.getBoolean("onlyOrd", false) ? w2 : w1).setChecked(true);
        wg.setOnCheckedChangeListener((g, id) -> s.edit().putBoolean("onlyOrd", id == 3002).apply());
        which.addView(wg);
        which.addView(text("Спам и «Неважные» не присылаются никогда. Прочитали письмо (здесь, на сайте или на компьютере) — уведомление пропадёт само.", 13, MUTED, false));
        JSONArray boxes = null; try { boxes = new JSONArray(s.getString("boxes", "[]")); } catch (Exception ignored) {}
        if (boxes != null && boxes.length() > 1) {
            which.addView(text("Из каких ящиков:", 15, INK, true));
            for (int i = 0; i < boxes.length(); i++) {
                JSONObject bx = boxes.optJSONObject(i); if (bx == null) continue; final String id = bx.optString("id");
                which.addView(sw(bx.optString("email"), bx.optString("err").isEmpty() ? null : "Ящик сейчас не отвечает: " + bx.optString("err"), s.getBoolean("box_" + id, true), on -> s.edit().putBoolean("box_" + id, on).apply()));
            }
        }
        setEnabled(which, en); root.addView(which);

        root.addView(section("Как часто проверять"));
        LinearLayout per = card();
        RadioGroup rg = new RadioGroup(this);
        long cur = MailNotifier.periodMin(this);
        for (int i = 0; i < MailNotifier.PERIODS.length; i++) {
            RadioButton r = radio(MailNotifier.PERIOD_NAMES[i] + (MailNotifier.PERIODS[i] == 15 ? " (советую)" : ""), 1000 + i);
            rg.addView(r); if (MailNotifier.PERIODS[i] == cur) r.setChecked(true);
        }
        rg.setOnCheckedChangeListener((g, id) -> { s.edit().putLong("period", MailNotifier.PERIODS[id - 1000]).apply(); MailNotifier.schedule(this, true); });
        per.addView(rg);
        per.addView(text("15 минут — чаще Android не разрешает проверять в фоне. Иногда он сдвигает проверку на несколько минут, чтобы беречь батарею. Открытая «Почта ФД» проверяет ящики сама, без ожидания.", 13, MUTED, false));
        setEnabled(per, en); root.addView(per);

        root.addView(section("Не беспокоить"));
        LinearLayout when = card();
        int qf = s.getInt("qFrom", 22 * 60), qt = s.getInt("qTo", 8 * 60);
        boolean q = s.getBoolean("quiet", false);
        when.addView(sw("Тихие часы", q ? "С " + MailNotifier.hm(qf) + " до " + MailNotifier.hm(qt) + " — письма придут после" : "Выключено: письма приходят в любое время", q, on -> { s.edit().putBoolean("quiet", on).apply(); build(); }));
        if (q) {
            LinearLayout row = new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
            row.addView(button("С " + MailNotifier.hm(qf), false, v -> time(qf, m -> s.edit().putInt("qFrom", m).apply())), new LinearLayout.LayoutParams(0, -2, 1));
            row.addView(button("До " + MailNotifier.hm(qt), false, v -> time(qt, m -> s.edit().putInt("qTo", m).apply())), new LinearLayout.LayoutParams(0, -2, 1));
            when.addView(row);
        }
        setEnabled(when, en); root.addView(when);

        root.addView(section("Проверка и звук"));
        LinearLayout act = card();
        act.addView(button("Проверить почту сейчас", true, v -> {
            status.setText("Проверяю ящики… (до минуты)");
            new Thread(() -> { MailNotifier.check(getApplicationContext(), true); runOnUiThread(() -> status.setText(statusText())); }).start();
        }));
        act.addView(button("Звук и вид уведомлений", false, v -> startActivity(MailNotifier.appSettings(this))));
        act.addView(text("Отдельно для «Новые письма» и «Заявки в письмах» можно выбрать свой звук, вибрацию или сделать беззвучными — это настройки Android.", 13, MUTED, false));
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
            act.addView(button("Разрешить проверять в фоне", false, v -> {
                try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
                catch (Exception e) { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            }));
            act.addView(text("Некоторые телефоны (Xiaomi, Huawei, Samsung) усыпляют приложения, и письма приходят с опозданием. Нажмите и выберите «Разрешить».", 13, MUTED, false));
        }
        root.addView(act);

        setContentView(sv);
    }

    String statusText() {
        String at = s.getString("lastAt", ""), msg = s.getString("lastMsg", "");
        if (at.isEmpty()) return "Проверок ещё не было. Нажмите «Проверить почту сейчас».";
        int un = s.getInt("unread", 0);
        return "Последняя проверка " + at + ": " + msg + (un > 0 && !s.getBoolean("staff", false) ? "\nНе прочитано во «Входящих»: " + un : "");
    }

    interface OnBool { void on(boolean v); }
    interface OnMin { void on(int m); }

    void time(int cur, OnMin cb) { new TimePickerDialog(this, (tp, hh, mm) -> { cb.on(hh * 60 + mm); build(); }, cur / 60, cur % 60, true).show(); }

    RadioButton radio(String t, int id) { RadioButton r = new RadioButton(this); r.setText(t); r.setTextSize(16); r.setTextColor(INK); r.setId(id); r.setPadding(dp(4), dp(8), 0, dp(8)); return r; }

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
        if (main) { g.setColor(BRAND); b.setTextColor(0xFFFFFFFF); } else { g.setColor(0xFFE8EFF1); b.setTextColor(BRAND); }
        b.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(48)); lp.topMargin = dp(6); lp.bottomMargin = dp(2); lp.leftMargin = dp(2); lp.rightMargin = dp(2); b.setLayoutParams(lp);
        return b;
    }

    void setEnabled(View v, boolean en) {
        v.setEnabled(en);
        if (v instanceof android.view.ViewGroup) { android.view.ViewGroup g = (android.view.ViewGroup) v; for (int i = 0; i < g.getChildCount(); i++) setEnabled(g.getChildAt(i), en); }
        if (v instanceof LinearLayout && v.getBackground() != null) v.setAlpha(en ? 1f : 0.5f);
    }
}
