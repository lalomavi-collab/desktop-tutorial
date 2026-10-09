// Client-side text extraction for uploaded contracts. Heavy parsers are loaded
// on demand (dynamic import) so they never weigh down the main bundle.

const MAX_CHARS = 14000; // keep the model prompt bounded

export async function extractText(file: File, maxChars: number = MAX_CHARS): Promise<string> {
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
      if (parts.join("\n").length > maxChars) break;
    }
    text = parts.join("\n");
  } else if (name.endsWith(".txt")) {
    text = await file.text();
  } else {
    // Legacy binary .doc (pre-2007 Word) has no reliable in-browser parser,
    // mammoth only reads the modern .docx (OOXML) format. Fail loudly here
    // rather than falling through to an empty string: a caller that treats
    // "" as "could not read this file" (see LegalOS.tsx) depends on this
    // throwing for every unsupported type, not just silently degrading.
    throw new Error("unsupported_file_type");
  }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}
