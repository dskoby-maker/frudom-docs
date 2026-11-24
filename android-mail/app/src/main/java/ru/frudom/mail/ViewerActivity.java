package ru.frudom.mail;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;
import android.util.LruCache;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Locale;

/** «Почта ФД» — просмотр вложения без скачивания, как на сайте (mlViewer):
 *  PDF — страницы (увеличение двумя пальцами, двойным нажатием и кнопками), фото — с увеличением,
 *  Word (.docx) — сразу на телефоне (docx-preview из assets/docx, как на сайте); не вышло — через PDF.
 *  Старые .doc / Excel / PowerPoint / RTF / ODT — сначала в PDF через Google Диск (как на сайте), текст — как есть.
 *  Сверху: печать, сохранить в «Загрузки», отправить, открыть другим приложением. */
public class ViewerActivity extends Activity {
    final Handler ui = new Handler(Looper.getMainLooper());
    String id, name = "файл", mime = "";
    int idx;
    File orig, pdf;          // сам файл и PDF для показа / печати
    FrameLayout stage;
    TextView titleV, info, zoomV;
    float zoom = 1f;
    int baseW;
    RecyclerView pages;
    HorizontalScrollView hs;
    PdfRenderer renderer;
    ParcelFileDescriptor pfd;
    final LruCache<String, Bitmap> cache = new LruCache<String, Bitmap>(48 * 1024 * 1024) { @Override protected int sizeOf(String k, Bitmap b) { return b.getByteCount(); } };
    float[] ratio = new float[0];
    ScaleGestureDetector sg;
    GestureDetector gd;
    float pinch = 1f;
    boolean dead;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 23) getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().setStatusBarColor(0xFF201D1A); getWindow().setNavigationBarColor(0xFF201D1A);
        id = getIntent().getStringExtra("id"); idx = getIntent().getIntExtra("i", 0); if (id == null) id = "";
        if (MailApi.rows.length() == 0) MailApi.loadCache(this);
        JSONObject r = MailApi.find(id); JSONObject a = r == null ? null : MailApi.atts(r).optJSONObject(idx);
        if (a != null) name = a.optString("n", name);
        build();
        load();
    }

    void build() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(0xFF2B2824);
        LinearLayout top = new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setBackgroundColor(0xFF201D1A); top.setPadding(Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
        top.addView(white(Ui.icon(this, R.drawable.ic_back, "Назад", v -> finish())));
        LinearLayout tc = new LinearLayout(this); tc.setOrientation(LinearLayout.VERTICAL);
        titleV = Ui.line(this, name, 16, Color.WHITE, true, 1); info = Ui.line(this, "", 12, 0xFFBDB6AC, false, 1);
        tc.addView(titleV); tc.addView(info); top.addView(tc, new LinearLayout.LayoutParams(0, -2, 1));
        top.addView(white(Ui.icon(this, R.drawable.ic_print, "Печать", v -> print())));
        top.addView(white(Ui.icon(this, R.drawable.ic_download, "Сохранить в «Загрузки»", v -> save())));
        top.addView(white(Ui.icon(this, R.drawable.ic_more, "Ещё", this::menu)));
        root.addView(top);
        stage = new FrameLayout(this); root.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));

        /* увеличение — внизу */
        LinearLayout zb = new LinearLayout(this); zb.setGravity(Gravity.CENTER); zb.setBackgroundColor(0xFF201D1A); zb.setPadding(0, Ui.dp(this, 2), 0, Ui.dp(this, 2));
        zb.addView(white(Ui.icon(this, R.drawable.ic_minus, "Меньше", v -> setZoom(zoom / 1.25f))));
        zoomV = Ui.text(this, "100%", 15, Color.WHITE, true); zoomV.setGravity(Gravity.CENTER); zoomV.setMinWidth(Ui.dp(this, 72)); zoomV.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 10));
        zoomV.setClickable(true); zoomV.setBackground(Ui.press(this, null)); zoomV.setOnClickListener(v -> setZoom(1f)); zb.addView(zoomV);
        zb.addView(white(Ui.icon(this, R.drawable.ic_plus, "Больше", v -> setZoom(zoom * 1.25f))));
        zb.setTag("zb"); zb.setVisibility(View.GONE); root.addView(zb);
        setContentView(root);
        busy("Загружаю «" + name + "»…");
    }
    android.widget.ImageButton white(android.widget.ImageButton b) { b.setColorFilter(Color.WHITE); return b; }

    void busy(String t) {
        stage.removeAllViews(); LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); l.setGravity(Gravity.CENTER);
        l.addView(new ProgressBar(this)); TextView v = Ui.text(this, t, 15, 0xFFE8E2D8, false); v.setGravity(Gravity.CENTER); v.setPadding(Ui.dp(this, 24), Ui.dp(this, 12), Ui.dp(this, 24), 0); l.addView(v);
        stage.addView(l, new FrameLayout.LayoutParams(-1, -1));
    }
    void fail(String t) {
        stage.removeAllViews(); LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); l.setGravity(Gravity.CENTER); l.setPadding(Ui.dp(this, 28), 0, Ui.dp(this, 28), 0);
        TextView v = Ui.text(this, t, 16, 0xFFE8E2D8, false); v.setGravity(Gravity.CENTER); l.addView(v);
        if (orig != null) { TextView o = Ui.button(this, "Открыть другим приложением", true, x -> openWith()); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.topMargin = Ui.dp(this, 18); l.addView(o, lp); }
        else { TextView o = Ui.button(this, "Попробовать ещё раз", true, x -> { busy("Загружаю «" + name + "»…"); load(); }); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2); lp.topMargin = Ui.dp(this, 18); l.addView(o, lp); }
        stage.addView(l, new FrameLayout.LayoutParams(-1, -1));
    }

    static String ext(String n) { return n.contains(".") ? n.substring(n.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : ""; }
    static final String OFFICE = "doc docx docm rtf odt xls xlsx xlsm ods ppt pptx odp";
    static final String TEXT = "txt csv tsv json xml log md eml";
    static final String IMG = "jpg jpeg png webp gif bmp heic heif";

    void load() {
        MainActivity.IO.execute(() -> {
            try {
                JSONObject j = MailApi.att(this, id, idx);
                String n = (j.optString("name").isEmpty() ? name : j.optString("name")).replaceAll("[\\\\/:*?\"<>|\\n\\r]+", " ").trim(); if (n.isEmpty()) n = "файл";
                File dir = new File(getCacheDir(), "att/" + Math.abs(id.hashCode())); dir.mkdirs();
                File f = new File(dir, n);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(j.optString("data"), Base64.DEFAULT)); }
                String m = j.optString("mime"), e = ext(n);
                if (m.isEmpty() || m.equals("application/octet-stream")) { String g = MimeTypeMap.getSingleton().getMimeTypeFromExtension(e); m = g != null ? g : "application/octet-stream"; }
                final String nm = n, mt = m;
                ui.post(() -> { if (dead) return; name = nm; mime = mt; orig = f; titleV.setText(nm); info.setText(MailApi.size(f.length())); show(); });
            } catch (Exception x) { ui.post(() -> { if (!dead) fail("Файл не загрузился: " + x.getMessage()); }); }
        });
    }

    void show() {
        String e = ext(name);
        if (mime.equals("application/pdf") || e.equals("pdf")) { pdf = orig; showPdf(); return; }
        if (mime.startsWith("image/") || (" " + IMG + " ").contains(" " + e + " ")) { showImage(); return; }
        if (e.equals("docx") || e.equals("docm") || e.equals("dotx")) { showDocx(); return; }
        if ((" " + OFFICE + " ").contains(" " + e + " ")) { toPdf(); return; }
        if (mime.startsWith("text/") || (" " + TEXT + " ").contains(" " + e + " ") || e.equals("html") || e.equals("htm")) { showText(); return; }
        fail("Такой файл здесь не показать.\n«" + name + "» можно открыть другим приложением или сохранить.");
    }

    /** Word, Excel… — в PDF через Google Диск (Code.gs attPdf), как на сайте */
    void toPdf() {
        busy("Перевожу «" + name + "» в PDF для просмотра…\nЭто может занять до минуты");
        MainActivity.IO.execute(() -> {
            try {
                JSONObject j = MailApi.attPdf(this, id, idx);
                if (j.optString("data").isEmpty()) throw new Exception(j.optString("error", "Google Диск не перевёл файл"));
                File f = new File(orig.getParentFile(), orig.getName().replaceAll("\\.[^.]+$", "") + " (просмотр).pdf");
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(j.optString("data"), Base64.DEFAULT)); }
                ui.post(() -> { if (dead) return; pdf = f; showPdf(); });
            } catch (Exception x) {
                String m = String.valueOf(x.getMessage());
                ui.post(() -> { if (!dead) fail("Не получилось показать «" + name + "»" + (m.contains("unknown op") ? " — скрипт таблицы старый, обновите Code.gs." : ": " + m) + "\nМожно открыть другим приложением."); });
            }
        });
    }

    /* ---------- PDF ---------- */
    void showPdf() {
        try {
            closePdf(); pfd = ParcelFileDescriptor.open(pdf, ParcelFileDescriptor.MODE_READ_ONLY); renderer = new PdfRenderer(pfd);
            int n = renderer.getPageCount(); ratio = new float[n];
            for (int i = 0; i < n; i++) { PdfRenderer.Page p = renderer.openPage(i); ratio[i] = p.getHeight() / (float) Math.max(1, p.getWidth()); p.close(); }
            info.setText((n == 1 ? "1 страница" : n + " " + Act.plural(n, "страница", "страницы", "страниц")) + " · " + MailApi.size(orig.length()) + (pdf != orig ? " · переведён в PDF" : ""));
        } catch (Exception e) { fail("PDF не открылся: " + e.getMessage()); return; }
        stage.removeAllViews();
        baseW = getResources().getDisplayMetrics().widthPixels;
        hs = new HorizontalScrollView(this); hs.setFillViewport(true); hs.setHorizontalScrollBarEnabled(false);
        pages = new RecyclerView(this); pages.setLayoutManager(new LinearLayoutManager(this)); pages.setItemAnimator(null);
        pages.setAdapter(new PageAdapter());
        pages.addOnScrollListener(new RecyclerView.OnScrollListener() { @Override public void onScrolled(RecyclerView rv, int dx, int dy) { pageInfo(); } });
        hs.addView(pages, new FrameLayout.LayoutParams(baseW, -1));
        stage.addView(hs, new FrameLayout.LayoutParams(-1, -1));
        gestures(); findViewWithTagZb().setVisibility(View.VISIBLE); setZoom(1f);
    }
    View findViewWithTagZb() { return ((View) stage.getParent()).findViewWithTag("zb"); }
    void pageInfo() {
        if (pages == null || ratio.length < 2) return;
        int k = ((LinearLayoutManager) pages.getLayoutManager()).findFirstVisibleItemPosition() + 1;
        if (k > 0) info.setText("стр. " + k + " из " + ratio.length + " · " + MailApi.size(orig.length()));
    }

    class PageAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
        @Override public int getItemCount() { return ratio.length; }
        @Override public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup p, int t) {
            ImageView v = new ImageView(ViewerActivity.this); v.setBackgroundColor(Color.WHITE); v.setScaleType(ImageView.ScaleType.FIT_XY);
            return new RecyclerView.ViewHolder(v) {};
        }
        @Override public void onBindViewHolder(RecyclerView.ViewHolder h, int i) {
            ImageView v = (ImageView) h.itemView; int w = Math.round(baseW * zoom) - Ui.dp(ViewerActivity.this, 16), hh = Math.round(w * ratio[i]);
            RecyclerView.LayoutParams lp = new RecyclerView.LayoutParams(w, hh); lp.setMargins(Ui.dp(ViewerActivity.this, 8), Ui.dp(ViewerActivity.this, 8), Ui.dp(ViewerActivity.this, 8), 0); v.setLayoutParams(lp);
            int rw = Math.min(Math.max(w, 600), 2200); String k = i + ":" + rw; Bitmap b = cache.get(k);
            v.setTag(k); v.setImageBitmap(b);
            if (b == null) render(i, rw, k, v);
        }
    }
    void render(int i, int rw, String k, ImageView v) {
        ui.post(() -> {
            if (dead || renderer == null || !k.equals(v.getTag())) return;
            Bitmap b = cache.get(k);
            if (b == null) try {
                PdfRenderer.Page p = renderer.openPage(i);
                b = Bitmap.createBitmap(rw, Math.max(1, Math.round(rw * ratio[i])), Bitmap.Config.ARGB_8888); b.eraseColor(Color.WHITE);
                p.render(b, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); p.close(); cache.put(k, b);
            } catch (Exception e) { return; }
            v.setImageBitmap(b);
        });
    }

    /* ---------- фото ---------- */
    void showImage() {
        Bitmap b;
        try { BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true; BitmapFactory.decodeFile(orig.getPath(), o);
            int s = 1; while (Math.max(o.outWidth, o.outHeight) / s > 3000) s *= 2; o = new BitmapFactory.Options(); o.inSampleSize = s; b = BitmapFactory.decodeFile(orig.getPath(), o); }
        catch (Throwable e) { b = null; }
        if (b == null) { fail("Фото не открылось на телефоне (" + ext(name).toUpperCase(Locale.ROOT) + ")."); return; }
        info.setText(b.getWidth() + "×" + b.getHeight() + " · " + MailApi.size(orig.length()));
        ratio = new float[]{b.getHeight() / (float) b.getWidth()}; cache.put("img", b);
        stage.removeAllViews(); baseW = getResources().getDisplayMetrics().widthPixels;
        hs = new HorizontalScrollView(this); hs.setFillViewport(true); hs.setHorizontalScrollBarEnabled(false);
        pages = new RecyclerView(this); pages.setLayoutManager(new LinearLayoutManager(this));
        final Bitmap bm = b;
        pages.setAdapter(new RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            @Override public int getItemCount() { return 1; }
            @Override public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup p, int t) { ImageView v = new ImageView(ViewerActivity.this); v.setScaleType(ImageView.ScaleType.FIT_XY); v.setImageBitmap(bm); return new RecyclerView.ViewHolder(v) {}; }
            @Override public void onBindViewHolder(RecyclerView.ViewHolder h, int i) { int w = Math.round(baseW * zoom); h.itemView.setLayoutParams(new RecyclerView.LayoutParams(w, Math.round(w * ratio[0]))); }
        });
        hs.addView(pages, new FrameLayout.LayoutParams(baseW, -1));
        stage.addView(hs, new FrameLayout.LayoutParams(-1, -1));
        gestures(); findViewWithTagZb().setVisibility(View.VISIBLE); setZoom(1f);
    }

    /* ---------- Word прямо на телефоне ---------- */
    boolean docxDone;
    void showDocx() {
        busy("Открываю «" + name + "»…"); docxDone = false;
        final String b64;
        try { b64 = Base64.encodeToString(Files.readAllBytes(orig.toPath()), Base64.NO_WRAP); } catch (Exception x) { toPdf(); return; }
        web = new WebView(this); web.setBackgroundColor(0xFF2B2824); WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true); ws.setBlockNetworkLoads(true); ws.setAllowFileAccess(false); ws.setBuiltInZoomControls(true); ws.setDisplayZoomControls(false); ws.setUseWideViewPort(true); ws.setLoadWithOverviewMode(true);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public String data() { return b64; }
            @JavascriptInterface public void done(boolean ok, String err) { ui.post(() -> docxEnd(ok)); }
        }, "FD");
        String html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<style>html,body{margin:0;background:#2B2824}.docx-wrapper{background:#2B2824!important;padding:10px 0 24px!important}.docx-wrapper>section.docx{margin:0 auto 14px!important;box-shadow:0 4px 18px rgba(0,0,0,.4)}"
            + "@media print{@page{margin:0}html,body,.docx-wrapper{background:#fff!important;padding:0!important}#box{zoom:1!important}.docx-wrapper>section.docx{box-shadow:none!important;margin:0!important;break-after:page}.docx-wrapper>section.docx:last-child{break-after:auto}}</style>"
            + "<div id=box></div><script src='jszip.min.js'></script><script src='docx-preview.min.js'></script><script>"
            + "(async()=>{try{const s=atob(FD.data()),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);const b=document.getElementById('box');"
            + "await docx.renderAsync(u.buffer,b,b,{inWrapper:true,breakPages:true,renderHeaders:true,renderFooters:true,renderFootnotes:true,useBase64URL:true,experimental:true});"
            + "const sec=b.querySelector('section.docx');if(!sec)throw new Error('empty');const z=Math.min(1,(innerWidth-12)/sec.offsetWidth);if(z<1)b.style.zoom=z;FD.done(true,'')}catch(e){FD.done(false,String(e))}})()</script>";
        web.loadDataWithBaseURL("file:///android_asset/docx/", html, "text/html", "utf-8", null);
        stage.addView(web, 0, new FrameLayout.LayoutParams(-1, -1)); web.setVisibility(View.INVISIBLE);
        ui.postDelayed(() -> { if (!dead && !docxDone) docxEnd(false); }, 15000);
    }
    void docxEnd(boolean ok) {
        if (dead || docxDone) return; docxDone = true;
        if (ok) { for (int i = stage.getChildCount() - 1; i >= 0; i--) if (stage.getChildAt(i) != web) stage.removeViewAt(i); web.setVisibility(View.VISIBLE); info.setText(MailApi.size(orig.length())); return; }
        if (web != null) { stage.removeView(web); web.destroy(); web = null; }
        toPdf();
    }

    /* ---------- текст ---------- */
    WebView web;
    void showText() {
        String e = ext(name), s;
        try { byte[] d = Files.readAllBytes(orig.toPath()); s = new String(d, StandardCharsets.UTF_8); if (s.contains("�")) s = new String(d, Charset.forName("windows-1251")); }
        catch (Exception x) { fail("Файл не прочитался: " + x.getMessage()); return; }
        stage.removeAllViews();
        web = new WebView(this); web.setBackgroundColor(Color.WHITE); WebSettings ws = web.getSettings(); ws.setJavaScriptEnabled(false); ws.setBlockNetworkImage(true); ws.setAllowFileAccess(false); ws.setBuiltInZoomControls(true); ws.setDisplayZoomControls(false);
        boolean html = e.equals("html") || e.equals("htm") || mime.equals("text/html");
        String body = html ? s : "<pre>" + s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</pre>";
        web.loadDataWithBaseURL(null, "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><style>body{margin:14px;font:15px sans-serif;color:#1f1d1a}pre{white-space:pre-wrap;word-wrap:break-word;font:14px monospace}img{max-width:100%}</style>" + body, "text/html", "utf-8", null);
        stage.addView(web, new FrameLayout.LayoutParams(-1, -1));
        info.setText(MailApi.size(orig.length()));
    }

    /* ---------- увеличение ---------- */
    void gestures() {
        sg = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override public boolean onScaleBegin(ScaleGestureDetector d) { pinch = 1f; return true; }
            @Override public boolean onScale(ScaleGestureDetector d) { pinch *= d.getScaleFactor(); float z = Math.max(1f, Math.min(5f, zoom * pinch)); if (pages != null) { pages.setPivotX(d.getFocusX() + hs.getScrollX()); pages.setPivotY(d.getFocusY()); pages.setScaleX(z / zoom); pages.setScaleY(z / zoom); } zoomV.setText(Math.round(z * 100) + "%"); return true; }
            @Override public void onScaleEnd(ScaleGestureDetector d) { float fx = d.getFocusX(); if (pages != null) { pages.setScaleX(1f); pages.setScaleY(1f); } setZoom(zoom * pinch, fx); }
        });
        gd = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDoubleTap(MotionEvent e) { setZoom(zoom > 1.4f ? 1f : 2f, e.getX()); return true; }
        });
    }
    @Override public boolean dispatchTouchEvent(MotionEvent e) {
        if (sg != null && hs != null) { sg.onTouchEvent(e); gd.onTouchEvent(e); if (sg.isInProgress() || e.getPointerCount() > 1) { if (e.getActionMasked() == MotionEvent.ACTION_POINTER_DOWN) { MotionEvent c = MotionEvent.obtain(e); c.setAction(MotionEvent.ACTION_CANCEL); super.dispatchTouchEvent(c); c.recycle(); } return true; } }
        return super.dispatchTouchEvent(e);
    }
    void setZoom(float z) { setZoom(z, baseW / 2f); }
    void setZoom(float z, float fx) {
        z = Math.max(1f, Math.min(5f, z)); if (pages == null) return;
        float old = zoom; zoom = z; zoomV.setText(Math.round(z * 100) + "%");
        int sx = hs.getScrollX();
        ViewGroup.LayoutParams lp = pages.getLayoutParams(); lp.width = Math.round(baseW * z); pages.setLayoutParams(lp);
        LinearLayoutManager lm = (LinearLayoutManager) pages.getLayoutManager(); int pos = lm.findFirstVisibleItemPosition(); View first = lm.findViewByPosition(Math.max(pos, 0));
        int off = first == null ? 0 : Math.round(first.getTop() * z / old);
        pages.getAdapter().notifyDataSetChanged();
        if (pos >= 0) lm.scrollToPositionWithOffset(pos, off);
        final int nx = Math.max(0, Math.round((sx + fx) * z / old - fx));
        hs.post(() -> hs.scrollTo(nx, 0));
    }

    /* ---------- действия ---------- */
    Uri share() { return orig == null ? null : FileProvider.getUriForFile(this, "ru.frudom.mail.files", orig); }
    void openWith() {
        Uri u = share(); if (u == null) return;
        Intent in = new Intent(Intent.ACTION_VIEW).setDataAndType(u, mime); in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); in.setClipData(ClipData.newRawUri(name, u));
        try { startActivity(Intent.createChooser(in, "Открыть «" + name + "»")); } catch (ActivityNotFoundException e) { Toast.makeText(this, "Нет приложения, чтобы открыть этот файл", Toast.LENGTH_LONG).show(); }
    }
    void send() {
        Uri u = share(); if (u == null) return;
        Intent in = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, u); in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); in.setClipData(ClipData.newRawUri(name, u));
        try { startActivity(Intent.createChooser(in, "Отправить «" + name + "»")); } catch (Exception e) { Toast.makeText(this, "Нечем отправить", Toast.LENGTH_LONG).show(); }
    }
    void save() {
        if (orig == null) { Toast.makeText(this, "Файл ещё загружается", Toast.LENGTH_SHORT).show(); return; }
        Intent in = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime.isEmpty() ? "application/octet-stream" : mime).putExtra(Intent.EXTRA_TITLE, name);
        try { startActivityForResult(in, 9); } catch (Exception e) { Toast.makeText(this, "Не получилось открыть сохранение", Toast.LENGTH_LONG).show(); }
    }
    @Override protected void onActivityResult(int req, int res, Intent d) {
        super.onActivityResult(req, res, d);
        if (req != 9 || res != RESULT_OK || d == null || d.getData() == null) return;
        try (InputStream i = new FileInputStream(orig); OutputStream o = getContentResolver().openOutputStream(d.getData())) {
            byte[] b = new byte[65536]; int n; while ((n = i.read(b)) > 0) o.write(b, 0, n);
            Toast.makeText(this, "Сохранено: " + name, Toast.LENGTH_SHORT).show();
        } catch (Exception e) { Toast.makeText(this, "Не сохранилось: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
    }
    void menu(View a) {
        PopupMenu m = new PopupMenu(this, a);
        m.getMenu().add(0, 1, 0, "Отправить…"); m.getMenu().add(0, 2, 0, "Открыть другим приложением"); m.getMenu().add(0, 3, 0, "Сохранить в «Загрузки»"); m.getMenu().add(0, 4, 0, "Печать");
        m.setOnMenuItemClickListener(it -> { switch (it.getItemId()) { case 1: send(); break; case 2: openWith(); break; case 3: save(); break; case 4: print(); break; } return true; });
        m.show();
    }

    /** печать: PDF — как есть, фото — на лист A4, текст — страницей */
    void print() {
        if (orig == null) { Toast.makeText(this, "Файл ещё загружается", Toast.LENGTH_SHORT).show(); return; }
        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE); if (pm == null) return;
        String job = name.replaceAll("\\.[^.]+$", "");
        if (web != null) { pm.print(job, web.createPrintDocumentAdapter(job), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build()); return; }
        File f = pdf;
        if (f == null && cache.get("img") != null) {
            try { Bitmap b = cache.get("img"); PdfDocument d = new PdfDocument(); int W = 595, H = 842;
                PdfDocument.Page p = d.startPage(new PdfDocument.PageInfo.Builder(W, H, 1).create()); Canvas c = p.getCanvas();
                float s = Math.min((W - 40f) / b.getWidth(), (H - 40f) / b.getHeight()); c.translate((W - b.getWidth() * s) / 2, (H - b.getHeight() * s) / 2); c.scale(s, s); c.drawBitmap(b, 0, 0, null);
                d.finishPage(p); f = new File(orig.getParentFile(), job + " (печать).pdf"); try (FileOutputStream o = new FileOutputStream(f)) { d.writeTo(o); } d.close();
            } catch (Exception e) { Toast.makeText(this, "Не получилось подготовить печать: " + e.getMessage(), Toast.LENGTH_LONG).show(); return; }
        }
        if (f == null) { Toast.makeText(this, "Этот файл здесь не напечатать — откройте другим приложением", Toast.LENGTH_LONG).show(); return; }
        final File src = f;
        pm.print(job, new PrintDocumentAdapter() {
            @Override public void onLayout(PrintAttributes o, PrintAttributes n, CancellationSignal c, LayoutResultCallback cb, Bundle x) {
                if (c.isCanceled()) { cb.onLayoutCancelled(); return; }
                cb.onLayoutFinished(new PrintDocumentInfo.Builder(job + ".pdf").setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).build(), true);
            }
            @Override public void onWrite(PageRange[] pr, ParcelFileDescriptor dst, CancellationSignal c, WriteResultCallback cb) {
                try (InputStream i = new FileInputStream(src); OutputStream o = new FileOutputStream(dst.getFileDescriptor())) {
                    byte[] b = new byte[65536]; int n; while ((n = i.read(b)) > 0) o.write(b, 0, n);
                    cb.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                } catch (Exception e) { cb.onWriteFailed(e.getMessage()); }
            }
        }, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
    }

    void closePdf() { try { if (renderer != null) renderer.close(); } catch (Exception ignored) {} try { if (pfd != null) pfd.close(); } catch (Exception ignored) {} renderer = null; pfd = null; }
    @Override protected void onDestroy() { dead = true; closePdf(); cache.evictAll(); if (web != null) web.destroy(); super.onDestroy(); }
}
