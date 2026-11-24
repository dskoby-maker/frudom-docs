package ru.frudom.mail;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;

/** Проверка на эмуляторе без входа (--ez demo true): вложения-примеры рисуются на месте — PDF на 3 страницы и картинка. */
final class Demo {
    private Demo() {}

    static JSONObject att(Context c, String id, int i) throws Exception {
        JSONObject r = MailApi.find(id); org.json.JSONArray A = r == null ? new org.json.JSONArray() : MailApi.atts(r);
        String n = A.optJSONObject(i) == null ? "файл.pdf" : A.optJSONObject(i).optString("n");
        Thread.sleep(400);
        if (n.endsWith(".png")) return new JSONObject().put("name", n).put("mime", "image/png").put("data", Base64.encodeToString(png(), Base64.NO_WRAP));
        if (n.endsWith(".docx")) { try (java.io.InputStream in = c.getAssets().open("docx/demo.docx")) { java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); byte[] b = new byte[8192]; int k; while ((k = in.read(b)) > 0) o.write(b, 0, k);
            return new JSONObject().put("name", n).put("mime", "application/vnd.openxmlformats-officedocument.wordprocessingml.document").put("data", Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP)); } }
        if (n.endsWith(".pdf")) return new JSONObject().put("name", n).put("mime", "application/pdf").put("data", Base64.encodeToString(pdf(n), Base64.NO_WRAP));
        return new JSONObject().put("name", n).put("mime", "application/octet-stream").put("data", Base64.encodeToString("PK demo".getBytes(), Base64.NO_WRAP));
    }

    static JSONObject attPdf(String n) throws Exception {
        Thread.sleep(600);
        return new JSONObject().put("name", n.replaceAll("\\.[^.]+$", "") + ".pdf").put("data", Base64.encodeToString(pdf(n), Base64.NO_WRAP));
    }

    static byte[] pdf(String title) throws Exception {
        PdfDocument d = new PdfDocument(); Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int k = 1; k <= 3; k++) {
            PdfDocument.Page pg = d.startPage(new PdfDocument.PageInfo.Builder(595, 842, k).create()); Canvas cv = pg.getCanvas();
            p.setColor(Color.BLACK); p.setTextSize(22); p.setFakeBoldText(true); cv.drawText(title + " — страница " + k, 50, 80, p);
            p.setFakeBoldText(false); p.setTextSize(13);
            for (int l = 0; l < 30; l++) cv.drawText("Строка " + (l + 1) + ": товар, количество, цена, сумма — пример документа", 50, 130 + l * 22, p);
            p.setStyle(Paint.Style.STROKE); cv.drawRect(40, 40, 555, 802, p); p.setStyle(Paint.Style.FILL);
            d.finishPage(pg);
        }
        ByteArrayOutputStream o = new ByteArrayOutputStream(); d.writeTo(o); d.close(); return o.toByteArray();
    }

    static byte[] png() {
        Bitmap b = Bitmap.createBitmap(900, 1200, Bitmap.Config.ARGB_8888); Canvas cv = new Canvas(b); cv.drawColor(0xFFF4EDE2);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG); p.setColor(0xFF1E4A5C); cv.drawCircle(450, 500, 260, p);
        p.setColor(Color.WHITE); p.setTextSize(64); p.setTextAlign(Paint.Align.CENTER); cv.drawText("Фото", 450, 520, p);
        ByteArrayOutputStream o = new ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.PNG, 100, o); return o.toByteArray();
    }
}
