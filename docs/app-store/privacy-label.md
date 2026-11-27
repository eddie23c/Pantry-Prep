# App Privacy answers (App Store Connect, App Privacy)

Apple asks what data the app "collects": data sent off the phone and kept by you or a partner
for longer than it takes to answer the request. Pantry Prep keeps the store on the phone, so the
answers are short. Re-check these if the photo scan changes how photos are sent or kept.

## Do you or your third-party partners collect data from this app?

**Yes**, for one data type:

| Data type | Collected? | Linked to the user? | Used for tracking? | Purposes |
| --- | --- | --- | --- | --- |
| Photos or Videos | Yes, only when the person uses photo scanning | No | No | App Functionality |

Why: photos taken for a scan are sent to Anthropic (Claude) to read the food in them. Anthropic may
keep API inputs for a limited time for safety checks, which counts as collection under Apple's
definition even though Pantry Prep keeps nothing.

Everything else is **not collected**:

- Store contents, household size, best-before dates, kit checklist: stay on the phone.
- Allergies and diet (health data): stay on the phone.
- Barcode numbers: sent to Open Food Facts to look up a product. A product barcode is not data
  about the person, and nothing identifying is sent with it. Not declared.
- Reminders: scheduled on the phone, no server.
- No analytics, crash reporting, adverts, accounts, contact details, location or identifiers.

## Tracking

**No.** The app does not track people across other companies' apps or websites, and contains no
advertising or analytics SDKs. It never shows the App Tracking Transparency prompt.

## Privacy manifest

`ios/App/App/PrivacyInfo.xcprivacy` matches these answers (Photos or Videos, App Functionality,
not linked, no tracking) and declares the UserDefaults and file timestamp API reasons the
Capacitor plugins use.

## Before submitting

- The in-app privacy notice (`src/legal.ts`) was written for the website. Add a short iPhone
  section: data kept in the app's storage, reminders on the phone, and deleting the app removes
  everything. Do this together with the photo scan change, which also edits that notice.
- If the photo scan moves to a Pantry Prep server (proxy), say so in the notice and confirm here
  that the server keeps no photos and no logs that identify people. If it keeps logs with IP
  addresses, declare Diagnostics or Other Data as well.
