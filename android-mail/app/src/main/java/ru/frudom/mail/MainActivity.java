package ru.frudom.mail;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** «Почта ФД» — список писем. Всё, что умеет почта на сайте:
 *  папки (Входящие, Заявки, Непрочитанные, Не обработаны, Все, Отправленные, Неважные, Спам, свои папки — создать, переименовать, удалить),
 *  ящики, поиск, «потянуть вниз» — проверить почту, «Прочитать все»;
 *  смахнуть вправо — прочитано/не прочитано, влево — в «Неважные» (с «Отменить»);
 *  долгое нажатие или кружок — выбор нескольких писем: прочитано, обработано, не обработано, неважные, спам, в папку;
 *  живое обновление — отметки Натальи и сайта видны сами через несколько секунд (Live). Новое письмо — свой экран (ComposeActivity). */
public class MainActivity extends Activity {
    static final ExecutorService IO = Executors.newFixedThreadPool(4), SAVE = Executors.newSingleThreadExecutor();   // отметки — по очереди, остальное — параллельно
    final Handler ui = new Handler(Looper.getMainLooper());
    String folder = "in", box = "", query = "";
    boolean syncing, swiping, drawLater;
    final Set<String> sel = new LinkedHashSet<>();
    boolean selMode;

    LinearLayout root, chips, searchRow, banner, bar, selBar, snack;
    TextView title, sub, upd, selCount, snackText, snackBtn;
    ImageButton selRead;
    EditText search;
    SwipeRefreshLayout swipe;
    RecyclerView listView;
    Adapter adapter;
    TextView fab;
    final Live.L live = () -> { if (swiping) { drawLater = true; return; } render(); };

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
        String f = i.getStringExtra("folder"); if (f != null && !f.isEmpty()) { folder = f; selOff(); render(); }
    }

    @Override protected void onResume() {
        super.onResume();
        Live.on(this, live);
        if (MailApi.demo) { render(); demoSteps(); return; }
        if (!MailNotifier.hasAccount(this)) {   // не вошли — вход сайтом, потом сюда
            MailApi.forget(this); render();
            startActivity(new Intent(this, WebActivity.class).putExtra("login", true));
            return;
        }
        render();
        if (MailApi.dirty || MailApi.at == 0 || System.currentTimeMillis() - MailApi.at > 120_000) refresh(MailApi.at == 0 || System.currentTimeMillis() - MailApi.at > 600_000);
        else Live.now();
        Act.Undo u = Act.last; Act.last = null;
        if (u != null && u.n > 0 && System.currentTimeMillis() - u.at < 8000) showUndo(u);
        Updater.check(this, this::showUpdate);
    }

    @Override protected void onPause() { super.onPause(); Live.off(live); }

    /** проверка на эмуляторе: --es open d1 (письмо), --es pick d2 (выбор), --es acts d2 (меню письма), --es compose new|reply, --es att d1:0 (вложение), --es swipe d2 */
    void demoSteps() {
        Intent i = getIntent(); String o = i.getStringExtra("open"), q = i.getStringExtra("acts"), pk = i.getStringExtra("pick"), cm = i.getStringExtra("compose"), at = i.getStringExtra("att"), sw = i.getStringExtra("swipe");
        for (String k : new String[]{"open", "acts", "pick", "compose", "att", "swipe"}) i.removeExtra(k);
        if (o != null) ui.postDelayed(() -> openLetter(MailApi.find(o)), 600);
        if (q != null) ui.postDelayed(() -> actions(MailApi.find(q)), 600);
        if (pk != null) ui.postDelayed(() -> { selOn(pk); if (MailApi.find("d4") != null) toggle("d4"); }, 600);
        if (cm != null) ui.postDelayed(() -> compose(cm, "d1"), 600);
        if (at != null) ui.postDelayed(() -> startActivity(new Intent(this, ViewerActivity.class).putExtra("id", at.split(":")[0]).putExtra("i", Integer.parseInt(at.split(":")[1]))), 600);
        if (sw != null) ui.postDelayed(() -> { JSONObject r = MailApi.find(sw); if (r != null) { Act.Undo u = Act.one(this, r, "minor", this::render); showUndo(u); } }, 600);
    }

    /* ---------- разметка ---------- */
    void build() {
        FrameLayout frame = new FrameLayout(this); frame.setBackgroundColor(Ui.BG);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        frame.addView(root, new FrameLayout.LayoutParams(-1, -1));

        /* шапка: название папки, число непрочитанных, ящики · время; поиск и «⋮» */
        FrameLayout heads = new FrameLayout(this);
        bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(Ui.dp(this, 16), Ui.dp(this, 6), Ui.dp(this, 4), 0);
        LinearLayout tt = new LinearLayout(this); tt.setOrientation(LinearLayout.VERTICAL);
        title = Ui.line(this, "Входящие", 22, Ui.INK, true, 1);
        sub = Ui.line(this, "", 13, Ui.MUTED, false, 1);
        tt.addView(title); tt.addView(sub);
        tt.setOnClickListener(v -> pickBox()); tt.setBackground(Ui.press(this, null));
        bar.addView(tt, new LinearLayout.LayoutParams(0, -2, 1));
        bar.addView(Ui.icon(this, R.drawable.ic_search, "Поиск", v -> openSearch(true)));
        bar.addView(Ui.icon(this, R.drawable.ic_more, "Ещё", this::menu));
        heads.addView(bar, new FrameLayout.LayoutParams(-1, -2));

        /* выбор нескольких писем: число и действия */
        selBar = new LinearLayout(this); selBar.setGravity(Gravity.CENTER_VERTICAL); selBar.setVisibility(View.GONE);
        selBar.setPadding(Ui.dp(this, 4), Ui.dp(this, 6), Ui.dp(this, 4), Ui.dp(this, 2));
        selBar.addView(Ui.icon(this, R.drawable.ic_close, "Снять выбор", v -> selOff()));
        selCount = Ui.line(this, "", 20, Ui.INK, true, 1); selCount.setPadding(Ui.dp(this, 4), 0, 0, 0); selBar.addView(selCount, new LinearLayout.LayoutParams(0, -2, 1));
        selRead = Ui.icon(this, R.drawable.ic_mail_open, "Прочитано", v -> selAct(selAnyUnread() ? "read" : "unread")); selBar.addView(selRead);
        selBar.addView(Ui.icon(this, R.drawable.ic_check, "Обработано", v -> selAct("done")));
        selBar.addView(Ui.icon(this, R.drawable.ic_archive, "В «Неважные»", v -> selAct(folder.equals("minor") ? "major" : "minor")));
        selBar.addView(Ui.icon(this, R.drawable.ic_folder, "В папку", v -> pickFolder(selRows())));
        selBar.addView(Ui.icon(this, R.drawable.ic_more, "Ещё", this::selMenu));
        heads.addView(selBar, new FrameLayout.LayoutParams(-1, -2));
        root.addView(heads);

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
        listView.setPadding(0, 0, 0, Ui.dp(this, 110)); listView.setItemAnimator(null);
        adapter = new Adapter(); listView.setAdapter(adapter);
        swipe.addView(listView, new ViewGroup.LayoutParams(-1, -1));
        root.addView(swipe, new LinearLayout.LayoutParams(-1, 0, 1));
        new ItemTouchHelper(new SwipeCb()).attachToRecyclerView(listView);

        /* «Написать» — внизу справа, как в почтовых приложениях */
        fab = Ui.text(this, "  Написать", 16, Color.WHITE, true); fab.setGravity(Gravity.CENTER);
        fab.setCompoundDrawablesRelativeWithIntrinsicBounds(tint(R.drawable.ic_pen, Color.WHITE), null, null, null);
        fab.setBackground(Ui.press(this, Ui.round(0xFF6A2C4E, Ui.dp(this, 18)))); fab.setElevation(Ui.dp(this, 6));
        fab.setPadding(Ui.dp(this, 20), 0, Ui.dp(this, 22), 0); fab.setMinHeight(Ui.dp(this, 56)); fab.setClickable(true);
        fab.setOnClickListener(v -> compose("new", ""));
        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(-2, Ui.dp(this, 56), Gravity.BOTTOM | Gravity.END); flp.setMargins(0, 0, Ui.dp(this, 18), Ui.dp(this, 22));
        frame.addView(fab, flp);
        listView.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override public void onScrolled(RecyclerView rv, int dx, int dy) { if (dy > 6) fab.setText(""); else if (dy < -6) fab.setText("  Написать"); }
        });

        /* полоска «Отмечено … · Отменить» внизу */
        snack = new LinearLayout(this); snack.setGravity(Gravity.CENTER_VERTICAL); snack.setVisibility(View.GONE); snack.setElevation(Ui.dp(this, 8));
        snack.setBackground(Ui.round(0xFF2B2824, Ui.dp(this, 14))); snack.setPadding(Ui.dp(this, 16), Ui.dp(this, 4), Ui.dp(this, 6), Ui.dp(this, 4)); snack.setMinimumHeight(Ui.dp(this, 52));
        snackText = Ui.line(this, "", 15, Color.WHITE, false, 2); snack.addView(snackText, new LinearLayout.LayoutParams(0, -2, 1));
        snackBtn = Ui.text(this, "Отменить", 15, 0xFFF2C38B, true); snackBtn.setPadding(Ui.dp(this, 14), Ui.dp(this, 12), Ui.dp(this, 14), Ui.dp(this, 12));
        snackBtn.setBackground(Ui.press(this, null)); snackBtn.setClickable(true); snack.addView(snackBtn);
        FrameLayout.LayoutParams slp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM); slp.setMargins(Ui.dp(this, 12), 0, Ui.dp(this, 12), Ui.dp(this, 90));
        frame.addView(snack, slp);

        setContentView(frame);
    }

    android.graphics.drawable.Drawable tint(int res, int color) { android.graphics.drawable.Drawable d = getDrawable(res).mutate(); d.setTint(color); return d; }

    void openSearch(boolean on) {
        searchRow.setVisibility(on ? View.VISIBLE : View.GONE);
        InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (on) { search.requestFocus(); if (im != null) im.showSoftInput(search, 0); }
        else { search.setText(""); query = ""; if (im != null) im.hideSoftInputFromWindow(search.getWindowToken(), 0); render(); }
    }

    /* ---------- «Отменить» ---------- */
    final Runnable hideSnack = () -> snack.animate().alpha(0f).translationY(Ui.dp(this, 20)).setDuration(180).withEndAction(() -> snack.setVisibility(View.GONE)).start();
    void showSnack(String text, String btn, Runnable act) {
        ui.removeCallbacks(hideSnack); snack.animate().cancel();
        snackText.setText(text); snackBtn.setVisibility(btn == null ? View.GONE : View.VISIBLE); if (btn != null) snackBtn.setText(btn);
        snackBtn.setOnClickListener(v -> { ui.removeCallbacks(hideSnack); hideSnack.run(); if (act != null) act.run(); });
        if (snack.getVisibility() != View.VISIBLE) { snack.setAlpha(0f); snack.setTranslationY(Ui.dp(this, 20)); snack.setVisibility(View.VISIBLE); }
        snack.animate().alpha(1f).translationY(0).setDuration(180).start();
        ui.postDelayed(hideSnack, btn == null ? 3000 : 6500);
    }
    void showUndo(Act.Undo u) {
        if (u == null) return;
        if (u.n == 0) { showSnack("Нечего отмечать", null, null); return; }
        showSnack(u.text, "Отменить", () -> { Act.undo(this, u, this::render); showSnack("Отменено", null, null); });
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
        drawLater = false;
        boolean ro = MailApi.ro(this);
        String bx = box.isEmpty() ? (MailApi.acc.length() > 1 ? "все ящики" : MailApi.acc.length() == 1 ? MailApi.acc.optJSONObject(0).optString("email") : "") : (MailApi.accOf(box) == null ? "" : MailApi.accOf(box).optString("email"));
        int un = MailApi.count(this, folder.equals("unread") ? "unread" : folder.startsWith("u:") ? folder : "in");
        title.setText(MailApi.folderName(folder) + ((folder.equals("in") || folder.equals("unread")) && un > 0 ? "  " + un : ""));
        long last = Math.max(MailApi.at, Live.lastOk);
        String when = syncing ? "проверяю ящики…" : last > 0 ? "обновлено в " + new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(new Date(last)) : "";
        sub.setText(bx + (bx.isEmpty() || when.isEmpty() ? "" : " · ") + when + (ro ? " · только чтение" : ""));

        chips.removeAllViews();
        List<String[]> F = new ArrayList<>();
        for (String[] x : MailApi.FOLDERS) F.add(x);
        for (int i = 0; i < MailApi.folders.length(); i++) { JSONObject x = MailApi.folders.optJSONObject(i); if (x != null) F.add(new String[]{"u:" + x.optString("id"), x.optString("name")}); }
        boolean known = false; for (String[] x : F) if (x[0].equals(folder)) known = true;
        if (!known) folder = "in";
        for (String[] x : F) {
            int n = x[0].equals("in") || x[0].equals("unread") || x[0].startsWith("u:") || x[0].equals("undone") ? MailApi.count(this, x[0]) : 0;
            boolean on = x[0].equals(folder);
            TextView ch = Ui.text(this, x[1] + (n > 0 ? "  " + n : ""), 14, on ? Color.WHITE : Ui.INK, on);
            ch.setBackground(Ui.press(this, Ui.round(on ? Ui.BRAND : Ui.CARD, Ui.dp(this, 99))));
            ch.setPadding(Ui.dp(this, 14), Ui.dp(this, 8), Ui.dp(this, 14), Ui.dp(this, 8)); ch.setClickable(true);
            ch.setOnClickListener(v -> { folder = x[0]; selOff(); render(); listView.scrollToPosition(0); });
            if (x[0].startsWith("u:") && !ro) ch.setOnLongClickListener(v -> { folderMenu(v, x[0].substring(2)); return true; });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.rightMargin = Ui.dp(this, 8); chips.addView(ch, lp);
        }
        if (!ro) {
            TextView nf = Ui.text(this, "+ Папка", 14, Ui.BRAND, true); nf.setBackground(Ui.press(this, Ui.round(Ui.BRAND_SOFT, Ui.dp(this, 99))));
            nf.setPadding(Ui.dp(this, 14), Ui.dp(this, 8), Ui.dp(this, 14), Ui.dp(this, 8)); nf.setClickable(true); nf.setOnClickListener(v -> newFolder(null));
            chips.addView(nf);
        }

        List<JSONObject> L = MailApi.list(this, folder, box, query);
        /* выбранные письма, которых в папке больше нет (переложили, Наталья отметила) — снять выбор */
        if (selMode) { Set<String> have = new java.util.HashSet<>(); for (JSONObject r : L) have.add(r.optString("id")); sel.retainAll(have); if (sel.isEmpty()) selMode = false; }
        selSync();
        List<Object> items = new ArrayList<>(); String lastDay = null;
        for (JSONObject r : L) { String d = MailApi.day(MailApi.date(r.optString("date"))); if (!d.equals(lastDay)) { items.add(d); lastDay = d; } items.add(r); }
        if (items.isEmpty()) items.add(MailApi.at == 0 && MailApi.rows.length() == 0 ? (syncing ? "@Загружаю письма…" : "@Писем пока нет") : query.isEmpty() ? "@В папке «" + MailApi.folderName(folder) + "» писем нет" : "@Ничего не нашлось");
        adapter.set(items);
    }

    /* ---------- выбор нескольких писем ---------- */
    void selOn(String id) { if (MailApi.ro(this)) return; selMode = true; sel.add(id); selSync(); adapter.notifyDataSetChanged(); }
    void selOff() { if (!selMode && sel.isEmpty()) return; selMode = false; sel.clear(); selSync(); if (adapter != null) adapter.notifyDataSetChanged(); }
    void toggle(String id) { if (sel.contains(id)) sel.remove(id); else sel.add(id); if (sel.isEmpty()) selMode = false; selSync(); adapter.notifyDataSetChanged(); }
    void selSync() {
        bar.setVisibility(selMode ? View.INVISIBLE : View.VISIBLE); selBar.setVisibility(selMode ? View.VISIBLE : View.GONE);
        selCount.setText(String.valueOf(sel.size())); selCount.setContentDescription("Выбрано писем: " + sel.size());
        boolean any = selAnyUnread(); selRead.setImageResource(any ? R.drawable.ic_mail_open : R.drawable.ic_mail); selRead.setContentDescription(any ? "Прочитано" : "Не прочитано");
        if (fab != null) fab.setVisibility(selMode || MailApi.ro(this) ? View.GONE : View.VISIBLE);
    }
    boolean selAnyUnread() { for (JSONObject r : selRows()) if (MailApi.unread(this, r)) return true; return false; }
    List<JSONObject> selRows() { List<JSONObject> L = new ArrayList<>(); for (String id : sel) { JSONObject r = MailApi.find(id); if (r != null) L.add(r); } return L; }
    void selAct(String act) { List<JSONObject> L = selRows(); Act.Undo u = Act.apply(this, L, act, this::render); selOff(); render(); showUndo(u); }
    void selMenu(View anchor) {
        PopupMenu m = new PopupMenu(this, anchor);
        m.getMenu().add(0, 1, 0, "Выбрать все в папке");
        m.getMenu().add(0, 2, 0, "Не обработано");
        m.getMenu().add(0, 3, 0, "Снять пометки «Обработано / Не обработано»");
        m.getMenu().add(0, 4, 0, selAnyUnread() ? "Прочитано" : "Не прочитано");
        m.getMenu().add(0, 5, 0, folder.equals("spam") ? "Не спам" : "Это спам");
        m.setOnMenuItemClickListener(it -> {
            switch (it.getItemId()) {
                case 1: for (JSONObject r : MailApi.list(this, folder, box, query)) sel.add(r.optString("id")); selSync(); adapter.notifyDataSetChanged(); break;
                case 2: selAct("todo"); break;
                case 3: selAct("unmark"); break;
                case 4: selAct(selAnyUnread() ? "read" : "unread"); break;
                case 5: selAct(folder.equals("spam") ? "nospam" : "spam"); break;
            }
            return true;
        });
        m.show();
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
        TextView av, who, time, subj, snip; LinearLayout tags; View dotNew; ImageView ans; JSONObject r;
        Row(Context c) {
            super(c); setOrientation(HORIZONTAL); setPadding(Ui.dp(c, 16), Ui.dp(c, 10), Ui.dp(c, 16), Ui.dp(c, 10));
            setClickable(true);
            av = Ui.avatar(c, "", "", 42); LayoutParams alp = (LayoutParams) av.getLayoutParams(); alp.rightMargin = Ui.dp(c, 12); alp.topMargin = Ui.dp(c, 2); addView(av, alp);
            av.setOnClickListener(v -> { if (r == null || MailApi.ro(getContext())) { if (r != null) openLetter(r); return; } if (selMode) toggle(r.optString("id")); else selOn(r.optString("id")); });
            LinearLayout col = new LinearLayout(c); col.setOrientation(VERTICAL);
            LinearLayout l1 = new LinearLayout(c); l1.setGravity(Gravity.CENTER_VERTICAL);
            who = Ui.line(c, "", 16, Ui.INK, false, 1); l1.addView(who, new LayoutParams(0, -2, 1));
            ans = new ImageView(c); ans.setImageDrawable(tint(R.drawable.ic_reply, Ui.MUTED)); LayoutParams anl = new LayoutParams(Ui.dp(c, 15), Ui.dp(c, 15)); anl.rightMargin = Ui.dp(c, 6); l1.addView(ans, anl);
            dotNew = Ui.dot(c, Ui.BLUE, 8); ((LayoutParams) dotNew.getLayoutParams()).rightMargin = Ui.dp(c, 6); l1.addView(dotNew);
            time = Ui.line(c, "", 13, Ui.MUTED, false, 1); l1.addView(time);
            subj = Ui.line(c, "", 15, Ui.INK, false, 1);
            snip = Ui.line(c, "", 14, Ui.MUTED, false, 2);
            tags = new LinearLayout(c); tags.setGravity(Gravity.CENTER_VERTICAL);
            col.addView(l1); col.addView(subj); col.addView(snip); col.addView(tags);
            addView(col, new LayoutParams(0, -2, 1));
            setOnClickListener(v -> { if (r == null) return; if (selMode) toggle(r.optString("id")); else openLetter(r); });
            setOnLongClickListener(v -> { if (r == null) return true; if (MailApi.ro(getContext())) { actions(r); return true; } if (selMode) toggle(r.optString("id")); else selOn(r.optString("id")); return true; });
        }
        void bind(JSONObject x) {
            r = x; Context c = getContext(); boolean un = MailApi.unread(c, x), sent = MailApi.sent(x), picked = sel.contains(x.optString("id"));
            String name = sent ? "Кому: " + x.optString("to").replaceAll("<[^>]*>", "").trim() : x.optString("fromName").isEmpty() ? x.optString("from") : x.optString("fromName");
            if (picked) { av.setText("✓"); av.setTextColor(Color.WHITE); android.graphics.drawable.GradientDrawable g = new android.graphics.drawable.GradientDrawable(); g.setShape(android.graphics.drawable.GradientDrawable.OVAL); g.setColor(Ui.BRAND); av.setBackground(g); }
            else { TextView a2 = Ui.avatar(c, sent ? x.optString("to") : x.optString("fromName"), sent ? x.optString("to") : x.optString("from"), 42);
                av.setText(a2.getText()); av.setTextColor(a2.getCurrentTextColor()); av.setBackground(a2.getBackground()); }
            setBackground(Ui.press(c, picked ? Ui.round(Ui.BRAND_SOFT, 0) : null));
            who.setText(name); who.setTypeface(Typeface.create(un ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL)); who.setTextColor(un ? Ui.INK : 0xFF3A3632);
            subj.setText(x.optString("subject").isEmpty() ? "(без темы)" : x.optString("subject")); subj.setTypeface(Typeface.create(un ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
            snip.setText(x.optString("snippet")); snip.setVisibility(x.optString("snippet").isEmpty() ? GONE : VISIBLE);
            time.setText(MailApi.shortTime(MailApi.date(x.optString("date")))); time.setTextColor(un ? Ui.BLUE : Ui.MUTED);
            dotNew.setVisibility(un ? VISIBLE : GONE);
            ans.setVisibility(!x.optString("ans").isEmpty() ? VISIBLE : GONE);
            tags.removeAllViews();
            if (MailApi.acc.length() > 1) { View d = Ui.dot(c, Ui.boxColor(x.optString("acc")), 7); ((LayoutParams) d.getLayoutParams()).rightMargin = Ui.dp(c, 6); tags.addView(d); }
            if (MailApi.isOrd(x)) addTag(Ui.chip(c, "taken".equals(MailApi.ord(x).optString("st")) ? "Документы сделаны" : "Заявка", Ui.ORD, Ui.ORD_BG));
            if (MailApi.done(x)) addTag(Ui.chip(c, "✓ Обработано", Ui.OK, Ui.OK_BG));
            else if (MailApi.todo(x)) addTag(Ui.chip(c, "Не обработано", Ui.TODO, Ui.TODO_BG));
            if ("no".equals(MailApi.tagKind(x)) && !sent) addTag(Ui.chip(c, "не заказчик", Ui.MUTED, 0xFFECE8E2));
            if (folder.equals("all")) { String w = MailApi.spam(x) ? "Спам" : MailApi.minor(x) ? "Неважные" : sent ? "Отправленные" : !MailApi.fld(x).isEmpty() ? MailApi.folderName("u:" + MailApi.fld(x)) : ""; if (!w.isEmpty()) addTag(Ui.chip(c, w, Ui.MUTED, 0xFFECE8E2)); }
            if (MailApi.atts(x).length() > 0) { ImageView cl = new ImageView(c); cl.setImageDrawable(tint(R.drawable.ic_clip, Ui.MUTED)); LayoutParams lp = new LayoutParams(Ui.dp(c, 16), Ui.dp(c, 16)); lp.rightMargin = Ui.dp(c, 4); tags.addView(cl, lp);
                tags.addView(Ui.line(c, x.optString("attsText"), 12, Ui.MUTED, false, 1), new LayoutParams(0, -2, 1)); }
            tags.setVisibility(tags.getChildCount() > 0 ? VISIBLE : GONE);
            ((LayoutParams) tags.getLayoutParams()).topMargin = Ui.dp(c, 4);
            setAlpha(MailApi.spam(x) || MailApi.minor(x) ? 0.72f : 1f);
        }
        void addTag(View v) { LayoutParams lp = new LayoutParams(-2, -2); lp.rightMargin = Ui.dp(getContext(), 6); tags.addView(v, lp); }
    }

    /* ---------- смахивания ---------- */
    String leftAct(JSONObject r) { return MailApi.spam(r) ? "nospam" : MailApi.minor(r) ? "major" : "minor"; }
    class SwipeCb extends ItemTouchHelper.SimpleCallback {
        final Paint pt = new Paint(Paint.ANTI_ALIAS_FLAG), tx = new Paint(Paint.ANTI_ALIAS_FLAG);
        SwipeCb() { super(0, ItemTouchHelper.LEFT | ItemTouchHelper.RIGHT); tx.setColor(Color.WHITE); tx.setTextSize(Ui.dp(MainActivity.this, 15)); tx.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); }
        JSONObject rowOf(RecyclerView.ViewHolder h) { return h.itemView instanceof Row ? ((Row) h.itemView).r : null; }
        @Override public int getSwipeDirs(RecyclerView rv, RecyclerView.ViewHolder h) {
            JSONObject r = rowOf(h); if (r == null || selMode || MailApi.ro(MainActivity.this) || MailApi.sent(r)) return 0; return super.getSwipeDirs(rv, h);
        }
        @Override public boolean onMove(RecyclerView rv, RecyclerView.ViewHolder a, RecyclerView.ViewHolder b) { return false; }
        @Override public float getSwipeThreshold(RecyclerView.ViewHolder h) { return 0.35f; }
        @Override public void onSelectedChanged(RecyclerView.ViewHolder h, int state) { super.onSelectedChanged(h, state); if (state == ItemTouchHelper.ACTION_STATE_SWIPE) { swiping = true; swipe.setEnabled(false); } }
        @Override public void clearView(RecyclerView rv, RecyclerView.ViewHolder h) {
            super.clearView(rv, h); swiping = false; swipe.setEnabled(true);
            if (drawLater) ui.post(MainActivity.this::render);
        }
        @Override public void onSwiped(RecyclerView.ViewHolder h, int dir) {
            JSONObject r = rowOf(h); swiping = false; swipe.setEnabled(true);
            if (r == null) { render(); return; }
            String act = dir == ItemTouchHelper.RIGHT ? (MailApi.unread(MainActivity.this, r) ? "read" : "unread") : leftAct(r);
            Act.Undo u = Act.one(MainActivity.this, r, act, MainActivity.this::render); render(); showUndo(u);
        }
        @Override public void onChildDraw(Canvas c, RecyclerView rv, RecyclerView.ViewHolder h, float dX, float dY, int state, boolean active) {
            JSONObject r = rowOf(h); View v = h.itemView;
            if (r != null && dX != 0) {
                boolean right = dX > 0; String act = right ? (MailApi.unread(MainActivity.this, r) ? "read" : "unread") : leftAct(r);
                String t = act.equals("read") ? "Прочитано" : act.equals("unread") ? "Не прочитано" : act.equals("minor") ? "В «Неважные»" : act.equals("major") ? "Во «Входящие»" : "Не спам";
                pt.setColor(right ? Ui.BLUE : act.equals("minor") ? 0xFF8A7E6E : Ui.OK);
                RectF bg = right ? new RectF(v.getLeft(), v.getTop(), v.getLeft() + dX, v.getBottom()) : new RectF(v.getRight() + dX, v.getTop(), v.getRight(), v.getBottom());
                c.drawRect(bg, pt);
                float y = v.getTop() + v.getHeight() / 2f - (tx.descent() + tx.ascent()) / 2f, w = tx.measureText(t), pad = Ui.dp(MainActivity.this, 22);
                if (Math.abs(dX) > w + pad) c.drawText(t, right ? v.getLeft() + pad : v.getRight() - pad - w, y, tx);
            }
            super.onChildDraw(c, rv, h, dX, dY, state, active);
        }
    }

    void openLetter(JSONObject r) { if (r != null) startActivity(new Intent(this, LetterActivity.class).putExtra("id", r.optString("id")).putExtra("folder", folder)); }
    void compose(String kind, String id) { startActivity(new Intent(this, ComposeActivity.class).putExtra("kind", kind).putExtra("id", id).putExtra("acc", box)); }

    /* меню письма (у Гриши и Склада — по долгому нажатию) */
    void actions(JSONObject r) {
        if (r == null) return;
        List<String> L = new ArrayList<>(); List<Runnable> A = new ArrayList<>();
        L.add("Открыть"); A.add(() -> openLetter(r));
        if (!MailApi.ro(this) && !MailApi.sent(r)) {
            boolean un = MailApi.unread(this, r);
            L.add(un ? "Отметить прочитанным" : "Отметить непрочитанным"); A.add(() -> showUndo(Act.one(this, r, un ? "read" : "unread", this::render)));
            L.add(MailApi.done(r) ? "Снять «Обработано»" : "Обработано"); A.add(() -> showUndo(Act.one(this, r, MailApi.done(r) ? "unmark" : "done", this::render)));
            L.add(MailApi.minor(r) ? "Вернуть во «Входящие»" : "В «Неважные»"); A.add(() -> showUndo(Act.one(this, r, MailApi.minor(r) ? "major" : "minor", this::render)));
            L.add("В папку…"); A.add(() -> pickFolder(java.util.Collections.singletonList(r)));
            L.add(MailApi.spam(r) ? "Не спам" : "Это спам"); A.add(() -> showUndo(Act.one(this, r, MailApi.spam(r) ? "nospam" : "spam", this::render)));
            L.add("Ответить"); A.add(() -> compose("reply", r.optString("id")));
            L.add("Переслать"); A.add(() -> compose("fwd", r.optString("id")));
        }
        L.add("Открыть на сайте"); A.add(() -> web(r.optString("id"), ""));
        String head = (r.optString("fromName").isEmpty() ? r.optString("from") : r.optString("fromName")) + " — " + r.optString("subject");
        new AlertDialog.Builder(this).setTitle(head).setItems(L.toArray(new String[0]), (d, w) -> A.get(w).run()).show();
    }

    void web(String id, String how) { startActivity(new Intent(this, WebActivity.class).putExtra("mail", id).putExtra("how", how)); }

    /* ---------- папки ---------- */
    void pickFolder(List<JSONObject> L) {
        if (L.isEmpty()) return;
        List<String> names = new ArrayList<>(), ids = new ArrayList<>();
        for (int i = 0; i < MailApi.folders.length(); i++) { JSONObject f = MailApi.folders.optJSONObject(i); if (f != null) { names.add(f.optString("name")); ids.add(f.optString("id")); } }
        names.add("Во «Входящие» (убрать из папки)"); ids.add("");
        names.add("+ Новая папка…"); ids.add("+");
        new AlertDialog.Builder(this).setTitle(L.size() == 1 ? "Переложить письмо в папку" : "Переложить " + L.size() + " " + Act.plural(L.size(), "письмо", "письма", "писем"))
            .setItems(names.toArray(new String[0]), (d, w) -> {
                String f = ids.get(w);
                if (f.equals("+")) { newFolder(L); return; }
                Act.Undo u = Act.apply(this, L, "fld:" + f, this::render); selOff(); render(); showUndo(u);
            }).show();
    }

    void ask(String title, String value, String ok, java.util.function.Consumer<String> done) {
        EditText e = new EditText(this); e.setSingleLine(); e.setText(value); e.setSelection(value.length()); e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        FrameLayout bx = new FrameLayout(this); bx.setPadding(Ui.dp(this, 20), Ui.dp(this, 8), Ui.dp(this, 20), 0); bx.addView(e);
        AlertDialog d = new AlertDialog.Builder(this).setTitle(title).setView(bx).setPositiveButton(ok, null).setNegativeButton("Отмена", null).create();
        d.setOnShowListener(x -> {
            e.requestFocus(); InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE); if (im != null) e.postDelayed(() -> im.showSoftInput(e, 0), 150);
            d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> { String s = e.getText().toString().replaceAll("\\s+", " ").trim(); if (s.isEmpty()) { e.setError("Впишите название"); return; } d.dismiss(); done.accept(s); });
        });
        d.show();
    }

    /** сохранить список папок в таблицу; не получилось — вернуть как было */
    void foldersSave(JSONArray L, JSONArray before, String okText, Runnable after) {
        MailApi.folders = L; render();
        if (MailApi.demo) { if (okText != null) showSnack(okText, null, null); if (after != null) after.run(); return; }
        IO.execute(() -> {
            String e = null; try { MailApi.saveFolders(this, L); } catch (Exception x) { e = x.getMessage(); }
            final String err = e;
            ui.post(() -> {
                if (err != null) { MailApi.folders = before; render(); Toast.makeText(this, "Папки не сохранились: " + (err.contains("unknown op") ? "скрипт таблицы старый — обновите Code.gs" : err), Toast.LENGTH_LONG).show(); return; }
                if (okText != null) showSnack(okText, null, null);
                if (after != null) after.run(); render();
            });
        });
    }

    void newFolder(List<JSONObject> move) {
        ask("Новая папка", "", "Создать", name -> {
            for (int i = 0; i < MailApi.folders.length(); i++) if (name.equalsIgnoreCase(MailApi.folders.optJSONObject(i).optString("name"))) { Toast.makeText(this, "Такая папка уже есть", Toast.LENGTH_SHORT).show(); return; }
            String id = "f" + Long.toString(System.currentTimeMillis(), 36).substring(3) + Integer.toString((int) (Math.random() * 1296), 36);
            JSONArray before = MailApi.folders, L = new JSONArray();
            for (int i = 0; i < before.length(); i++) L.put(before.optJSONObject(i));
            try { L.put(new JSONObject().put("id", id).put("name", name)); } catch (Exception ignored) {}
            foldersSave(L, before, "Папка «" + name + "» создана", () -> {
                if (move != null && !move.isEmpty()) { Act.Undo u = Act.apply(this, move, "fld:" + id, this::render); selOff(); render(); showUndo(u); }
            });
        });
    }

    void folderMenu(View anchor, String id) {
        PopupMenu m = new PopupMenu(this, anchor);
        m.getMenu().add(0, 1, 0, "Переименовать папку"); m.getMenu().add(0, 2, 0, "Удалить папку");
        m.setOnMenuItemClickListener(it -> { if (it.getItemId() == 1) renameFolder(id); else deleteFolder(id); return true; });
        m.show();
    }

    void renameFolder(String id) {
        String old = MailApi.folderName("u:" + id);
        ask("Переименовать папку", old, "Сохранить", name -> {
            JSONArray before = MailApi.folders, L = new JSONArray();
            for (int i = 0; i < before.length(); i++) { JSONObject f = before.optJSONObject(i); try { L.put(f.optString("id").equals(id) ? new JSONObject(f.toString()).put("name", name) : f); } catch (Exception ignored) {} }
            foldersSave(L, before, "Папка переименована", null);
        });
    }

    void deleteFolder(String id) {
        String name = MailApi.folderName("u:" + id); List<JSONObject> inside = MailApi.list(this, "u:" + id, "", "");
        new AlertDialog.Builder(this).setTitle("Удалить папку «" + name + "»?")
            .setMessage(inside.isEmpty() ? "Папка пустая." : inside.size() + " " + Act.plural(inside.size(), "письмо вернётся", "письма вернутся", "писем вернутся") + " во «Входящие». Сами письма не удаляются.")
            .setPositiveButton("Удалить", (d, w) -> {
                if (!inside.isEmpty()) Act.apply(this, inside, "fld:", this::render);
                JSONArray before = MailApi.folders, L = new JSONArray();
                for (int i = 0; i < before.length(); i++) if (!before.optJSONObject(i).optString("id").equals(id)) L.put(before.optJSONObject(i));
                if (folder.equals("u:" + id)) folder = "in";
                foldersSave(L, before, "Папка «" + name + "» удалена", null);
            }).setNegativeButton("Отмена", null).show();
    }

    void pickBox() {
        if (MailApi.acc.length() < 2) return;
        List<String> L = new ArrayList<>(); List<String> ids = new ArrayList<>();
        L.add("Все ящики"); ids.add("");
        for (int i = 0; i < MailApi.acc.length(); i++) { JSONObject a = MailApi.acc.optJSONObject(i); L.add(a.optString("email") + (a.optString("err").isEmpty() ? "" : "  ⚠")); ids.add(a.optString("id")); }
        new AlertDialog.Builder(this).setTitle("Какой ящик показать").setItems(L.toArray(new String[0]), (d, w) -> { box = ids.get(w); selOff(); render(); }).show();
    }

    void readAll() {
        List<JSONObject> L = new ArrayList<>(); for (JSONObject r : MailApi.list(this, folder, box, query)) if (MailApi.unread(this, r)) L.add(r);
        if (L.isEmpty()) { showSnack("Здесь всё прочитано", null, null); return; }
        showUndo(Act.apply(this, L, "read", this::render)); render();
    }

    void menu(View anchor) {
        boolean ro = MailApi.ro(this);
        PopupMenu m = new PopupMenu(this, anchor);
        m.getMenu().add(0, 1, 0, "Проверить почту");
        if (!ro) { m.getMenu().add(0, 6, 0, "Прочитать все в «" + MailApi.folderName(folder) + "»"); m.getMenu().add(0, 7, 0, "Выбрать письма"); }
        if (MailApi.acc.length() > 1) m.getMenu().add(0, 2, 0, "Ящик: " + (box.isEmpty() ? "все" : MailApi.accOf(box) == null ? "" : MailApi.accOf(box).optString("email")));
        if (!ro) m.getMenu().add(0, 8, 0, "Новая папка");
        if (!ro && folder.startsWith("u:")) { m.getMenu().add(0, 9, 0, "Переименовать папку"); m.getMenu().add(0, 10, 0, "Удалить папку"); }
        m.getMenu().add(0, 4, 0, "Уведомления о письмах");
        if (!ro) m.getMenu().add(0, 11, 0, "Ящики и посредник (на сайте)");
        m.getMenu().add(0, 3, 0, "Открыть почту на сайте");
        m.getMenu().add(0, 5, 0, "Выйти из «" + MailApi.user(this) + "»");
        m.setOnMenuItemClickListener(it -> {
            switch (it.getItemId()) {
                case 1: refresh(true); break;
                case 2: pickBox(); break;
                case 3: web("", "in"); break;
                case 4: startActivity(new Intent(this, MailSettingsActivity.class)); break;
                case 6: readAll(); break;
                case 7: { List<JSONObject> L = MailApi.list(this, folder, box, query); if (!L.isEmpty()) selOn(L.get(0).optString("id")); else showSnack("В папке нет писем", null, null); break; }
                case 8: newFolder(null); break;
                case 9: renameFolder(folder.substring(2)); break;
                case 10: deleteFolder(folder.substring(2)); break;
                case 11: web("", "set"); break;
                case 5: new AlertDialog.Builder(this).setMessage("Выйти из «Почты ФД»? Уведомления о письмах перестанут приходить, пока не войдёте снова.")
                    .setPositiveButton("Выйти", (d, w) -> { MailApi.forget(this); startActivity(new Intent(this, WebActivity.class).putExtra("login", true).putExtra("how", "logout")); })
                    .setNegativeButton("Отмена", null).show(); break;
            }
            return true;
        });
        m.show();
    }

    @Override public void onBackPressed() {
        if (selMode) { selOff(); return; }
        if (searchRow.getVisibility() == View.VISIBLE) { openSearch(false); return; }
        if (!folder.equals("in")) { folder = "in"; render(); return; }
        super.onBackPressed();
    }
}
