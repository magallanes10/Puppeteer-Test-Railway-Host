const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const url = "https://laughing-goggles-jjq4wjpg49wq3qr95.github.dev/";
const cookiesPath = path.join(__dirname, "cookies.json");

let browser, page;

async function initBrowser() {
    if (browser) return;

    browser = await puppeteer.launch({
        headless: "new",
        protocolTimeout: 60000,
        args: [
            "--ignore-certificate-errors",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ],
    });

    page = await browser.newPage();

    // ✅ Set Mobile View (Android)
    await page.emulate({
        viewport: { width: 412, height: 915, isMobile: true },
        userAgent:
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Mobile Safari/537.36",
    });

    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // ✅ Ensure full load
    await page.waitForSelector("body", { timeout: 60000 });
    await page.waitForFunction(() => document.readyState === "complete");

    // ✅ Fix: Use setTimeout instead of waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 3000));

    fs.writeFileSync(cookiesPath, JSON.stringify(await page.cookies(), null, 2));

    console.log("✅ Puppeteer is running in mobile view and page is fully loaded.");
    
    autoScreenshot();
}

async function autoScreenshot() {
    try {
        const screenshotPath = path.resolve(__dirname, "temp.jpeg");
        await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80, fullPage: true });

        console.log("📸 Mobile screenshot taken and ready to send.");
    } catch (error) {
        console.error("❌ Screenshot error:", error);
    }
}

// Screenshot route
app.get("/ss", async (req, res) => {
    try {
        const screenshotPath = path.resolve(__dirname, "temp.jpeg");
        res.sendFile(screenshotPath);
    } catch (error) {
        console.error("❌ Screenshot error:", error);
        res.status(500).json({ error: "Failed to send screenshot" });
    }
});

// Info route
app.get("/info", async (req, res) => {
    try {
        const version = await browser.version();
        const userAgent = await page.evaluate(() => navigator.userAgent);

        res.json({
            puppeteer_version: require("puppeteer/package.json").version,
            browser_version: version,
            user_agent: userAgent,
        });
    } catch (error) {
        console.error("❌ Info error:", error);
        res.status(500).json({ error: "Failed to fetch system info" });
    }
});

// Start server & initialize Puppeteer
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await initBrowser();
});
