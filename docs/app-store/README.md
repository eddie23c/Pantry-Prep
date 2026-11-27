# The iPhone app

The iPhone app is the same React app as the website, wrapped with [Capacitor](https://capacitorjs.com/)
so it installs from the App Store and uses native iOS features. There is one codebase: every change
to `src/` reaches both.

## What is native

| Feature | How |
| --- | --- |
| Print recipe cards and stock list | iOS print sheet (AirPrint or Save as PDF), from a small Swift plugin in `ios/App/App/AppViewController.swift` |
| Save a backup file | iOS share sheet (Save to Files, iCloud Drive, AirDrop, Mail) |
| Best-before and kit-check reminders | Local notifications, scheduled on the phone (`src/native/reminders.ts`) |
| Tap feedback | Taptic Engine haptics |
| Camera for barcodes and photos | Native camera, with permission text in `Info.plist` |
| Store backup | A second copy in the app's own storage, restored if iOS clears the web view's storage |
| Launch | Native splash screen and app icon in the Jar of Days brand |

The web code only loads the native parts inside the app (`src/native/`), so the website is unchanged.

## Builds without a Mac

`.github/workflows/ios.yml` runs on GitHub's macOS machines, free for public repositories.

- **Every pull request:** builds the app for the simulator, to prove it still compiles.
- **Actions tab, "iPhone app", Run workflow:** builds a signed App Store version and uploads it to
  App Store Connect. It shows in TestFlight about 15 to 30 minutes later.

Signing uses Xcode cloud signing with an App Store Connect API key, so there are no certificate or
profile files to make or store. The workflow needs four repository secrets
(Settings, Secrets and variables, Actions, New repository secret):

| Secret | Where it comes from |
| --- | --- |
| `APPLE_TEAM_ID` | developer.apple.com, Account, Membership details, Team ID (10 characters) |
| `ASC_KEY_ID` | App Store Connect, Users and Access, Integrations, App Store Connect API, the key's Key ID |
| `ASC_ISSUER_ID` | Same page, Issuer ID at the top |
| `ASC_KEY_P8` | The `AuthKey_XXXX.p8` file downloaded when the key was made. Open it in a text editor and paste all of it, including the BEGIN and END lines |

The API key needs the **Admin** role: cloud signing creates the distribution certificate for you.

The version shown in the App Store comes from `version` in `package.json`. The build number is the
workflow run number, so it goes up by itself.

## Working on it locally

```sh
npm run build && npx cap sync ios   # copy the web build into the iOS project
npx cap open ios                    # only on a Mac with Xcode
```

`ios/App/App/public` and the generated config files are not committed: the workflow creates them.

## Store listing

- [listing.md](listing.md): name, subtitle, description, keywords, URLs, reviewer notes.
- [privacy-label.md](privacy-label.md): answers for App Privacy, matching `ios/App/App/PrivacyInfo.xcprivacy`.
- Support page: `public/support.html`, live at https://eddie23c.github.io/Pantry-Prep/support.html
- Screenshots: `node scripts/store-screenshots.cjs out-dir` while `npx vite preview --port 4173` runs.

## Bundle ID

`com.pantryprep.app`, set in `capacitor.config.ts` and the Xcode project. It can be changed until
the first upload to App Store Connect, never after.
