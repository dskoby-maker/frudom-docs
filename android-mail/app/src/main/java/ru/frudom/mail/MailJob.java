package ru.frudom.mail;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Фоновая проверка новых писем — Android запускает её сам по расписанию (MailNotifier.schedule), даже когда приложение закрыто. */
public class MailJob extends JobService {
    @Override public boolean onStartJob(JobParameters p) {
        new Thread(() -> {
            try { MailNotifier.check(getApplicationContext(), false); } catch (Throwable ignored) {}
            jobFinished(p, false);
        }, "frudom-mail").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters p) { return true; }
}
