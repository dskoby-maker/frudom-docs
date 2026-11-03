package ru.frudom.docs;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** «Документы ФД»: окно с сайтом dskoby-maker.github.io/frudom-docs. Сайт обновляется сам — приложение переустанавливать не нужно. */
public class MainActivity extends Activity {
    static final String HOST = "dskoby-maker.github.io";
    static final String PATH = "/frudom-docs";
    static final String START = "https://" + HOST + PATH + "/?source=apk";
    static final String AUTH = "ru.frudom.docs.files";
    static final String FOLDER = "Документы ФД";
    static final int REQ_FILE = 1, REQ_PERM = 2;

    WebView web, printWeb;
    ValueCallback<Uri[]> fileCb;
    Uri cameraUri;
    String bridgeJs = "";
    Object[] pendingSave;
    boolean offline;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        bridgeJs = readAsset("bridge.js");
        web = new WebView(this);
        web.setBackgroundColor(0xFFF4F2EE);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " FrudomDocsApp/1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "FrudomApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return route(r.getUrl()); }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return route(Uri.parse(url)); }
            @Override public void onPageFinished(WebView v, String url) { inject(); }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) { return chooseFile(cb, p); }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url.startsWith("http")) download(url, android.webkit.URLUtil.guessFileName(url, cd, mime));
        });
        web.loadUrl(START);
    }

    /* свои страницы — внутри приложения, всё остальное (телефон, почта, карты, другие сайты) — в своих приложениях */
    boolean route(Uri u) {
        String sc = u.getScheme() == null ? "" : u.getScheme();
        if ((sc.equals("https") || sc.equals("http")) && HOST.equalsIgnoreCase(u.getHost()) && u.getPath() != null && u.getPath().startsWith(PATH)) return false;
        if (sc.equals("blob") || sc.equals("data") || sc.equals("about") || sc.equals("javascript")) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { toast("Нет приложения, чтобы открыть эту ссылку"); }
        return true;
    }

    void inject() { if (!offline && bridgeJs.length() > 0) web.evaluateJavascript(bridgeJs, null); }

    void showOffline() {
        offline = true;
        String html = "<!doctype html><html lang=ru><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;font:16px system-ui,sans-serif;background:#F4F2EE;color:#1f1d1a;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}"
            + "b{display:block;font-size:20px;margin-bottom:8px}button{margin-top:20px;border:0;border-radius:12px;background:#6A2C4E;color:#fff;font:600 16px system-ui;padding:14px 28px}</style></head>"
            + "<body><div><b>Нет связи с интернетом</b>Проверьте интернет и нажмите «Повторить».<br><button onclick='FrudomApp.reload()'>Повторить</button></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    @Override public void onBackPressed() {
        if (offline) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.__fdBack&&window.__fdBack())?'1':'0'", r -> {
            if (r != null && r.contains("1")) return;
            if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
        });
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    /* ---------- выбор файла: заявка, фото к задаче (камера или галерея) ---------- */
    boolean chooseFile(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams p) {
        if (fileCb != null) fileCb.onReceiveValue(null);
        fileCb = cb; cameraUri = null;
        boolean img = false, onlyImg = true, any = false;
        for (String a : p.getAcceptTypes()) {
            for (String t : a.split(",")) {
                t = t.trim().toLowerCase(); if (t.isEmpty()) continue; any = true;
                if (t.startsWith("image/") || t.matches("\\.(jpe?g|png|webp|heic)")) img = true; else onlyImg = false;
            }
        }
        if (!any) { onlyImg = false; img = true; }
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType(onlyImg ? "image/*" : "*/*");
        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
        Intent chooser = Intent.createChooser(pick, onlyImg ? "Фото" : "Выберите файл");
        if (img) {
            try {
                File dir = new File(getCacheDir(), "cam"); dir.mkdirs();
                File f = new File(dir, "foto-" + System.currentTimeMillis() + ".jpg");
                cameraUri = FileProvider.getUriForFile(this, AUTH, f);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                cam.setClipData(ClipData.newRawUri("", cameraUri));
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            } catch (Exception e) { cameraUri = null; }
        }
        try { startActivityForResult(chooser, REQ_FILE); return true; }
        catch (ActivityNotFoundException e) { fileCb = null; toast("Нет приложения для выбора файла"); return false; }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req != REQ_FILE) { super.onActivityResult(req, res, data); return; }
        Uri[] out = null;
        if (res == RESULT_OK) {
            if (data != null && data.getClipData() != null && data.getData() == null) {
                ClipData c = data.getClipData(); out = new Uri[c.getItemCount()];
                for (int i = 0; i < c.getItemCount(); i++) out[i] = c.getItemAt(i).getUri();
                if (out.length == 1 && cameraUri != null && cameraUri.equals(out[0]) && !cameraOk()) out = null;
            } else if (data != null && data.getData() != null) out = new Uri[]{data.getData()};
            else if (cameraUri != null && cameraOk()) out = new Uri[]{cameraUri};
        }
        if (fileCb != null) fileCb.onReceiveValue(out);
        fileCb = null; cameraUri = null;
    }

    boolean cameraOk() {
        try (InputStream in = getContentResolver().openInputStream(cameraUri)) { return in != null && in.read() != -1; } catch (Exception e) { return false; }
    }

    /* ---------- скачивание: PDF, Excel, XML для ЕИС — в «Загрузки/Документы ФД» ---------- */
    void saveFile(byte[] bytes, String name, String mime) {
        name = name.replaceAll("[\\\\/:*?\"<>|\\n\\r]+", " ").trim();
        if (name.isEmpty()) name = "файл";
        String ext = MimeTypeMap.getFileExtensionFromUrl(Uri.encode(name)).toLowerCase();
        if (ext.isEmpty() && name.contains(".")) ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
        if (mime == null || mime.isEmpty() || mime.equals("application/octet-stream")) {
            String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
            mime = m != null ? m : (ext.equals("xml") ? "application/xml" : "application/octet-stream");
        }
        Uri uri;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
                v.put(MediaStore.Downloads.IS_PENDING, 1);
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("нет доступа к папке «Загрузки»");
                try (OutputStream o = cr.openOutputStream(uri)) { o.write(bytes); }
                v.clear(); v.put(MediaStore.Downloads.IS_PENDING, 0); cr.update(uri, v, null, null);
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingSave = new Object[]{bytes, name, mime};
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_PERM);
                    return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER); dir.mkdirs();
                File f = new File(dir, name);
                String base = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name, ex = name.contains(".") ? name.substring(name.lastIndexOf('.')) : "";
                for (int i = 1; f.exists(); i++) f = new File(dir, base + " (" + i + ")" + ex);
                try (OutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                MediaScannerConnection.scanFile(this, new String[]{f.getAbsolutePath()}, new String[]{mime}, null);
                uri = FileProvider.getUriForFile(this, AUTH, f);
                name = f.getName();
            }
        } catch (Exception e) { toast("Не получилось сохранить файл: " + e.getMessage()); return; }
        saved(uri, name, mime);
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == REQ_PERM && pendingSave != null) {
            Object[] p = pendingSave; pendingSave = null;
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) saveFile((byte[]) p[0], (String) p[1], (String) p[2]);
            else toast("Без разрешения файл не сохранить");
        }
    }

    void saved(Uri uri, String name, String mime) {
        new AlertDialog.Builder(this)
            .setTitle("Файл сохранён")
            .setMessage(name + "\n\nПапка «Загрузки» → «" + FOLDER + "»")
            .setPositiveButton("Открыть", (d, w) -> {
                Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivity(i); } catch (ActivityNotFoundException e) { toast("Нет приложения, чтобы открыть этот файл"); }
            })
            .setNeutralButton("Отправить", (d, w) -> {
                Intent i = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                i.setClipData(ClipData.newRawUri(name, uri));
                try { startActivity(Intent.createChooser(i, "Отправить файл")); } catch (Exception e) { toast("Нет приложения для отправки"); }
            })
            .setNegativeButton("Готово", null)
            .show();
    }

    void download(String url, String name) {
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, FOLDER + "/" + name);
            String c = CookieManager.getInstance().getCookie(url); if (c != null) r.addRequestHeader("Cookie", c);
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
            toast("Скачиваю: " + name);
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception x) { toast("Не получилось скачать файл"); }
        }
    }

    /* ---------- печать (A4, без полей — как на компьютере) ---------- */
    void print(WebView v, String title) {
        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter ad = v.createPrintDocumentAdapter(title);
        PrintAttributes a = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS).setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
        try { pm.print(title, ad, a); } catch (Exception e) { toast("Печать недоступна на этом телефоне"); }
    }

    void printHtml(String html, String title) {
        printWeb = new WebView(this);
        printWeb.getSettings().setJavaScriptEnabled(false);
        printWeb.setWebViewClient(new WebViewClient() {
            boolean done;
            @Override public void onPageFinished(WebView v, String url) { if (done) return; done = true; v.postDelayed(() -> print(v, title), 300); }
        });
        printWeb.loadDataWithBaseURL(START, html, "text/html", "utf-8", null);
    }

    /* ---------- что сайт может попросить у приложения ---------- */
    class Bridge {
        @JavascriptInterface public void saveFile(String b64, String name, String mime) {
            final byte[] bytes;
            try { bytes = Base64.decode(b64, Base64.DEFAULT); } catch (Exception e) { toast("Файл повреждён"); return; }
            runOnUiThread(() -> MainActivity.this.saveFile(bytes, name, mime));
        }
        @JavascriptInterface public void download(String url, String name) { runOnUiThread(() -> MainActivity.this.download(url, name)); }
        @JavascriptInterface public void printPage(String title) { runOnUiThread(() -> print(web, title)); }
        @JavascriptInterface public void printHtml(String html, String title) { runOnUiThread(() -> MainActivity.this.printHtml(html, title)); }
        @JavascriptInterface public void toast(String t) { MainActivity.this.toast(t); }
        @JavascriptInterface public void reload() { runOnUiThread(() -> { offline = false; web.loadUrl(START); }); }
        @JavascriptInterface public String version() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; } }
    }

    void toast(String t) { runOnUiThread(() -> Toast.makeText(this, t, Toast.LENGTH_LONG).show()); }

    String readAsset(String n) {
        try (InputStream in = getAssets().open(n)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int k;
            while ((k = in.read(buf)) > 0) b.write(buf, 0, k);
            return b.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) { return ""; }
    }
}
