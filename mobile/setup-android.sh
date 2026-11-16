#!/usr/bin/env bash
# Génère le projet Android (Capacitor), ajoute le plugin d'impression, l'icône, puis compile et signe l'APK.
set -euo pipefail
cd "$(dirname "$0")"
node build.js
[ -d android ] || npx cap add android
npx cap sync android
APP=android/app/src/main
mkdir -p "$APP/java/fr/nocte/suite"
cp android-overlay/*.java "$APP/java/fr/nocte/suite/"

# --- icônes (lanceur classique + adaptatif) ---
if ! command -v convert >/dev/null; then sudo apt-get update -qq && sudo apt-get install -y -qq imagemagick; fi
ICON=../build/icon.png
declare -A L=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
declare -A F=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
for d in "${!L[@]}"; do
  out="$APP/res/mipmap-$d"; mkdir -p "$out"
  convert "$ICON" -resize "${L[$d]}x${L[$d]}" -background '#0f1424' -alpha remove "$out/ic_launcher.png"
  cp "$out/ic_launcher.png" "$out/ic_launcher_round.png"
  inner=$(( ${F[$d]} * 62 / 100 ))
  convert "$ICON" -resize "${inner}x${inner}" -background none -gravity center -extent "${F[$d]}x${F[$d]}" "$out/ic_launcher_foreground.png"
done
echo '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#0f1424</color></resources>' > "$APP/res/values/ic_launcher_background.xml"

# --- numéro de version ---
GRADLE=android/app/build.gradle
sed -i "s/versionCode [0-9]*/versionCode ${GITHUB_RUN_NUMBER:-1}/; s/versionName \"[^\"]*\"/versionName \"$(node -p "require('./package.json').version")\"/" "$GRADLE"

# --- compilation ---
(cd android && chmod +x gradlew && ./gradlew --no-daemon assembleRelease)
UNSIGNED=$(ls android/app/build/outputs/apk/release/*.apk | head -1)
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
mkdir -p dist
"$BT/zipalign" -f -p 4 "$UNSIGNED" dist/aligned.apk
"$BT/apksigner" sign --ks nocte-sideload.jks --ks-pass pass:nocte-sideload --key-pass pass:nocte-sideload --out dist/Nocte.apk dist/aligned.apk
rm -f dist/aligned.apk
"$BT/apksigner" verify --print-certs dist/Nocte.apk | head -3
ls -la dist/Nocte.apk
