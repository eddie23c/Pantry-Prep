// Saving files: inside Claude the `downloads` capability is used; in a normal browser,
// a download link (or a new tab for the printable cards).
type Downloads = { save(o: { filename: string; data: Blob }): Promise<{ status?: string }> };
const w = window as any;
const downloadsP: Promise<Downloads | null> = w.claude?.use ? w.claude.use("downloads").catch(() => null) : Promise.resolve(null);

export async function saveFile(name: string, text: string, type: string): Promise<void> {
  const dl = await downloadsP;
  if (dl) { await dl.save({ filename: name, data: new Blob([text], { type }) }); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/** Opens the printable cards. Returns the message to show. */
export async function openPrintable(html: string): Promise<string> {
  const dl = await downloadsP;
  if (!dl) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const win = window.open(url, "_blank");
    if (!win) await saveFile("pantry-prep-cards.html", html, "text/html");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return win ? "Your cards opened in a new tab. Print them on A4." : "Saved. Open the file and print it on A4.";
  }
  try {
    const res = await dl.save({ filename: "pantry-prep-cards.html", data: new Blob([html], { type: "text/html" }) });
    return res && res.status === "saved" ? "Saved. Open the file and print it on A4." : "Sent to the place you chose.";
  } catch (err: any) {
    const c = err && err.code;
    return c === "cancelled" || c === "declined" ? "Download cancelled." : "The cards could not be saved here. Try a browser on a computer.";
  }
}
