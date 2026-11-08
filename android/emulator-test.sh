#!/bin/bash
# Проверка на эмуляторе: установить, открыть, снять экран, собрать журнал ошибок.
set -x
BT=$(ls -d $ANDROID_HOME/build-tools/* | sort -V | tail -1)
keytool -genkeypair -keystore t.jks -storepass test123 -keypass test123 -alias t -keyalg RSA -keysize 2048 -validity 30 -dname "CN=test" >/dev/null 2>&1
$BT/apksigner sign --ks t.jks --ks-pass pass:test123 --out test.apk android/app/build/outputs/apk/release/app-release-unsigned.apk
adb install -r test.apk
adb logcat -c
adb shell am start -W -n ru.frudom.docs/.MainActivity
sleep 35
adb exec-out screencap -p > shot1.png
adb shell input keyevent 4; sleep 2
adb shell am start -W -n ru.frudom.docs/.MainActivity; sleep 5
adb exec-out screencap -p > shot2.png
adb shell pm grant ru.frudom.docs android.permission.POST_NOTIFICATIONS || true
adb shell am start -W -n ru.frudom.docs/.NotifySettingsActivity; sleep 4
adb exec-out screencap -p > shot3.png
adb shell input swipe 160 560 160 120 400; sleep 2; adb shell input swipe 160 560 160 120 400; sleep 2
adb exec-out screencap -p > shot4.png
adb shell input keyevent 4; sleep 1
adb shell am start -W -n ru.frudom.docs/.MainActivity --es quick exp; sleep 6
adb exec-out screencap -p > shot5.png
adb shell dumpsys appwidget | grep -i "frudom" | head -5 >> pid.txt
adb shell pidof ru.frudom.docs > pid.txt || echo "НЕ ЗАПУЩЕНО" > pid.txt
adb shell dumpsys package ru.frudom.docs | grep -E "versionName|versionCode" >> pid.txt
adb shell dumpsys webviewupdate | grep -iE "Current WebView package|versionName" | head -3 >> pid.txt
adb logcat -d > logcat.txt
grep -E "FATAL|AndroidRuntime|chromium.*Uncaught|Console" logcat.txt | head -60 > errors.txt; [ -s errors.txt ] || echo "ошибок нет" > errors.txt
true
