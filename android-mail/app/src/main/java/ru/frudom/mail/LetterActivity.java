package ru.frudom.mail;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.util.Linkify;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;

/** «Почта ФД» — настоящий экран письма: тема, отправитель, кому, дата, ящик, текст (или «Как в письме»), вложения.
 *  Сверху — прочитано, неважные, спам, «⋮» (обработано, открыть на сайте). Снизу — «Ответить / Всем / Переслать» (сайтом). */
public class LetterActivity extends Activity {
    static final Map<String, JSONObject> BODY = new HashMap<>();   // полный текст уже открытых писем
    JSONObject r;
    String id;
    LinearLayout body, top;
    TextView textView;
    WebView html;
    boolean asHtml, imgs;
    ImageButton bRead, bMinor, bSpam;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 23) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        id = getIntent().getStringExtra("id"); if (id == null) id = "";
        MailNotifier.dismiss(this, id);
        if (MailApi.rows.length() == 0) MailApi.loadCache(this);
        r = MailApi.find(id);
        if (r == null) { loading(); MainActivity.IO.execute(() -> {
            try { MailApi.load(this, false); } catch (Exception ignored) {}
            JSONObject x = MailApi.find(id);
            runOnUiThread(() -> { if (x == null) { Toast.makeText(this, "Письмо не нашлось на телефоне — открываю на сайте", Toast.LENGTH_LONG).show(); web(""); finish(); } else { r = x; build(); } });
        }); return; }
        build();
    }

    void loading() {
        FrameLayout f = new FrameLayout(this); f.setBackgroundColor(Ui.BG);
        ProgressBar p = new ProgressBar(this); f.addView(p, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER)); setContentView(f);
    }

    void build() {
        boolean ro = MailApi.ro(this), sent = MailApi.sent(r);
        if (MailApi.unread(this, r)) Act.read(this, r, true, () -> {});

        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Ui.BG);
        top = new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4), 0);
        top.addView(Ui.icon(this, R.drawable.ic_back, "Назад", v -> finish()));
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1));
        if (!ro && !sent) {
            bRead = Ui.icon(this, R.drawable.ic_mail, "Не прочитано", v -> { boolean un = MailApi.unread(this, r); Act.read(this, r, un, this::marks); if (!un) { Toast.makeText(this, "Отмечено непрочитанным", Toast.LENGTH_SHORT).show(); finish(); } });
            bMinor = Ui.icon(this, R.drawable.ic_archive, "В «Неважные»", v -> { boolean on = !MailApi.minor(r); Act.minor(this, r, on, this::marks); if (on) finish(); });
            bSpam = Ui.icon(this, R.drawable.ic_spam, "Это спам", v -> { boolean on = !MailApi.spam(r); Act.spam(this, r, on, this::marks); if (on) finish(); });
            top.addView(bRead); top.addView(bMinor); top.addView(bSpam);
        }
        top.addView(Ui.icon(this, R.drawable.ic_more, "Ещё", this::menu));
        root.addView(top);

        ScrollView sv = new ScrollView(this); sv.setFillViewport(true);
        body = new LinearLayout(this); body.setOrientation(LinearLayout.VERTICAL); body.setPadding(Ui.dp(this, 18), Ui.dp(this, 4), Ui.dp(this, 18), Ui.dp(this, 24));
        sv.addView(body); root.addView(sv, new LinearLayout.LayoutParams(-1, 0, 1));

        /* тема */
        TextView subj = Ui.text(this, r.optString("subject").isEmpty() ? "(без темы)" : r.optString("subject"), 22, Ui.INK, true);
        subj.setTextIsSelectable(true); subj.setLineSpacing(0, 1.1f); body.addView(subj);
        LinearLayout marks = new LinearLayout(this); marks.setId(View.generateViewId()); marks.setTag("marks"); body.addView(marks);

        /* отправитель */
        LinearLayout from = new LinearLayout(this); from.setGravity(Gravity.CENTER_VERTICAL); from.setPadding(0, Ui.dp(this, 14), 0, Ui.dp(this, 6));
        TextView av = Ui.avatar(this, r.optString("fromName"), r.optString("from"), 42); ((LinearLayout.LayoutParams) av.getLayoutParams()).rightMargin = Ui.dp(this, 12); from.addView(av);
        LinearLayout fc = new LinearLayout(this); fc.setOrientation(LinearLayout.VERTICAL);
        LinearLayout l1 = new LinearLayout(this); l1.setGravity(Gravity.CENTER_VERTICAL);
        l1.addView(Ui.line(this, r.optString("fromName").isEmpty() ? r.optString("from") : r.optString("fromName"), 16, Ui.INK, true, 1), new LinearLayout.LayoutParams(0, -2, 1));
        l1.addView(Ui.line(this, MailApi.shortTime(MailApi.date(r.optString("date"))), 13, Ui.MUTED, false, 1));
        fc.addView(l1);
        TextView em = Ui.line(this, r.optString("from"), 13, Ui.MUTED, false, 1); em.setTextIsSelectable(true); fc.addView(em);
        from.addView(fc, new LinearLayout.LayoutParams(0, -2, 1));
        body.addView(from);

        /* подробности: кому, копия, дата, ящик */
        StringBuilder d = new StringBuilder();
        d.append("Кому: ").append(r.optString("to"));
        if (!r.optString("cc").isEmpty()) d.append("\nКопия: ").append(r.optString("cc"));
        d.append("\n").append(MailApi.full(MailApi.date(r.optString("date"))));
        TextView det = Ui.text(this, d.toString(), 13, Ui.MUTED, false); det.setTextIsSelectable(true); det.setLineSpacing(0, 1.15f); body.addView(det);
        if (!r.optString("box").isEmpty() || MailApi.acc.length() > 1) {
            JSONObject a = MailApi.accOf(r.optString("acc"));
            TextView bx = Ui.chip(this, a != null ? a.optString("email") : r.optString("box"), Ui.boxColor(r.optString("acc")), 0xFFF0ECE6);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.topMargin = Ui.dp(this, 8); body.addView(bx, lp);
        }

        /* заявка — документы делаются на сайте */
        if (MailApi.isOrd(r) && !ro) {
            LinearLayout o = new LinearLayout(this); o.setOrientation(LinearLayout.VERTICAL); o.setBackground(Ui.round(Ui.ORD_BG, Ui.dp(this, 14)));
            o.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 12));
            o.addView(Ui.text(this, "Похоже на заявку", 15, Ui.ORD, true));
            o.addView(Ui.text(this, "Документы из этого письма сайт сделает сам — выберет заказчика и прочитает вложение.", 13, Ui.ORD, false));
            TextView go = Ui.button(this, "Сделать документы на сайте", true, v -> web("")); LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(-2, -2); glp.topMargin = Ui.dp(this, 8); o.addView(go, glp);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.topMargin = Ui.dp(this, 14); body.addView(o, lp);
        }

        /* текст письма */
        View sep = new View(this); sep.setBackgroundColor(Ui.LINE); LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(-1, 1); slp.setMargins(0, Ui.dp(this, 16), 0, Ui.dp(this, 12)); body.addView(sep, slp);
        LinearLayout sw = new LinearLayout(this); sw.setTag("sw"); sw.setVisibility(View.GONE); body.addView(sw);
        textView = Ui.text(this, r.optString("snippet"), 16, Ui.INK, false); textView.setTextIsSelectable(true); textView.setLineSpacing(0, 1.25f);
        textView.setAutoLinkMask(Linkify.WEB_URLS | Linkify.EMAIL_ADDRESSES | Linkify.PHONE_NUMBERS); textView.setLinkTextColor(Ui.BLUE);
        body.addView(textView);
        html = new WebView(this); html.setVisibility(View.GONE); html.setBackgroundColor(Color.TRANSPARENT);
        WebSettings ws = html.getSettings(); ws.setJavaScriptEnabled(false); ws.setBlockNetworkImage(true); ws.setLoadWithOverviewMode(true); ws.setUseWideViewPort(true); ws.setTextZoom(100);
        ws.setAllowFileAccess(false); ws.setAllowContentAccess(false);
        html.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest q) { try { startActivity(new Intent(Intent.ACTION_VIEW, q.getUrl())); } catch (Exception ignored) {} return true; }
        });
        body.addView(html, new LinearLayout.LayoutParams(-1, -2));

        /* вложения */
        JSONArray at = MailApi.atts(r);
        if (at.length() > 0) {
            TextView h = Ui.text(this, at.length() == 1 ? "Вложение" : "Вложения · " + at.length(), 14, Ui.MUTED, true);
            LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(-2, -2); hlp.topMargin = Ui.dp(this, 20); body.addView(h, hlp);
            for (int i = 0; i < at.length(); i++) {
                JSONObject x = at.optJSONObject(i); if (x == null) continue; final int k = i;
                LinearLayout row = new LinearLayout(this); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(Ui.dp(this, 12), Ui.dp(this, 10), Ui.dp(this, 12), Ui.dp(this, 10));
                row.setBackground(Ui.press(this, Ui.round(Ui.CARD, Ui.dp(this, 14)))); row.setClickable(true);
                ImageView ic = new ImageView(this); Drawable_tint(ic, R.drawable.ic_file); row.addView(ic, new LinearLayout.LayoutParams(Ui.dp(this, 26), Ui.dp(this, 26)));
                LinearLayout c = new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setPadding(Ui.dp(this, 12), 0, 0, 0);
                c.addView(Ui.line(this, x.optString("n"), 15, Ui.INK, true, 2));
                c.addView(Ui.line(this, (x.optLong("s") > 0 ? MailApi.size(x.optLong("s")) + " · " : "") + "нажмите, чтобы открыть", 12, Ui.MUTED, false, 1));
                row.addView(c, new LinearLayout.LayoutParams(0, -2, 1));
                row.setOnClickListener(v -> attachment(k, x, false));
                row.setOnLongClickListener(v -> { attachment(k, x, true); return true; });
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.topMargin = Ui.dp(this, 8); body.addView(row, lp);
            }
        }

        /* ответить / всем / переслать — сайтом, в том же окне */
        if (!ro && !sent) {
            LinearLayout bot = new LinearLayout(this); bot.setPadding(Ui.dp(this, 12), Ui.dp(this, 8), Ui.dp(this, 12), Ui.dp(this, 12)); bot.setBackgroundColor(Ui.BG);
            TextView rep = Ui.button(this, "Ответить", true, v -> web("reply")); rep.setCompoundDrawablesRelativeWithIntrinsicBounds(tinted(R.drawable.ic_reply, Color.WHITE), null, null, null); rep.setCompoundDrawablePadding(Ui.dp(this, 6));
            bot.addView(rep, new LinearLayout.LayoutParams(0, -2, 1.3f));
            if (!r.optString("cc").isEmpty() || r.optString("to").contains(",")) { TextView all = Ui.button(this, "Всем", false, v -> web("replyall")); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1); lp.leftMargin = Ui.dp(this, 8); bot.addView(all, lp); }
            TextView fw = Ui.button(this, "Переслать", false, v -> web("fwd")); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1); lp.leftMargin = Ui.dp(this, 8); bot.addView(fw, lp);
            root.addView(bot);
        }
        setContentView(root);
        marks();
        loadBody();
    }

    android.graphics.drawable.Drawable tinted(int res, int color) { android.graphics.drawable.Drawable d = getDrawable(res).mutate(); d.setTint(color); return d; }
    void Drawable_tint(ImageView v, int res) { v.setImageDrawable(tinted(res, Ui.BRAND)); }

    /** метки под темой и состояние кнопок сверху */
    void marks() {
        LinearLayout m = body.findViewWithTag("marks"); if (m == null) return; m.removeAllViews();
        if (MailApi.isOrd(r)) add(m, Ui.chip(this, "Заявка", Ui.ORD, Ui.ORD_BG));
        JSONObject o = MailApi.ord(r);
        if (MailApi.done(r)) add(m, Ui.chip(this, "✓ Обработано · " + o.optJSONObject("done").optString("by"), Ui.OK, Ui.OK_BG));
        else if (MailApi.todo(r)) add(m, Ui.chip(this, "Не обработано · " + o.optJSONObject("todo").optString("by"), Ui.TODO, Ui.TODO_BG));
        if (MailApi.spam(r)) add(m, Ui.chip(this, "Спам", Ui.BAD, 0xFFFBEAE7));
        if (MailApi.minor(r)) add(m, Ui.chip(this, "Неважные", Ui.MUTED, 0xFFECE8E2));
        if (!MailApi.fld(r).isEmpty()) add(m, Ui.chip(this, "Папка: " + MailApi.folderName("u:" + MailApi.fld(r)), Ui.BRAND, Ui.BRAND_SOFT));
        m.setPadding(0, m.getChildCount() > 0 ? Ui.dp(this, 8) : 0, 0, 0);
        if (bRead != null) { boolean un = MailApi.unread(this, r); bRead.setImageResource(un ? R.drawable.ic_mail_open : R.drawable.ic_mail); bRead.setContentDescription(un ? "Прочитано" : "Не прочитано"); }
        if (bMinor != null) bMinor.setContentDescription(MailApi.minor(r) ? "Во «Входящие»" : "В «Неважные»");
        if (bSpam != null) bSpam.setContentDescription(MailApi.spam(r) ? "Не спам" : "Это спам");
    }
    void add(LinearLayout m, View v) { LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.rightMargin = Ui.dp(this, 6); m.addView(v, lp); }

    /** полный текст письма (из таблицы; уже открытые — сразу) */
    void loadBody() {
        JSONObject have = BODY.get(id);
        if (have != null) { showBody(have); return; }
        textView.setText(r.optString("snippet") + (r.optString("snippet").isEmpty() ? "Загружаю письмо…" : "\n\n…загружаю письмо целиком"));
        MainActivity.IO.execute(() -> {
            try { JSONObject j = MailApi.get(this, id); BODY.put(id, j); runOnUiThread(() -> showBody(j)); }
            catch (Exception e) { runOnUiThread(() -> textView.setText(r.optString("snippet") + "\n\n— Полный текст не загрузился: " + e.getMessage())); }
        });
    }

    void showBody(JSONObject j) {
        String t = j.optString("text").trim(), h = j.optString("html");
        textView.setText(t.isEmpty() ? (h.isEmpty() ? r.optString("snippet") : "") : t);
        if (!j.optString("err").isEmpty()) textView.append("\n\n— " + j.optString("err"));
        LinearLayout sw = body.findViewWithTag("sw"); sw.removeAllViews();
        if (h.isEmpty()) { sw.setVisibility(View.GONE); return; }
        if (t.isEmpty()) asHtml = true;
        sw.setVisibility(View.VISIBLE); sw.setPadding(0, 0, 0, Ui.dp(this, 10));
        TextView a = seg("Текст", !asHtml, v -> { asHtml = false; showBody(j); });
        TextView b = seg("Как в письме", asHtml, v -> { asHtml = true; showBody(j); });
        sw.addView(a); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.leftMargin = Ui.dp(this, 6); sw.addView(b, lp);
        if (asHtml && !imgs) { TextView c = seg("Показать картинки", false, v -> { imgs = true; html.getSettings().setBlockNetworkImage(false); showBody(j); }); LinearLayout.LayoutParams l2 = new LinearLayout.LayoutParams(-2, -2); l2.leftMargin = Ui.dp(this, 6); sw.addView(c, l2); }
        textView.setVisibility(asHtml ? View.GONE : View.VISIBLE);
        html.setVisibility(asHtml ? View.VISIBLE : View.GONE);
        if (asHtml) html.loadDataWithBaseURL(null, "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>body{margin:0;font:16px sans-serif;color:#1f1d1a;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>" + h, "text/html", "utf-8", null);
    }

    TextView seg(String t, boolean on, View.OnClickListener l) {
        TextView v = Ui.text(this, t, 13, on ? Color.WHITE : Ui.BRAND, true); v.setBackground(Ui.press(this, Ui.round(on ? Ui.BRAND : Ui.BRAND_SOFT, Ui.dp(this, 99))));
        v.setPadding(Ui.dp(this, 12), Ui.dp(this, 6), Ui.dp(this, 12), Ui.dp(this, 6)); v.setClickable(true); v.setOnClickListener(l); return v;
    }

    /** вложение: скачать из таблицы → открыть подходящим приложением (долгое нажатие — отправить) */
    void attachment(int i, JSONObject x, boolean share) {
        Toast t = Toast.makeText(this, "Загружаю «" + x.optString("n") + "»…", Toast.LENGTH_SHORT); t.show();
        MainActivity.IO.execute(() -> {
            try {
                JSONObject j = MailApi.att(this, id, i);
                String name = (j.optString("name").isEmpty() ? x.optString("n") : j.optString("name")).replaceAll("[\\\\/:*?\"<>|\\n\\r]+", " ").trim();
                File dir = new File(getCacheDir(), "att/" + Math.abs(id.hashCode())); dir.mkdirs();
                File f = new File(dir, name.isEmpty() ? "файл" : name);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(j.optString("data"), Base64.DEFAULT)); }
                String mime = j.optString("mime"); String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
                if (mime.isEmpty() || mime.equals("application/octet-stream")) { String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext); mime = m != null ? m : "application/octet-stream"; }
                Uri u = FileProvider.getUriForFile(this, "ru.frudom.mail.files", f); final String mt = mime;
                runOnUiThread(() -> {
                    Intent in = share ? new Intent(Intent.ACTION_SEND).setType(mt).putExtra(Intent.EXTRA_STREAM, u) : new Intent(Intent.ACTION_VIEW).setDataAndType(u, mt);
                    in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); in.setClipData(ClipData.newRawUri(name, u));
                    try { startActivity(Intent.createChooser(in, share ? "Отправить файл" : "Открыть «" + name + "»")); }
                    catch (ActivityNotFoundException e) { Toast.makeText(this, "Нет приложения, чтобы открыть этот файл", Toast.LENGTH_LONG).show(); }
                });
            } catch (Exception e) { runOnUiThread(() -> Toast.makeText(this, "Файл не загрузился: " + e.getMessage(), Toast.LENGTH_LONG).show()); }
        });
    }

    void menu(View anchor) {
        PopupMenu m = new PopupMenu(this, anchor); boolean ro = MailApi.ro(this), sent = MailApi.sent(r);
        if (!ro && !sent) {
            m.getMenu().add(0, 1, 0, MailApi.done(r) ? "Снять «Обработано»" : "Обработано");
            m.getMenu().add(0, 2, 0, MailApi.unread(this, r) ? "Отметить прочитанным" : "Отметить непрочитанным");
        }
        m.getMenu().add(0, 3, 0, "Открыть на сайте (папки, заказчик, документы)");
        m.getMenu().add(0, 4, 0, "Скопировать адрес отправителя");
        m.setOnMenuItemClickListener(it -> {
            switch (it.getItemId()) {
                case 1: Act.done(this, r, !MailApi.done(r), this::marks); break;
                case 2: { boolean un = MailApi.unread(this, r); Act.read(this, r, un, this::marks); if (!un) finish(); break; }
                case 3: web(""); break;
                case 4: { android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("адрес", r.optString("from"))); Toast.makeText(this, "Скопировано: " + r.optString("from"), Toast.LENGTH_SHORT).show(); break; }
            }
            return true;
        });
        m.show();
    }

    void web(String how) { startActivity(new Intent(this, WebActivity.class).putExtra("mail", id).putExtra("how", how)); }

    @Override protected void onDestroy() { if (html != null) html.destroy(); super.onDestroy(); }
}
