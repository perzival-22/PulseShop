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

Bubblewrap needs a JDK 17 and the Android SDK; it downloads both on first run,
but **Google's SDK Terms and Conditions must be accepted by a human**, so this
step is interactive by design:

```bash
npm i -g @bubblewrap/cli     # once
cd android
bubblewrap build             # answer Y to install the JDK/SDK, then accept the T&Cs
```

Output: `app-release-signed.apk` (sideload / share directly) and
`app-release-bundle.aab` (Play Store).

Bubblewrap will ask for the keystore password — it's in `keystore-password.txt`,
or export it first to avoid the prompt:

```bash
export BUBBLEWRAP_KEYSTORE_PASSWORD="…"
export BUBBLEWRAP_KEY_PASSWORD="…"
```

## After the first deploy — verify the handshake

The asset-links file must be live and served as JSON before the app will hide the
URL bar:

```bash
curl -s https://pulseshop.space/.well-known/assetlinks.json
```

If that returns the app's HTML instead of the JSON, the SPA catch-all rewrite is
swallowing it (Vercel checks the filesystem before rewrites, so it should not).
