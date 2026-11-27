// Privacy notice, terms of use and accessibility statement, shown in the app's sheet.
// Plain English, written from ICO guidance. Update LAST_UPDATED whenever the wording changes.
export const LAST_UPDATED = "26 November 2026";
const CONTACT = '<a href="https://github.com/eddie23c/Pantry-Prep/issues" target="_blank" rel="noopener">the Pantry Prep project page on GitHub</a>';

export type LegalPage = "privacy" | "terms" | "accessibility";

export const LEGAL: Record<LegalPage, { title: string; html: string }> = {
  privacy: {
    title: "Privacy",
    html: `
<p class="lead">Your store stays on your phone. Pantry Prep has no accounts, no tracking, no adverts and no cookies.</p>
<h3>What is kept, and where</h3>
<p>Everything you enter (your household size, food, best-before dates, kit checklist, allergies and diet) is saved in your browser's storage on this device. We do not have a server that receives it, so we cannot see it, lose it or share it.</p>
<p>If you save a backup file, it goes wherever you choose to save it. Anyone who has that file can read your store, so keep it somewhere safe.</p>
<h3>When something leaves your phone</h3>
<ul>
<li><b>Loading the app.</b> The app is hosted on GitHub Pages. Like any website, GitHub receives your IP address and browser details when the app loads, and may keep them in its logs for security. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">GitHub's privacy statement</a>.</li>
<li><b>Barcode scanning.</b> The camera reads the barcode on your phone. Only the barcode number is sent to <a href="https://world.openfoodfacts.org/privacy" target="_blank" rel="noopener">Open Food Facts</a> to look up the product. Your camera picture is never sent.</li>
<li><b>Photo scanning.</b> Your photos are shrunk on your phone and sent to the Pantry Prep scanner (run on Cloudflare), which passes them to Anthropic, the company that makes Claude, to find the food in them. The scanner does not keep the photos. It counts scans against a random id stored on your phone and your internet address, only to apply the daily limit, and forgets these counts every day. Anthropic's <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener">privacy policy</a> and API terms apply while it processes them. If you add your own Anthropic API key instead, photos go straight from your phone to Anthropic, and your key is stored only on this device and is not included in backups. If you open Pantry Prep inside Claude, scans run through your own Claude account, and the photos are still not kept by Pantry Prep.</li>
<li><b>Links.</b> Links to gov.uk and other sites open those sites, which have their own privacy policies.</li>
</ul>
<h3>Allergies and diet</h3>
<p>Allergy and diet choices can say something about your health, so they never leave your phone. They are only used to hide recipes that may not suit you.</p>
<h3>Your choices</h3>
<p>You can change or delete anything in the app at any time. To delete everything, clear this site's data in your browser settings, or uninstall the app from your home screen.</p>
<h3>Children</h3>
<p>Pantry Prep is meant to be used by adults planning for their household.</p>
<h3>Contact</h3>
<p>Questions or concerns: ${CONTACT}. If you are unhappy with how your data is handled, you can complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">Information Commissioner's Office</a>.</p>
<p class="small muted">Last updated ${LAST_UPDATED}.</p>`,
  },
  terms: {
    title: "Terms and disclaimer",
    html: `
<p class="lead">Pantry Prep is a free tool to help you plan. It gives general guidance, not medical, dietary or safety advice.</p>
<h3>Follow official advice first</h3>
<p>In an emergency, follow instructions from the emergency services and the UK Government. Pantry Prep is based on the government's <a href="https://beready.campaign.gov.uk/be-ready-for-emergencies/" target="_blank" rel="noopener">Be Ready</a> advice, but it is not a government service.</p>
<h3>Food, nutrition and allergies</h3>
<ul>
<li>Nutrition figures are typical values or estimates. Scanned products may be wrong. Check the pack.</li>
<li>Daily targets are approximate and will not suit everyone. If you are pregnant, have a medical condition, or care for babies or people with special diets, ask a health professional what to store.</li>
<li>Allergen information is a guide only. Brands and recipes differ, so always read the label. Never rely on Pantry Prep to say a food is safe for an allergy.</li>
<li>Check food is in date and in good condition before you eat it, and follow the storage instructions on the pack.</li>
</ul>
<h3>Using the app</h3>
<p>The app is provided as it is, free of charge, and may change or stop. Keep a backup file and the printed cards in case your phone is lost or broken. You are responsible for any API key you add for photo scanning, and any charges from that provider.</p>
<h3>Liability</h3>
<p>We take care to make Pantry Prep accurate, but we cannot promise it is complete or error-free. As far as the law allows, we are not liable for any loss arising from using it. Nothing here limits liability that cannot be limited by law, such as for death or personal injury caused by negligence.</p>
<h3>Other sites and data</h3>
<p>Product data comes from <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a> under the Open Database Licence. Links to other sites are for information; we do not control or endorse them.</p>
<h3>Law</h3>
<p>These terms are governed by the law of England and Wales.</p>
<p class="small muted">Last updated ${LAST_UPDATED}.</p>`,
  },
  accessibility: {
    title: "Accessibility",
    html: `
<p class="lead">We want everyone to be able to use Pantry Prep, including people who use a screen reader, larger text, a keyboard or voice control.</p>
<h3>What we aim for</h3>
<p>We aim to meet the <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener">Web Content Accessibility Guidelines (WCAG) 2.2</a> at level AA. The app:</p>
<ul>
<li>works with screen readers, with labels on buttons, rings and charts</li>
<li>can be used with a keyboard alone</li>
<li>follows your phone's text size, dark mode and reduced motion settings</li>
<li>has buttons large enough to tap easily, at least 24 pixels across</li>
<li>prints in large black and white type</li>
</ul>
<h3>Known limits</h3>
<ul>
<li>Photo and barcode scanning need the camera. You can choose saved photos, type a barcode number or search the food list instead.</li>
<li>We check every change with automated accessibility tests, but have not yet had the app tested by disabled users.</li>
</ul>
<h3>Tell us about a problem</h3>
<p>If something is hard to use, please tell us on ${CONTACT}. Say what you were trying to do and what device you use.</p>
<p class="small muted">This statement was prepared on ${LAST_UPDATED}.</p>`,
  },
};
