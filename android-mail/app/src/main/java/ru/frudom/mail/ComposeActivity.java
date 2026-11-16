package ru.frudom.mail;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.MultiAutoCompleteTextView;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** «Почта ФД» — новое письмо, ответ, ответ всем, пересылка. Как на сайте (mail_seg.js: mlCompose, mlSend):
 *  с какого ящика, кому (подсказки по прошлым письмам), копия, тема, текст с цитатой, свои файлы и вложения пересылаемого письма,
 *  вместе не больше 2,3 МБ. Набранное не пропадает: черновик хранится на телефоне, пока письмо не ушло. */
public class ComposeActivity extends Activity {
    static final long MAX = 2_300_000;
    String kind, id, acc = "", reply = "", inReply = "", refs = "", fwdFrom = "";
    JSONObject r;
    MultiAutoCompleteTextView to, cc;
    EditText subj, text;
    TextView accBtn, sendBtn, sizeInfo;
    LinearLayout files;
    final List<String[]> mine = new ArrayList<>();          // {имя, mime, base64}
    final List<Object[]> fwd = new ArrayList<>();            // {номер вложения, имя, размер, вкл}
    boolean busy, sent;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 23) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        if (MailApi.rows.length() == 0) MailApi.loadCache(this);
        if (!MailApi.demo && !MailNotifier.hasAccount(this)) { startActivity(new Intent(this, WebActivity.class).putExtra("login", true)); finish(); return; }
        if (MailApi.ro(this)) { Toast.makeText(this, "У вас почта только для чтения", Toast.LENGTH_LONG).show(); finish(); return; }
        kind = s(getIntent().getStringExtra("kind"), "new"); id = s(getIntent().getStringExtra("id"), "");
        r = id.isEmpty() || kind.equals("new") ? null : MailApi.find(id);
        if (r == null && !kind.equals("new")) kind = "new";
        acc = r != null ? r.optString("acc") : s(getIntent().getStringExtra("acc"), "");
        if (MailApi.accOf(acc) == null && MailApi.acc.length() > 0) acc = MailApi.acc.optJSONObject(0).optString("id");
        build();
        fill();
    }
    static String s(String v, String d) { return v == null ? d : v; }

    String key() { return "draft:" + kind + ":" + (r == null ? "" : id); }
    SharedPreferences dp() { return getSharedPreferences("drafts", MODE_PRIVATE); }

    void build() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Ui.BG);
        LinearLayout top = new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 12), Ui.dp(this, 4));
        top.addView(Ui.icon(this, R.drawable.ic_close, "Закрыть", v -> onBackPressed()));
        top.addView(Ui.line(this, kind.equals("fwd") ? "Переслать" : kind.equals("new") ? "Новое письмо" : kind.equals("replyall") ? "Ответ всем" : "Ответ", 20, Ui.INK, true, 1), new LinearLayout.LayoutParams(0, -2, 1));
        top.addView(Ui.icon(this, R.drawable.ic_clip, "Прикрепить файл", v -> pick()));
        sendBtn = Ui.button(this, "Отправить", true, v -> send()); top.addView(sendBtn, new LinearLayout.LayoutParams(-2, Ui.dp(this, 42)));
        root.addView(top);

        ScrollView sv = new ScrollView(this); sv.setFillViewport(true);
        LinearLayout f = new LinearLayout(this); f.setOrientation(LinearLayout.VERTICAL); f.setPadding(Ui.dp(this, 14), 0, Ui.dp(this, 14), Ui.dp(this, 30));
        sv.addView(f); root.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 16)));
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 4), Ui.dp(this, 14), Ui.dp(this, 4)); f.addView(card);
        accBtn = Ui.line(this, "", 15, Ui.INK, false, 1); accBtn.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 12)); accBtn.setClickable(true); accBtn.setBackground(Ui.press(this, null));
        accBtn.setOnClickListener(v -> pickAcc());
        card.addView(row("От", accBtn)); card.addView(sep());
        ArrayAdapter<String> ad = new ArrayAdapter<>(this, android.R.layout.simple_dropdown_item_1line, new ArrayList<>(known()));
        to = addr(ad); cc = addr(ad);
        card.addView(row("Кому", to)); card.addView(sep()); card.addView(row("Копия", cc)); card.addView(sep());
        subj = plain(); subj.setHint("Тема"); subj.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); card.addView(row("Тема", subj));

        files = new LinearLayout(this); files.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams flp = new LinearLayout.LayoutParams(-1, -2); flp.topMargin = Ui.dp(this, 8); f.addView(files, flp);
        sizeInfo = Ui.text(this, "", 12, Ui.MUTED, false); f.addView(sizeInfo);

        text = plain(); text.setGravity(Gravity.TOP); text.setMinLines(10); text.setHint("Текст письма");
        text.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        text.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 16))); text.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 14), Ui.dp(this, 12)); text.setLineSpacing(0, 1.2f);
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(-1, -2); tlp.topMargin = Ui.dp(this, 10); f.addView(text, tlp);
        setContentView(root);
        accDraw();
    }

    View sep() { View v = new View(this); v.setBackgroundColor(Ui.LINE); v.setLayoutParams(new LinearLayout.LayoutParams(-1, 1)); return v; }
    LinearLayout row(String label, View v) {
        LinearLayout l = new LinearLayout(this); l.setGravity(Gravity.CENTER_VERTICAL);
        TextView t = Ui.text(this, label, 14, Ui.MUTED, false); l.addView(t, new LinearLayout.LayoutParams(Ui.dp(this, 58), -2));
        l.addView(v, new LinearLayout.LayoutParams(0, -2, 1)); return l;
    }
    EditText plain() { EditText e = new EditText(this); e.setBackground(null); e.setTextSize(16); e.setTextColor(Ui.INK); e.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 12)); return e; }
    MultiAutoCompleteTextView addr(ArrayAdapter<String> ad) {
        MultiAutoCompleteTextView e = new MultiAutoCompleteTextView(this); e.setBackground(null); e.setTextSize(16); e.setTextColor(Ui.INK); e.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 12));
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        e.setAdapter(ad); e.setTokenizer(new MultiAutoCompleteTextView.CommaTokenizer()); e.setThreshold(1); return e;
    }
    /** адреса из прошлых писем — для подсказок */
    Set<String> known() {
        Set<String> s = new LinkedHashSet<>();
        for (int i = 0; i < MailApi.rows.length() && s.size() < 400; i++) { JSONObject x = MailApi.rows.optJSONObject(i); if (x == null || MailApi.sent(x) || x.optString("from").isEmpty() || MailApi.spam(x)) continue;
            s.add(x.optString("fromName").isEmpty() ? x.optString("from") : x.optString("fromName") + " <" + x.optString("from") + ">"); }
        return s;
    }

    void accDraw() { JSONObject a = MailApi.accOf(acc); accBtn.setText(a == null ? "ящики не подключены" : (a.optString("name").isEmpty() ? "" : a.optString("name") + " — ") + a.optString("email") + (MailApi.acc.length() > 1 ? "  ⌄" : "")); }
    void pickAcc() {
        if (MailApi.acc.length() < 2) return;
        String[] L = new String[MailApi.acc.length()]; for (int i = 0; i < L.length; i++) L[i] = MailApi.acc.optJSONObject(i).optString("email");
        new AlertDialog.Builder(this).setTitle("С какого ящика отправить").setItems(L, (d, w) -> { acc = MailApi.acc.optJSONObject(w).optString("id"); accDraw(); }).show();
    }

    /** заполнить: черновик, иначе — как на сайте (Re:, цитата, пересылаемое письмо) */
    void fill() {
        if (r != null && (kind.equals("reply") || kind.equals("replyall"))) {
            reply = r.optString("id"); inReply = r.optString("msgid"); refs = (r.optString("refs") + " " + r.optString("msgid")).trim();
        }
        if (r != null && kind.equals("fwd")) { fwdFrom = r.optString("id"); JSONArray A = MailApi.atts(r); for (int i = 0; i < A.length(); i++) { JSONObject x = A.optJSONObject(i); if (x != null) fwd.add(new Object[]{i, x.optString("n"), x.optLong("s"), true}); } }
        String d = dp().getString(key(), "");
        if (!d.isEmpty()) try {
            JSONObject j = new JSONObject(d); if (!j.optString("acc").isEmpty() && MailApi.accOf(j.optString("acc")) != null) acc = j.optString("acc");
            to.setText(j.optString("to")); cc.setText(j.optString("cc")); subj.setText(j.optString("subject")); text.setText(j.optString("text"));
            JSONArray off = j.optJSONArray("off"); if (off != null) for (Object[] x : fwd) for (int i = 0; i < off.length(); i++) if (off.optInt(i) == (int) x[0]) x[3] = false;
            accDraw(); filesDraw(); Toast.makeText(this, "Черновик восстановлен", Toast.LENGTH_SHORT).show(); focus(); return;
        } catch (Exception ignored) {}
        if (r != null && (kind.equals("reply") || kind.equals("replyall"))) {
            to.setText(r.optString("replyTo").isEmpty() ? r.optString("from") : r.optString("replyTo"));
            String sj = r.optString("subject"); subj.setText(sj.toLowerCase().startsWith("re:") ? sj : "Re: " + sj);
            if (kind.equals("replyall")) {
                Set<String> me = new java.util.HashSet<>(); for (int i = 0; i < MailApi.acc.length(); i++) me.add(MailApi.acc.optJSONObject(i).optString("email").toLowerCase());
                List<String> all = new ArrayList<>();
                for (String x : (r.optString("to") + "," + r.optString("cc")).split(",")) { String t = x.trim(); if (t.isEmpty()) continue; String em = t.contains("<") ? t.replaceAll(".*<([^>]+)>.*", "$1") : t; if (!me.contains(em.toLowerCase().trim())) all.add(t); }
                cc.setText(android.text.TextUtils.join(", ", all));
            }
            quote(false);
        } else if (r != null && kind.equals("fwd")) { subj.setText("Fwd: " + r.optString("subject")); quote(true); }
        filesDraw(); focus();
    }

    void focus() {
        EditText f = kind.equals("new") || kind.equals("fwd") ? (to.getText().length() == 0 ? to : text) : text;
        f.requestFocus(); if (f == text) text.setSelection(0);
        f.postDelayed(() -> { InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE); if (im != null) im.showSoftInput(f, 0); }, 250);
    }

    /** цитата / пересылаемый текст — полный текст письма (уже открытого — сразу, иначе загрузить) */
    void quote(boolean f) {
        JSONObject have = LetterActivity.BODY.get(id);
        String body = have != null && !have.optString("text").trim().isEmpty() ? have.optString("text") : r.optString("snippet");
        text.setText(quoteText(f, body)); text.setSelection(0);
        if (have == null && !MailApi.demo) MainActivity.IO.execute(() -> {
            try { JSONObject j = MailApi.get(this, id); LetterActivity.BODY.put(id, j); String t = j.optString("text");
                if (!t.trim().isEmpty()) runOnUiThread(() -> { if (text.getText().toString().equals(quoteText(f, r.optString("snippet")))) { text.setText(quoteText(f, t)); text.setSelection(0); } });
            } catch (Exception ignored) {}
        });
    }
    String quoteText(boolean f, String body) {
        String when = MailApi.full(MailApi.date(r.optString("date"))), who = r.optString("fromName").isEmpty() ? r.optString("from") : r.optString("fromName");
        if (f) return "\n\n---------- Пересланное письмо ----------\nОт: " + r.optString("fromName") + " <" + r.optString("from") + ">\nДата: " + when + "\nТема: " + r.optString("subject") + "\nКому: " + r.optString("to") + "\n\n" + body;
        StringBuilder q = new StringBuilder(); String[] L = body.split("\n"); for (int i = 0; i < Math.min(60, L.length); i++) q.append("> ").append(L[i]).append('\n');
        JSONObject a = MailApi.accOf(acc); String sign = a == null || a.optString("name").isEmpty() ? "Фруктовый Дом" : a.optString("name");
        return "\n\n" + sign + "\n\n" + when + ", " + who + " <" + r.optString("from") + "> написал(а):\n" + q.toString().replaceAll("\n$", "");
    }

    /* ---------- вложения ---------- */
    void pick() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try { startActivityForResult(i, 7); } catch (Exception e) { Toast.makeText(this, "Не получилось открыть выбор файла", Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onActivityResult(int req, int res, Intent d) {
        super.onActivityResult(req, res, d);
        if (req != 7 || res != RESULT_OK || d == null) return;
        List<Uri> L = new ArrayList<>();
        if (d.getClipData() != null) for (int i = 0; i < d.getClipData().getItemCount(); i++) L.add(d.getClipData().getItemAt(i).getUri());
        else if (d.getData() != null) L.add(d.getData());
        for (Uri u : L) {
            try {
                String name = "файл", mime = getContentResolver().getType(u);
                try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) { if (c != null && c.moveToFirst()) name = c.getString(0); }
                ByteArrayOutputStream o = new ByteArrayOutputStream();
                try (InputStream in = getContentResolver().openInputStream(u)) { byte[] buf = new byte[65536]; int n; while (in != null && (n = in.read(buf)) > 0) { o.write(buf, 0, n); if (o.size() > MAX) break; } }
                if (o.size() + total() > MAX) { Toast.makeText(this, "«" + name + "» не поместится: вложения вместе больше 2,3 МБ — отправьте его из обычной почты", Toast.LENGTH_LONG).show(); continue; }
                mine.add(new String[]{name, mime == null ? "application/octet-stream" : mime, Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP), String.valueOf(o.size())});
            } catch (Exception e) { Toast.makeText(this, "Файл не прочитался: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
        }
        filesDraw();
    }
    long total() { long s = 0; for (String[] x : mine) s += Long.parseLong(x[3]); for (Object[] x : fwd) if ((boolean) x[3]) s += (long) x[2]; return s; }

    void filesDraw() {
        files.removeAllViews();
        for (Object[] x : fwd) {
            LinearLayout l = chipRow(); CheckBox cb = new CheckBox(this); cb.setChecked((boolean) x[3]); cb.setOnCheckedChangeListener((b, on) -> { x[3] = on; sizeDraw(); });
            l.addView(cb); l.addView(Ui.line(this, (String) x[1], 14, Ui.INK, false, 1), new LinearLayout.LayoutParams(0, -2, 1));
            l.addView(Ui.text(this, (long) x[2] > 0 ? MailApi.size((long) x[2]) : "", 12, Ui.MUTED, false)); add(l);
        }
        for (int i = 0; i < mine.size(); i++) {
            String[] x = mine.get(i); final int k = i; LinearLayout l = chipRow();
            android.widget.ImageView ic = new android.widget.ImageView(this); android.graphics.drawable.Drawable dr = getDrawable(R.drawable.ic_clip).mutate(); dr.setTint(Ui.BRAND); ic.setImageDrawable(dr);
            LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(Ui.dp(this, 20), Ui.dp(this, 20)); ilp.rightMargin = Ui.dp(this, 10); l.addView(ic, ilp);
            l.addView(Ui.line(this, x[0], 14, Ui.INK, false, 1), new LinearLayout.LayoutParams(0, -2, 1));
            l.addView(Ui.text(this, MailApi.size(Long.parseLong(x[3])), 12, Ui.MUTED, false));
            l.addView(Ui.icon(this, R.drawable.ic_close, "Убрать файл", v -> { mine.remove(k); filesDraw(); }));
            add(l);
        }
        sizeDraw();
    }
    LinearLayout chipRow() { LinearLayout l = new LinearLayout(this); l.setGravity(Gravity.CENTER_VERTICAL); l.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 14))); l.setPadding(Ui.dp(this, 10), Ui.dp(this, 2), Ui.dp(this, 2), Ui.dp(this, 2)); l.setMinimumHeight(Ui.dp(this, 48)); return l; }
    void add(View v) { LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.bottomMargin = Ui.dp(this, 6); files.addView(v, lp); }
    void sizeDraw() { long t = total(); sizeInfo.setVisibility(t > 0 ? View.VISIBLE : View.GONE); sizeInfo.setText("Вложения: " + MailApi.size(t) + " из 2,3 МБ" + (t > MAX ? " — слишком много, снимите лишнее" : "")); sizeInfo.setTextColor(t > MAX ? Ui.BAD : Ui.MUTED); }

    /* ---------- отправка ---------- */
    static List<String> split(String s) { List<String> L = new ArrayList<>(); for (String x : s.split("[,;\\n]")) { String t = x.trim(); if (!t.isEmpty()) L.add(t); } return L; }
    static boolean okAddr(String s) { return s.matches(".*[^@\\s<]+@[^@\\s>]+\\.[^@\\s>]+.*"); }

    void send() {
        if (busy) return;
        List<String> T = split(to.getText().toString()), C = split(cc.getText().toString()); List<String> bad = new ArrayList<>();
        for (String x : T) if (!okAddr(x)) bad.add(x); for (String x : C) if (!okAddr(x)) bad.add(x);
        if (T.isEmpty()) { to.setError("Укажите, кому отправить"); to.requestFocus(); return; }
        if (!bad.isEmpty()) { Toast.makeText(this, "Адрес написан неверно: " + android.text.TextUtils.join(", ", bad), Toast.LENGTH_LONG).show(); return; }
        if (MailApi.accOf(acc) == null) { Toast.makeText(this, "Нет подключённого ящика — подключите его на сайте", Toast.LENGTH_LONG).show(); return; }
        if (total() > MAX) { Toast.makeText(this, "Вложения больше 2,3 МБ — снимите лишнее или отправьте из обычной почты", Toast.LENGTH_LONG).show(); return; }
        if (subj.getText().toString().trim().isEmpty()) { new AlertDialog.Builder(this).setMessage("Отправить письмо без темы?").setPositiveButton("Отправить", (d, w) -> go(T, C)).setNegativeButton("Отмена", null).show(); return; }
        go(T, C);
    }

    void go(List<String> T, List<String> C) {
        busy = true; sendBtn.setText("Отправляю…"); sendBtn.setEnabled(false); sendBtn.setAlpha(0.7f);
        final String sj = subj.getText().toString(), tx = text.getText().toString(), ac = acc;
        MainActivity.IO.execute(() -> {
            String err = null; JSONObject j = null;
            try {
                JSONArray atts = new JSONArray();
                for (String[] x : mine) atts.put(new JSONObject().put("name", x[0]).put("mime", x[1]).put("data", x[2]));
                for (Object[] x : fwd) if ((boolean) x[3]) { JSONObject a = MailApi.att(this, fwdFrom, (int) x[0]); atts.put(new JSONObject().put("name", a.optString("name", (String) x[1])).put("mime", a.optString("mime", "application/octet-stream")).put("data", a.optString("data"))); }
                long sum = 0; for (int i = 0; i < atts.length(); i++) sum += atts.optJSONObject(i).optString("data").length();
                if (sum > 3_200_000) throw new Exception("вложения больше 2,3 МБ — отправьте их из обычной почты");
                JSONObject msg = new JSONObject().put("to", new JSONArray(T)).put("cc", new JSONArray(C)).put("subject", sj).put("text", tx).put("inReply", inReply).put("refs", refs).put("atts", atts);
                if (MailApi.demo) { Thread.sleep(700); j = new JSONObject().put("saved", true); }
                else j = MailApi.send(this, new JSONObject().put("acc", ac).put("reply", reply).put("msg", msg));
            } catch (Exception e) { err = e.getMessage(); }
            final String er = err; final JSONObject res = j;
            runOnUiThread(() -> {
                busy = false; sendBtn.setText("Отправить"); sendBtn.setEnabled(true); sendBtn.setAlpha(1f);
                if (er != null) { new AlertDialog.Builder(this).setTitle("Письмо не ушло").setMessage(er + "\n\nТекст сохранён — можно попробовать ещё раз.").setPositiveButton("Понятно", null).show(); return; }
                synchronized (MailApi.class) {
                    JSONObject row = res.optJSONObject("row");
                    if (row != null) { JSONArray A = new JSONArray(); A.put(row); for (int i = 0; i < MailApi.rows.length(); i++) A.put(MailApi.rows.optJSONObject(i)); MailApi.rows = A; }
                    if (!reply.isEmpty()) { JSONObject x = MailApi.find(reply); if (x != null) try { x.put("ans", MailApi.nowIso()).put("read", "1"); } catch (Exception ignored) {} }
                }
                MailApi.saveCache(this);
                sent = true; dp().edit().remove(key()).apply();
                Toast.makeText(this, "Письмо отправлено: " + android.text.TextUtils.join(", ", T) + (res.optBoolean("saved", true) ? "" : " · копия в «Отправленных» ящика не сохранилась"), Toast.LENGTH_LONG).show();
                finish();
            });
        });
    }

    /* ---------- черновик ---------- */
    boolean empty() { return to.getText().toString().trim().isEmpty() && subj.getText().toString().trim().isEmpty() && text.getText().toString().trim().isEmpty() && mine.isEmpty(); }
    void saveDraft() {
        if (sent || to == null) return;
        if (kind.equals("new") && empty()) { dp().edit().remove(key()).apply(); return; }
        try {
            JSONArray off = new JSONArray(); for (Object[] x : fwd) if (!(boolean) x[3]) off.put((int) x[0]);
            dp().edit().putString(key(), new JSONObject().put("acc", acc).put("to", to.getText().toString()).put("cc", cc.getText().toString()).put("subject", subj.getText().toString()).put("text", text.getText().toString()).put("off", off).put("at", new SimpleDateFormat("dd.MM HH:mm", Locale.US).format(new java.util.Date())).toString()).apply();
        } catch (Exception ignored) {}
    }
    @Override protected void onPause() { super.onPause(); saveDraft(); }

    @Override public void onBackPressed() {
        if (busy) { Toast.makeText(this, "Письмо отправляется…", Toast.LENGTH_SHORT).show(); return; }
        if (empty() || sent) { dp().edit().remove(key()).apply(); sent = true; super.onBackPressed(); return; }
        new AlertDialog.Builder(this).setMessage("Письмо не отправлено.")
            .setPositiveButton("Сохранить черновик", (d, w) -> { saveDraft(); Toast.makeText(this, "Черновик сохранён — откроется, когда снова начнёте это письмо", Toast.LENGTH_LONG).show(); finish(); })
            .setNegativeButton("Удалить", (d, w) -> { sent = true; dp().edit().remove(key()).apply(); finish(); })
            .setNeutralButton("Писать дальше", null).show();
    }
}
