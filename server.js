import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json({ limit: "50mb" }));

// helper: wstrzykuj drukowy CSS do <head>
function injectPrintCss(html) {
  const printCss = `
    @page { size: A4; margin: 12mm; }

    @media print {
      /* nie rozjaśniaj kolorów w trybie druku */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      html, body { height: auto !important; overflow: visible !important; }
      body { background: transparent !important; }

      /* okładka osobno, rozdziały płynnie */
      .cover-box { page-break-after: always; }
      .chapter   { page-break-after: auto; break-after: auto; }

      /* obraz + tekst razem */
      .chapter-hero {
        break-inside: avoid; page-break-inside: avoid; page-break-after: avoid;
        margin: 8mm 0 4mm 0 !important;
        aspect-ratio: auto !important;
        max-height: 125mm !important;
      }
      .hero-img {
        width: 100% !important; height: auto !important; object-fit: contain !important;
      }

      /* blok treści – wyraźniejsze, fioletowe obramowanie */
      .storybook {
        break-inside: avoid; page-break-inside: avoid;
        margin: 4mm 0 10mm 0 !important;
        padding: 6mm 6mm 5mm 6mm !important;
        background: #fffef8 !important; /* jeśli chcesz bez tła bloku: transparent */
        border-left: 2px solid #7c5cff !important;
        border-right: 2px solid #7c5cff !important;
        border-radius: 8px !important;
      }

      .chapter-title { margin: 0 0 3mm 0 !important; break-after: avoid; }
      .chapter-text p { margin: 0 0 3mm 0 !important; }

      .cover-ribbon { display: none !important; }
    }
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `<style>${printCss}</style></head>`);
  }
  return `${html}<style>${printCss}</style>`;
}

app.post("/render", async (req, res) => {
  try {
    let { html } = req.body;
    if (!html) return res.status(400).send("Missing 'html'");

    // usuń lazy (w headless brak viewportu)
    html = html.replace(/\sloading="lazy"/g, "");
    html = injectPrintCss(html);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--font-render-hinting=medium"],
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    await browser.close();
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).send("PDF generation failed");
  }
});

app.listen(3001, () => console.log("PDF renderer on :3001"));
