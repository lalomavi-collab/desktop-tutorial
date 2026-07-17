// Client-side text extraction for uploaded contracts. Heavy parsers are loaded
// on demand (dynamic import) so they never weigh down the main bundle.

const MAX_CHARS = 14000; // keep the model prompt bounded

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer });
    text = res?.value ?? "";
  } else if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerUrl;
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" "));
      if (parts.join("\n").length > MAX_CHARS) break;
    }
    text = parts.join("\n");
  }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "…" : text;
}
