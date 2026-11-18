import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

/** Headless Chrome: the bundled serverless build on Vercel, the installed Google Chrome locally. */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
}

/** Renders HTML to an A4 PDF with a running header and footer. */
export async function htmlToPdf(browser: Browser, html: string, hf: { header: string; footer: string }) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: hf.header,
        footerTemplate: hf.footer,
        margin: { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" },
      }),
    );
  } finally {
    await page.close();
  }
}
