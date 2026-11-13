package ru.frudom.mail;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Общий вид настоящих экранов «Почты ФД»: цвета, отступы, кружок с буквами, плашки, кнопки — в стиле сайта. */
final class Ui {
    private Ui() {}
    static final int BG = 0xFFF4F2EE, CARD = 0xFFFFFFFF, INK = 0xFF1F1D1A, MUTED = 0xFF6F6A63, LINE = 0x14000000,
        BRAND = 0xFF1E4A5C, BRAND_SOFT = 0xFFE3ECEF, BLUE = 0xFF2B6CB0, ORD = 0xFF8A5A12, ORD_BG = 0xFFFBF0DC,
        OK = 0xFF2F6B43, OK_BG = 0xFFE5F1E8, TODO = 0xFF8A6A00, TODO_BG = 0xFFFFF4CC, BAD = 0xFFB3473C;

    static int dp(Context c, float v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    static TextView text(Context c, CharSequence t, float sp, int color, boolean bold) {
        TextView v = new TextView(c); v.setText(t); v.setTextSize(sp); v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); return v;
    }
    static TextView line(Context c, CharSequence t, float sp, int color, boolean bold, int lines) {
        TextView v = text(c, t, sp, color, bold); v.setMaxLines(lines); v.setEllipsize(TextUtils.TruncateAt.END); return v;
    }

    static GradientDrawable round(int color, float r) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(r); return g; }

    /** нажатие — мягкая волна, как у системных списков */
    static Drawable press(Context c, Drawable bg) { return new RippleDrawable(ColorStateList.valueOf(0x1A1E4A5C), bg, bg == null ? round(Color.WHITE, 0) : null); }

    static ImageButton icon(Context c, int res, String label, View.OnClickListener l) {
        ImageButton b = new ImageButton(c); b.setImageResource(res); b.setContentDescription(label); if (android.os.Build.VERSION.SDK_INT >= 26) b.setTooltipText(label);
        GradientDrawable mask = new GradientDrawable(); mask.setShape(GradientDrawable.OVAL); mask.setColor(Color.WHITE);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x22000000), null, mask));
        int p = dp(c, 12); b.setPadding(p, p, p, p); b.setOnClickListener(l);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(c, 48), dp(c, 48))); return b;
    }

    /** плашка: «Заявка», «Обработано», ящик */
    static TextView chip(Context c, String t, int fg, int bg) {
        TextView v = text(c, t, 12, fg, true); v.setBackground(round(bg, dp(c, 99))); int h = dp(c, 8), w = dp(c, 2);
        v.setPadding(h, w, h, w); v.setSingleLine(); return v;
    }

    /* кружок с буквами отправителя — цвет по адресу, как на сайте */
    static int hue(String s) { int h = 0; for (int i = 0; i < s.length(); i++) h = (h * 31 + s.charAt(i)) & 0x7fffffff; return h % 360; }
    static String initials(String name, String email) {
        String n = name == null || name.trim().isEmpty() ? (email == null ? "?" : email) : name.trim();
        n = n.replaceAll("[«»\"'()<>]", " ").replaceAll("^(ООО|ОАО|АО|ГУП|ГБУ|ФГБУ|ГАУ|ИП|ПАО|ЗАО)\\s+", "").trim();
        String[] w = n.split("[\\s@._-]+"); StringBuilder b = new StringBuilder();
        for (String x : w) { if (x.isEmpty()) continue; b.appendCodePoint(Character.toUpperCase(x.codePointAt(0))); if (b.length() >= 2) break; }
        return b.length() == 0 ? "?" : b.toString();
    }
    static TextView avatar(Context c, String name, String email, int sizeDp) {
        TextView v = text(c, initials(name, email), sizeDp * 0.36f, 0, true); v.setGravity(Gravity.CENTER);
        float h = hue((email == null ? "" : email.toLowerCase()) + "|"); float[] fg = {h, 0.55f, 0.36f}, bg = {h, 0.32f, 0.92f};
        v.setTextColor(Color.HSVToColor(fg)); GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(Color.HSVToColor(bg)); v.setBackground(g);
        v.setLayoutParams(new LinearLayout.LayoutParams(dp(c, sizeDp), dp(c, sizeDp))); return v;
    }

    static final int[] BOX = {0xFF6A2C4E, 0xFF1E7A8C, 0xFFB86A1D, 0xFF4A6B2A};
    static int boxColor(String accId) {
        org.json.JSONObject a = MailApi.accOf(accId);
        if (a != null && a.optString("color").matches("#[0-9A-Fa-f]{6}")) return Color.parseColor(a.optString("color"));
        for (int i = 0; i < MailApi.acc.length(); i++) { org.json.JSONObject x = MailApi.acc.optJSONObject(i); if (x != null && accId.equals(x.optString("id"))) return BOX[i % BOX.length]; }
        return BOX[0];
    }

    static View dot(Context c, int color, int sizeDp) {
        View v = new View(c); GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(color); v.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(c, sizeDp), dp(c, sizeDp)); lp.gravity = Gravity.CENTER_VERTICAL; v.setLayoutParams(lp); return v;
    }

    static TextView button(Context c, String t, boolean main, View.OnClickListener l) {
        TextView b = text(c, t, 15, main ? Color.WHITE : BRAND, true); b.setGravity(Gravity.CENTER); b.setMinHeight(dp(c, 46));
        b.setPadding(dp(c, 16), 0, dp(c, 16), 0); b.setBackground(press(c, round(main ? BRAND : BRAND_SOFT, dp(c, 14)))); b.setOnClickListener(l); b.setClickable(true); return b;
    }
}
