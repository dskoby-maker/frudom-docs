package ru.frudom.docs;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Фоновая проверка «что нового» — Android запускает её сам по расписанию (Notifier.schedule), даже когда приложение закрыто.
 *  Разовая задача Notifier.JOB_W — только обновить цифры виджета. */
public class NotifyJob extends JobService {
    @Override public boolean onStartJob(JobParameters p) {
        new Thread(() -> {
            try { if (p.getJobId() == Notifier.JOB_W) Notifier.widgetSync(getApplicationContext()); else Notifier.check(getApplicationContext(), false); } catch (Throwable ignored) {}
            jobFinished(p, false);
        }, "frudom-notify").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters p) { return true; }
}
