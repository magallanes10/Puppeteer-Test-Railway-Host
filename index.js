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
        headless: "new", // ✅ Keeps RAM low
        protocolTimeout: 60000, 
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // ✅ Waits for full page load
    await page.waitForSelector("body", { timeout: 60000 });
    await page.waitForFunction(() => document.readyState === "complete");
    await page.waitForTimeout(3000);

    fs.writeFileSync(cookiesPath, JSON.stringify(await page.cookies(), null, 2));

    console.log("✅ Puppeteer is running and page is fully loaded.");

    // ✅ Automatically take a screenshot and respond
    autoScreenshot();
}

async function autoScreenshot() {
    try {
        const screenshotPath = path.resolve(__dirname, "temp.jpeg");
        await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80, fullPage: true });

        console.log("📸 Screenshot taken and ready to send.");
    } catch (error) {
        console.error("❌ Screenshot error:", error);
    }
}

// Screenshot route (just sends the saved screenshot)
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

        const userAgentHandle = await page.evaluateHandle(() => navigator.userAgent);
        const userAgent = await userAgentHandle.jsonValue();
        await userAgentHandle.dispose();

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
