import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createClient } from "@/lib/supabase/server";
import { loadReportForExport } from "@/lib/export/load-report";
import { headerFooter, renderReportHtml } from "@/lib/pdf/render-html";

export const maxDuration = 60;
export const runtime = "nodejs";

// On Vercel we use the bundled serverless Chromium; locally, the installed Google Chrome.
async function launchBrowser() {
  if (process.env.VERCEL) {
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const loaded = await loadReportForExport(supabase, id);
  if (!loaded) return new Response("Report not found", { status: 404 });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(renderReportHtml(loaded.input), { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const { header, footer } = headerFooter(loaded.input);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${loaded.fileBase}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
