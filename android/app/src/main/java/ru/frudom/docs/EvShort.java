package ru.frudom.docs;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Короткая строка уведомления о действии сотрудника: «действие · что № · заказчик».
 *  Из «Изменён документ № 74/2 от 28.10.2026 — ФГБУ «Клиническая больница № 1», 121352, г. Москва…, сумма … (ИП …)»
 *  делает {«Изменён», «накладная № 74/2 · Клиническая больница № 1»}. Без Android — проверяется обычной Java. */
final class EvShort {
    private EvShort() {}
    private static final Pattern VERB = Pattern.compile("^([А-ЯЁ][а-яё]+(?:ён|ен|ан|ян|ын|ит|ат|ят|ена|ана|ено|ано|ены|аны|ёна|ёно|ёны))(?=[\\s:,(]|$)");
    private static final Pattern NUM = Pattern.compile("№\\s*([0-9A-Za-zА-Яа-я][0-9A-Za-zА-Яа-я/\\-.]*?)(?=[\\s,;:)]|$)");
    private static final Pattern PAREN = Pattern.compile("\\(([^()]{2,30})\\)");
    private static final Pattern FORMS = Pattern.compile("^(ФГБУ|ФГБНУ|ФГУП|ГУП|ГБПОУ|ГАПОУ|ГБОУ|ГБУЗ|ГБУ|ФГАОУ|ФГБОУ|МБОУ|ООО|АО|ПАО|ЗАО|ИП)\\s+");
    private static final Pattern CUT = Pattern.compile(",|\\s\\(|\\s—\\s|:\\s|;");
    private static final Pattern ANYVERB = Pattern.compile("(?<![А-ЯЁа-яё])([а-яё]+(?:ён|ан|ян|ена|ана|ено|ано|ены|аны|ёна|ёно|ёны))(?![А-ЯЁа-яё])");
    private static final Pattern QUOTE = Pattern.compile("«([^»]{1,40})»");

    /** @return {действие одним словом, остальное в одну строку} */
    static String[] of(String action, String text) {
        String t = text == null ? "" : text.replace('\n', ' ').replaceAll("\\s+", " ").trim();
        String act = action == null ? "" : action.trim();
        String word = "";
        Matcher v = VERB.matcher(t);
        if (v.find()) word = v.group(1);
        else { int c = t.indexOf(':'); if (c > 0 && c < 40) { Matcher v2 = VERB.matcher(t.substring(c + 1).trim()); if (v2.find()) word = v2.group(1); } }
        if (word.isEmpty()) { Matcher v4 = ANYVERB.matcher(t); if (v4.find()) { String w = v4.group(1); word = Character.toUpperCase(w.charAt(0)) + w.substring(1); } }
        if (word.isEmpty()) word = act.isEmpty() ? "Действие" : act;

        int dash = t.indexOf(" — ");
        String head = dash >= 0 ? t.substring(0, dash) : t, tail = dash >= 0 ? t.substring(dash + 3) : "";
        String kind = "";
        Matcher p = PAREN.matcher(head);
        if (p.find() && !p.group(1).startsWith("ИП")) kind = p.group(1).trim();
        String hl = head.toLowerCase();
        if (kind.isEmpty()) {
            if (hl.contains("комплект")) kind = "комплект";
            else if (hl.contains("накладн") || hl.contains("документ")) kind = "накладная";
            else if (hl.contains("счёт") || hl.contains("счет")) kind = "счёт";
            else if (hl.contains("акт")) kind = "акт";
            else if (hl.contains("задач") || act.toLowerCase().startsWith("задач")) kind = "задача";
            else if (hl.contains("комментар")) kind = "комментарий";
            else if (hl.contains("закупк")) kind = "закупка";
            else if (hl.contains("оплат")) kind = "оплата";
            else if (hl.contains("декларац")) kind = "декларации";
        }
        String num = "";
        Matcher n = NUM.matcher(head);
        if (n.find()) num = "№ " + n.group(1);
        if (num.isEmpty()) { Matcher q = QUOTE.matcher(head); if (q.find()) num = "«" + q.group(1) + "»"; }
        String cus = "";
        if (!tail.isEmpty()) {
            Matcher cm = CUT.matcher(tail); cus = cm.find() ? tail.substring(0, cm.start()) : tail;
            cus = FORMS.matcher(cus.trim()).replaceFirst("").replace("«", "").replace("»", "").replace("\"", "").trim();
            if (cus.length() > 38) cus = cus.substring(0, 37).trim() + "…";
        }
        StringBuilder b = new StringBuilder();
        String what = (kind + (num.isEmpty() ? "" : " " + num)).trim();
        if (!what.isEmpty()) b.append(what);
        if (!cus.isEmpty()) b.append(b.length() > 0 ? " · " : "").append(cus);
        if (b.length() == 0) {   // не разобрали — коротко как есть
            String rest = t; Matcher v3 = VERB.matcher(rest); if (v3.find() && word.equals(v3.group(1))) rest = rest.substring(v3.end()).trim();
            rest = rest.replaceAll("^[:\\-—\\s]+", "");
            b.append(rest.length() > 70 ? rest.substring(0, 69).trim() + "…" : rest);
        }
        return new String[]{word, b.toString()};
    }
}
