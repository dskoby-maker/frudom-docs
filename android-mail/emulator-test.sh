#!/bin/bash
# Проверка «Почты ФД» на эмуляторе: настоящие экраны (список, письмо) на примерах, вход сайтом, уведомления, журнал ошибок.
set -x
BT=$(ls -d $ANDROID_HOME/build-tools/* | sort -V | tail -1)
keytool -genkeypair -keystore t.jks -storepass test123 -keypass test123 -alias t -keyalg RSA -keysize 2048 -validity 30 -dname "CN=test" >/dev/null 2>&1
$BT/apksigner sign --ks t.jks --ks-pass pass:test123 --out test.apk android-mail/app/build/outputs/apk/release/app-release-unsigned.apk
adb install -r test.apk
adb logcat -c
adb shell pm grant ru.frudom.mail android.permission.POST_NOTIFICATIONS || true
adb shell am start -W -n ru.frudom.mail/.MainActivity --ez demo true
sleep 8
adb exec-out screencap -p > shot1.png
adb shell am start -W -n ru.frudom.mail/.MainActivity --ez demo true --es open d1; sleep 5     # письмо
adb exec-out screencap -p > shot2.png
adb shell input keyevent 4; sleep 2
adb shell am start -W -n ru.frudom.mail/.MainActivity --ez demo true --es acts d2; sleep 4     # долгое нажатие — действия
adb exec-out screencap -p > shot3.png
adb shell input keyevent 4; sleep 1
adb shell am force-stop ru.frudom.mail
adb shell am start -W -n ru.frudom.mail/.MainActivity; sleep 25          # без входа — вход сайтом
adb shell pidof ru.frudom.mail >/dev/null || { adb shell am start -W -n ru.frudom.mail/.MainActivity; sleep 25; }
adb exec-out screencap -p > shot4.png
adb shell am start -W -n ru.frudom.mail/.MailSettingsActivity --ez ndemo true; sleep 4
adb shell cmd statusbar expand-notifications; sleep 3
adb exec-out screencap -p > shot5.png
adb shell cmd statusbar collapse; sleep 1
adb shell pidof ru.frudom.mail > pid.txt || echo "НЕ ЗАПУЩЕНО" > pid.txt
adb shell dumpsys package ru.frudom.mail | grep -E "versionName|versionCode" >> pid.txt
adb logcat -d > logcat.txt
grep -E "FATAL|AndroidRuntime: (FATAL|java|Caused|\s+at ru\.frudom)|chromium.*Uncaught" logcat.txt | head -60 > errors.txt; [ -s errors.txt ] || echo "ошибок нет" > errors.txt
true
