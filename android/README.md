# PulseShop — Android app (Trusted Web Activity)

The Android app is a **TWA**: a thin native shell that renders `pulseshop.space`
full-screen in Chrome's engine, with no browser UI. It contains no app code, so
**every `git push` updates the app instantly** for everyone who has it installed
— an APK rebuild is only needed if the icon, name, or package id changes.

iOS has no equivalent (Apple provides no TWA mechanism); there, PulseShop
installs as a PWA via Safari's *Share → Add to Home Screen*, which the in-app
install prompt now walks users through.

## What's here

| File | Purpose |
| --- | --- |
| `twa-manifest.json` | The build config (package id, colours, icons, signing key). Committed. |
| `pulseshop.keystore` | **The signing key. Gitignored. Back it up.** |
| `keystore-password.txt` | Its password. **Gitignored — move this into a password manager and delete the file.** |

## The keystore is irreplaceable

`frontend/public/.well-known/assetlinks.json` publishes the SHA-256 fingerprint of
this exact key. That file is the Digital Asset Links handshake: it is what proves
the app and the website have the same owner, and it is the *only* reason the app
renders without a URL bar. If the keystore is lost:

- a rebuilt APK is signed with a different key, so it no longer matches the
  published fingerprint, and every installed copy shows the address bar;
- if the app is ever on the Play Store, updates signed with a different key are
  **rejected outright** — the listing cannot be recovered.

Current fingerprint (must equal the one in `assetlinks.json`):

```
56:E7:0D:22:25:13:07:1B:9C:F5:BA:DD:21:F5:74:E7:F6:C7:B3:77:D9:8B:79:80:6B:BF:B6:28:3A:C8:26:1D
```

Re-read it any time with:

```bash
keytool -list -v -keystore pulseshop.keystore -alias pulseshop
```

## Building the APK

`twa-manifest.json` is the only source file here — everything else Bubblewrap
generates (`app/`, `build.gradle`, `gradlew`, the APK) is gitignored and
recreated by the build.

```powershell
npm i -g @bubblewrap/cli          # once
cd android
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = (Get-Content keystore-password.txt -Raw).Trim()
$env:BUBBLEWRAP_KEY_PASSWORD      = $env:BUBBLEWRAP_KEYSTORE_PASSWORD
bubblewrap build --skipPwaValidation
```

Output: `app-release-signed.apk` (sideload / share directly) and
`app-release-bundle.aab` (Play Store).

On the first run Bubblewrap downloads a JDK 17 and the Android SDK — the
project's own JDK is not used, and **Google's SDK Terms and Conditions have to
be accepted by a human**, so that first run is interactive by design.

### Two Windows traps, both hit while setting this up

1. **`'gradlew.bat' is not recognized`.** This machine has
   `NoDefaultCurrentDirectoryInExePath=1` set, so `cmd` refuses to run an
   executable from the current directory — and Bubblewrap invokes `gradlew.bat`
   bare, without `.\`. The build fails with a message that looks like a missing
   file even though `gradlew.bat` is sitting right there. Clear the variable in
   the shell first:

   ```powershell
   Remove-Item Env:\NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue
   ```

2. **Do not pipe blanket `y` answers into it.** Bubblewrap asks free-text
   questions as well as yes/no ones — feeding it a stream of `y` set the app's
   `versionName` to the literal string `"y"`. Answer the prompts, or pass the
   passwords via the env vars above so it has nothing to ask.

## After the first deploy — verify the handshake

The asset-links file must be live and served as JSON before the app will hide the
URL bar:

```bash
curl -s https://pulseshop.space/.well-known/assetlinks.json
```

If that returns the app's HTML instead of the JSON, the SPA catch-all rewrite is
swallowing it (Vercel checks the filesystem before rewrites, so it should not).
