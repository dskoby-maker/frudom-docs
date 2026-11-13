package ru.frudom.mail;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** «Почта ФД» — настоящий экран Android со списком писем (средний вариант, 13.11.2026).
 *  Папки как на сайте (Входящие, Заявки, Непрочитанные, …, свои папки), ящики, поиск, «потянуть вниз» — проверить почту.
 *  Нажатие — письмо (LetterActivity), долгое нажатие — прочитано / обработано / неважные / спам.
 *  Новое письмо, ответ и редкие функции — сайтом (WebActivity). */
public class MainActivity extends Activity {
    static final ExecutorService IO = Executors.newSingleThreadExecutor();
    final Handler ui = new Handler(Looper.getMainLooper());
    String folder = "in", box = "", query = "";
    boolean syncing;

    LinearLayout root, chips, searchRow, banner;
    TextView title, sub, upd;
    EditText search;
    SwipeRefreshLayout swipe;
    RecyclerView listView;
    Adapter adapter;
    TextView fab;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (b != null) { folder = b.getString("f", "in"); box = b.getString("b", ""); }
        String f = getIntent().getStringExtra("folder"); if (f != null && !f.isEmpty()) folder = f;
        if (Build.VERSION.SDK_INT >= 23) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        build();
        if (getIntent().getBooleanExtra("demo", false)) MailApi.demo(this); else
        MailApi.loadCache(this);
        render();
        MailNotifier.schedule(this, false);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
            && MailNotifier.hasAccount(this) && !MailNotifier.prefs(this).getBoolean("askedPerm", false)) {
            MailNotifier.prefs(this).edit().putBoolean("askedPerm", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 3);
        }
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); o.putString("f", folder); o.putString("b", box); }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i); setIntent(i);
        String f = i.getStringExtra("folder"); if (f != null && !f.isEmpty()) { folder = f; render(); }
    }

    @Override protected void onResume() {
        super.onResume();
        if (MailApi.demo) { render(); String o = getIntent().getStringExtra("open"), q = getIntent().getStringExtra("acts"); getIntent().removeExtra("open"); getIntent().removeExtra("acts");
            if (o != null) ui.postDelayed(() -> openLetter(MailApi.find(o)), 600); if (q != null) ui.postDelayed(() -> actions(MailApi.find(q)), 600); return; }
        if (!MailNotifier.hasAccount(this)) {   // не вошли — вход сайтом, потом сюда
            MailApi.forget(this); render();
            startActivity(new Intent(this, WebActivity.class).putExtra("login", true));
            return;
        }
        render();
        if (MailApi.dirty || MailApi.at == 0 || System.currentTimeMillis() - MailApi.at > 120_000) refresh(MailApi.at == 0 || System.currentTimeMillis() - MailApi.at > 600_000);
        Updater.check(this, this::showUpdate);
    }

    /* ---------- разметка ---------- */
    void build() {
        FrameLayout frame = new FrameLayout(this); frame.setBackgroundColor(Ui.BG);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        frame.addView(root, new FrameLayout.LayoutParams(-1, -1));

        /* шапка: название папки, число непрочитанных, ящики · время; поиск и «⋮» */
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(Ui.dp(this, 16), Ui.dp(this, 6), Ui.dp(this, 4), 0);
        LinearLayout tt = new LinearLayout(this); tt.setOrientation(LinearLayout.VERTICAL);
        title = Ui.line(this, "Входящие", 22, Ui.INK, true, 1);
        sub = Ui.line(this, "", 13, Ui.MUTED, false, 1);
        tt.addView(title); tt.addView(sub);
        tt.setOnClickListener(v -> pickBox()); tt.setBackground(Ui.press(this, null));
        bar.addView(tt, new LinearLayout.LayoutParams(0, -2, 1));
        bar.addView(Ui.icon(this, R.drawable.ic_search, "Поиск", v -> openSearch(true)));
        bar.addView(Ui.icon(this, R.drawable.ic_more, "Ещё", this::menu));
        root.addView(bar);

        searchRow = new LinearLayout(this); searchRow.setGravity(Gravity.CENTER_VERTICAL); searchRow.setVisibility(View.GONE);
        searchRow.setPadding(Ui.dp(this, 12), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
        search = new EditText(this); search.setHint("Искать в письмах: тема, отправитель, текст…"); search.setSingleLine(); search.setTextSize(16);
        search.setBackground(Ui.round(Ui.CARD, Ui.dp(this, 14))); search.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {} public void onTextChanged(CharSequence s, int a, int b, int c) {}
            public void afterTextChanged(Editable e) { query = e.toString(); render(); }
        });
        searchRow.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
        searchRow.addView(Ui.icon(this, R.drawable.ic_close, "Закрыть поиск", v -> openSearch(false)));
        root.addView(searchRow);

        HorizontalScrollView hs = new HorizontalScrollView(this); hs.setHorizontalScrollBarEnabled(false);
        chips = new LinearLayout(this); chips.setPadding(Ui.dp(this, 12), Ui.dp(this, 6), Ui.dp(this, 12), Ui.dp(this, 8));
        hs.addView(chips); root.addView(hs);

        upd = Ui.text(this, "", 14, Color.WHITE, true); upd.setVisibility(View.GONE); upd.setGravity(Gravity.CENTER_VERTICAL);
        upd.setBackground(Ui.press(this, Ui.round(Ui.BRAND, Ui.dp(this, 14)))); upd.setPadding(Ui.dp(this, 16), Ui.dp(this, 12), Ui.dp(this, 16), Ui.dp(this, 12));
        LinearLayout.LayoutParams ulp = new LinearLayout.LayoutParams(-1, -2); ulp.setMargins(Ui.dp(this, 12), 0, Ui.dp(this, 12), Ui.dp(this, 8)); root.addView(upd, ulp);

        banner = new LinearLayout(this); banner.setVisibility(View.GONE); banner.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        banner.setBackground(Ui.round(0xFFFBEAE7, Ui.dp(this, 14)));
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(-1, -2); blp.setMargins(Ui.dp(this, 12), 0, Ui.dp(this, 12), Ui.dp(this, 8)); root.addView(banner, blp);

        swipe = new SwipeRefreshLayout(this); swipe.setColorSchemeColors(Ui.BRAND); swipe.setOnRefreshListener(() -> refresh(true));
        listView = new RecyclerView(this); listView.setLayoutManager(new LinearLayoutManager(this)); listView.setClipToPadding(false);
        listView.setPadding(0, 0, 0, Ui.dp(this, 96));
        adapter = new Adapter(); listView.setAdapter(adapter);
        swipe.addView(listView, new ViewGroup.LayoutParams(-1, -1));
        root.addView(swipe, new LinearLayout.LayoutParams(-1, 0, 1));

        /* «Написать» — внизу справа, как в почтовых приложениях */
        fab = Ui.text(this, "  Написать", 16, Color.WHITE, true); fab.setGravity(Gravity.CENTER);
        fab.setCompoundDrawablesRelativeWithIntrinsicBounds(tint(R.drawable.ic_pen, Color.WHITE), null, null, null);
        fab.setBackground(Ui.press(this, Ui.round(0xFF6A2C4E, Ui.dp(this, 18)))); fab.setElevation(Ui.dp(this, 6));
        fab.setPadding(Ui.dp(this, 20), 0, Ui.dp(this, 22), 0); fab.setMinHeight(Ui.dp(this, 56)); fab.setClickable(true);
        fab.setOnClickListener(v -> web("", "new"));
        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(-2, Ui.dp(this, 56), Gravity.BOTTOM | Gravity.END); flp.setMargins(0, 0, Ui.dp(this, 18), Ui.dp(this, 22));
        frame.addView(fab, flp);
        listView.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override public void onScrolled(RecyclerView rv, int dx, int dy) { if (dy > 6) fab.setText(""); else if (dy < -6) fab.setText("  Написать"); }
        });

        setContentView(frame);
    }

    android.graphics.drawable.Drawable tint(int res, int color) { android.graphics.drawable.Drawable d = getDrawable(res).mutate(); d.setTint(color); return d; }

    void openSearch(boolean on) {
        searchRow.setVisibility(on ? View.VISIBLE : View.GONE);
        InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (on) { search.requestFocus(); if (im != null) im.showSoftInput(search, 0); }
        else { search.setText(""); query = ""; if (im != null) im.hideSoftInputFromWindow(search.getWindowToken(), 0); render(); }
    }

    /* ---------- данные ---------- */
    void refresh(boolean sync) {
        if (syncing) return; syncing = true; swipe.setRefreshing(true); render();
        IO.execute(() -> {
            String e = null;
            try { if (MailApi.rows.length() == 0 || !sync) MailApi.load(this, false); ui.post(this::render); if (sync) MailApi.load(this, true); }
            catch (Exception x) { e = x.getMessage(); }
            final String err = e;
            ui.post(() -> {
                syncing = false; swipe.setRefreshing(false);
                if (err != null && err.contains("Пароль")) { MailNotifier.setAccount(this, "{\"url\":\"\",\"user\":\"\",\"key\":\"\"}"); onResume(); return; }
                showBanner(err != null ? (MailApi.rows.length() > 0 ? "Нет связи с таблицей — показаны письма, загруженные раньше. " : "Не получилось загрузить письма: ") + err : MailApi.err);
                render(); readSync();
            });
        });
    }

    /** уведомления о письмах, которые уже прочитаны, убрать */
    void readSync() {
        if (MailApi.ro(this) || MailApi.rows.length() == 0) return;
        JSONArray u = new JSONArray(); for (int i = 0; i < MailApi.rows.length(); i++) { JSONObject r = MailApi.rows.optJSONObject(i); if (r != null && MailApi.unread(this, r)) u.put(r.optString("id")); }
        try { MailNotifier.syncRead(this, new JSONObject().put("loaded", true).put("unread", u).toString()); } catch (Exception ignored) {}
    }

    void showBanner(String t) {
        banner.removeAllViews();
        if (t == null || t.isEmpty()) { banner.setVisibility(View.GONE); return; }
        banner.addView(Ui.text(this, t, 14, Ui.BAD, false)); banner.setVisibility(View.VISIBLE);
    }

    void showUpdate(Updater.Info inf) {
        if (inf == null) { upd.setVisibility(View.GONE); return; }
        upd.setText("Есть новая версия «Почты ФД» (" + inf.name + ") — нажмите, чтобы обновить");
        upd.setVisibility(View.VISIBLE); upd.setOnClickListener(v -> Updater.install(this, inf));
    }

    /* ---------- отрисовка ---------- */
    void render() {
        boolean ro = MailApi.ro(this);
        String bx = box.isEmpty() ? (MailApi.acc.length() > 1 ? "все ящики" : MailApi.acc.length() == 1 ? MailApi.acc.optJSONObject(0).optString("email") : "") : (MailApi.accOf(box) == null ? "" : MailApi.accOf(box).optString("email"));
        int un = MailApi.count(this, folder.equals("unread") ? "unread" : folder.startsWith("u:") ? folder : "in");
        title.setText(MailApi.folderName(folder) + ((folder.equals("in") || folder.equals("unread")) && un > 0 ? "  " + un : ""));
        String when = syncing ? "проверяю ящики…" : MailApi.at > 0 ? "обновлено в " + new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(new Date(MailApi.at)) : "";
        sub.setText(bx + (bx.isEmpty() || when.isEmpty() ? "" : " · ") + when + (ro ? " · только чтение" : ""));
        fab.setVisibility(ro ? View.GONE : View.VISIBLE);

        chips.removeAllViews();
        List<String[]> F = new ArrayList<>();
        for (String[] x : MailApi.FOLDERS) F.add(x);
        for (int i = 0; i < MailApi.folders.length(); i++) { JSONObject x = MailApi.folders.optJSONObject(i); if (x != null) F.add(new String[]{"u:" + x.optString("id"), x.optString("name")}); }
        for (String[] x : F) {
            int n = x[0].equals("in") || x[0].equals("unread") || x[0].startsWith("u:") ? MailApi.count(this, x[0]) : 0;
            boolean on = x[0].equals(folder);
            TextView ch = Ui.text(this, x[1] + (n > 0 ? "  " + n : ""), 14, on ? Color.WHITE : Ui.INK, on);
            ch.setBackground(Ui.press(this, Ui.round(on ? Ui.BRAND : Ui.CARD, Ui.dp(this, 99))));
            ch.setPadding(Ui.dp(this, 14), Ui.dp(this, 8), Ui.dp(this, 14), Ui.dp(this, 8)); ch.setClickable(true);
            ch.setOnClickListener(v -> { folder = x[0]; render(); listView.scrollToPosition(0); });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.rightMargin = Ui.dp(this, 8); chips.addView(ch, lp);
        }

        List<JSONObject> L = MailApi.list(this, folder, box, query);
        List<Object> items = new ArrayList<>(); String lastDay = null;
        for (JSONObject r : L) { String d = MailApi.day(MailApi.date(r.optString("date"))); if (!d.equals(lastDay)) { items.add(d); lastDay = d; } items.add(r); }
        if (items.isEmpty()) items.add(MailApi.at == 0 && MailApi.rows.length() == 0 ? (syncing ? "@Загружаю письма…" : "@Писем пока нет") : query.isEmpty() ? "@В папке «" + MailApi.folderName(folder) + "» писем нет" : "@Ничего не нашлось");
        adapter.set(items);
    }

    /* ---------- список ---------- */
    class Adapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
        List<Object> items = new ArrayList<>();
        void set(List<Object> L) { items = L; notifyDataSetChanged(); }
        @Override public int getItemCount() { return items.size(); }
        @Override public int getItemViewType(int i) { Object o = items.get(i); return o instanceof JSONObject ? 1 : String.valueOf(o).startsWith("@") ? 2 : 0; }
        @Override public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup p, int t) {
            View v;
            if (t == 1) v = new Row(MainActivity.this);
            else { TextView h = Ui.text(MainActivity.this, "", t == 2 ? 15 : 13, Ui.MUTED, t == 0);
                h.setPadding(Ui.dp(MainActivity.this, 20), Ui.dp(MainActivity.this, t == 2 ? 48 : 14), Ui.dp(MainActivity.this, 20), Ui.dp(MainActivity.this, 6));
                if (t == 2) h.setGravity(Gravity.CENTER); v = h; }
            v.setLayoutParams(new RecyclerView.LayoutParams(-1, -2));
            return new RecyclerView.ViewHolder(v) {};
        }
        @Override public void onBindViewHolder(RecyclerView.ViewHolder h, int i) {
            Object o = items.get(i);
            if (h.itemView instanceof Row) ((Row) h.itemView).bind((JSONObject) o);
            else ((TextView) h.itemView).setText(String.valueOf(o).replaceFirst("^@", ""));
        }
    }

    /** строка письма: кружок, отправитель, время, тема, начало письма, метки */
    class Row extends LinearLayout {
        TextView av, who, time, subj, snip; LinearLayout tags; View dotNew; JSONObject r;
        Row(Context c) {
            super(c); setOrientation(HORIZONTAL); setPadding(Ui.dp(c, 16), Ui.dp(c, 10), Ui.dp(c, 16), Ui.dp(c, 10));
            setBackground(Ui.press(c, null)); setClickable(true);
            av = Ui.avatar(c, "", "", 42); LayoutParams alp = (LayoutParams) av.getLayoutParams(); alp.rightMargin = Ui.dp(c, 12); alp.topMargin = Ui.dp(c, 2); addView(av, alp);
            LinearLayout col = new LinearLayout(c); col.setOrientation(VERTICAL);
            LinearLayout l1 = new LinearLayout(c); l1.setGravity(Gravity.CENTER_VERTICAL);
            who = Ui.line(c, "", 16, Ui.INK, false, 1); l1.addView(who, new LayoutParams(0, -2, 1));
            dotNew = Ui.dot(c, Ui.BLUE, 8); ((LayoutParams) dotNew.getLayoutParams()).rightMargin = Ui.dp(c, 6); l1.addView(dotNew);
            time = Ui.line(c, "", 13, Ui.MUTED, false, 1); l1.addView(time);
            subj = Ui.line(c, "", 15, Ui.INK, false, 1);
            snip = Ui.line(c, "", 14, Ui.MUTED, false, 2);
            tags = new LinearLayout(c); tags.setGravity(Gravity.CENTER_VERTICAL);
            col.addView(l1); col.addView(subj); col.addView(snip); col.addView(tags);
            addView(col, new LayoutParams(0, -2, 1));
            setOnClickListener(v -> openLetter(r));
            setOnLongClickListener(v -> { actions(r); return true; });
        }
        void bind(JSONObject x) {
            r = x; Context c = getContext(); boolean un = MailApi.unread(c, x), sent = MailApi.sent(x);
            String name = sent ? "Кому: " + x.optString("to").replaceAll("<[^>]*>", "").trim() : x.optString("fromName").isEmpty() ? x.optString("from") : x.optString("fromName");
            TextView a2 = Ui.avatar(c, sent ? x.optString("to") : x.optString("fromName"), sent ? x.optString("to") : x.optString("from"), 42);
            av.setText(a2.getText()); av.setTextColor(a2.getCurrentTextColor()); av.setBackground(a2.getBackground());
            who.setText(name); who.setTypeface(Typeface.create(un ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL)); who.setTextColor(un ? Ui.INK : 0xFF3A3632);
            subj.setText(x.optString("subject").isEmpty() ? "(без темы)" : x.optString("subject")); subj.setTypeface(Typeface.create(un ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
            snip.setText(x.optString("snippet")); snip.setVisibility(x.optString("snippet").isEmpty() ? GONE : VISIBLE);
            time.setText(MailApi.shortTime(MailApi.date(x.optString("date")))); time.setTextColor(un ? Ui.BLUE : Ui.MUTED);
            dotNew.setVisibility(un ? VISIBLE : GONE);
            tags.removeAllViews();
            if (MailApi.acc.length() > 1) { View d = Ui.dot(c, Ui.boxColor(x.optString("acc")), 7); ((LayoutParams) d.getLayoutParams()).rightMargin = Ui.dp(c, 6); tags.addView(d); }
            if (MailApi.isOrd(x)) addTag(Ui.chip(c, "Заявка", Ui.ORD, Ui.ORD_BG));
            if (MailApi.done(x)) addTag(Ui.chip(c, "✓ Обработано", Ui.OK, Ui.OK_BG));
            else if (MailApi.todo(x)) addTag(Ui.chip(c, "Не обработано", Ui.TODO, Ui.TODO_BG));
            if (folder.equals("all")) { String w = MailApi.spam(x) ? "Спам" : MailApi.minor(x) ? "Неважные" : sent ? "Отправленные" : !MailApi.fld(x).isEmpty() ? MailApi.folderName("u:" + MailApi.fld(x)) : ""; if (!w.isEmpty()) addTag(Ui.chip(c, w, Ui.MUTED, 0xFFECE8E2)); }
            if (MailApi.atts(x).length() > 0) { ImageView cl = new ImageView(c); cl.setImageDrawable(tint(R.drawable.ic_clip, Ui.MUTED)); LayoutParams lp = new LayoutParams(Ui.dp(c, 16), Ui.dp(c, 16)); lp.rightMargin = Ui.dp(c, 4); tags.addView(cl, lp);
                tags.addView(Ui.line(c, x.optString("attsText"), 12, Ui.MUTED, false, 1), new LayoutParams(0, -2, 1)); }
            tags.setVisibility(tags.getChildCount() > 0 ? VISIBLE : GONE);
            ((LayoutParams) tags.getLayoutParams()).topMargin = Ui.dp(c, 4);
            setAlpha(MailApi.spam(x) || MailApi.minor(x) ? 0.72f : 1f);
        }
        void addTag(View v) { LayoutParams lp = new LayoutParams(-2, -2); lp.rightMargin = Ui.dp(getContext(), 6); tags.addView(v, lp); }
    }

    void openLetter(JSONObject r) { if (r != null) startActivity(new Intent(this, LetterActivity.class).putExtra("id", r.optString("id"))); }

    /* долгое нажатие на письмо */
    void actions(JSONObject r) {
        if (r == null) return;
        List<String> L = new ArrayList<>(); List<Runnable> A = new ArrayList<>();
        L.add("Открыть"); A.add(() -> openLetter(r));
        if (!MailApi.ro(this) && !MailApi.sent(r)) {
            boolean un = MailApi.unread(this, r);
            L.add(un ? "Отметить прочитанным" : "Отметить непрочитанным"); A.add(() -> Act.read(this, r, un, this::render));
            L.add(MailApi.done(r) ? "Снять «Обработано»" : "Обработано"); A.add(() -> Act.done(this, r, !MailApi.done(r), this::render));
            L.add(MailApi.minor(r) ? "Вернуть во «Входящие»" : "В «Неважные»"); A.add(() -> Act.minor(this, r, !MailApi.minor(r), this::render));
            L.add(MailApi.spam(r) ? "Не спам" : "Это спам"); A.add(() -> Act.spam(this, r, !MailApi.spam(r), this::render));
            L.add("Ответить"); A.add(() -> web(r.optString("id"), "reply"));
        }
        L.add("Открыть на сайте"); A.add(() -> web(r.optString("id"), ""));
        String head = (r.optString("fromName").isEmpty() ? r.optString("from") : r.optString("fromName")) + " — " + r.optString("subject");
        new AlertDialog.Builder(this).setTitle(head).setItems(L.toArray(new String[0]), (d, w) -> A.get(w).run()).show();
    }

    void web(String id, String how) { startActivity(new Intent(this, WebActivity.class).putExtra("mail", id).putExtra("how", how)); }

    void pickBox() {
        if (MailApi.acc.length() < 2) return;
        List<String> L = new ArrayList<>(); List<String> ids = new ArrayList<>();
        L.add("Все ящики"); ids.add("");
        for (int i = 0; i < MailApi.acc.length(); i++) { JSONObject a = MailApi.acc.optJSONObject(i); L.add(a.optString("email") + (a.optString("err").isEmpty() ? "" : "  ⚠")); ids.add(a.optString("id")); }
        new AlertDialog.Builder(this).setTitle("Какой ящик показать").setItems(L.toArray(new String[0]), (d, w) -> { box = ids.get(w); render(); }).show();
    }

    void menu(View anchor) {
        PopupMenu m = new PopupMenu(this, anchor);
        m.getMenu().add(0, 1, 0, "Проверить почту");
        if (MailApi.acc.length() > 1) m.getMenu().add(0, 2, 0, "Ящик: " + (box.isEmpty() ? "все" : MailApi.accOf(box) == null ? "" : MailApi.accOf(box).optString("email")));
        m.getMenu().add(0, 3, 0, "Открыть почту сайтом (всё остальное)");
        m.getMenu().add(0, 4, 0, "Уведомления о письмах");
        m.getMenu().add(0, 5, 0, "Выйти из «" + MailApi.user(this) + "»");
        m.setOnMenuItemClickListener(it -> {
            switch (it.getItemId()) {
                case 1: refresh(true); break;
                case 2: pickBox(); break;
                case 3: web("", "in"); break;
                case 4: startActivity(new Intent(this, MailSettingsActivity.class)); break;
                case 5: new AlertDialog.Builder(this).setMessage("Выйти из «Почты ФД»? Уведомления о письмах перестанут приходить, пока не войдёте снова.")
                    .setPositiveButton("Выйти", (d, w) -> { MailApi.forget(this); startActivity(new Intent(this, WebActivity.class).putExtra("login", true).putExtra("how", "logout")); })
                    .setNegativeButton("Отмена", null).show(); break;
            }
            return true;
        });
        m.show();
    }

    @Override public void onBackPressed() {
        if (searchRow.getVisibility() == View.VISIBLE) { openSearch(false); return; }
        if (!folder.equals("in")) { folder = "in"; render(); return; }
        super.onBackPressed();
    }
}
