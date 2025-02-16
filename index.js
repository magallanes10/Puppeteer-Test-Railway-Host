const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const url = "your-url-here"; 
const cookiesPath = path.join(__dirname, "cookies.json");

let browser, page;

async function initBrowser() {
    browser = await puppeteer.launch({
        headless: "new", // ✅ Ensures fully headless mode
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu", // ✅ Prevents GPU-related errors
        ],
    });

    page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "networkidle2" });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    console.log("✅ Browser initialized and page loaded.");
}

app.get("/ss", async (req, res) => {
    if (!page) {
        return res.status(500).json({ error: "❌ Browser is not initialized yet." });
    }

    const screenshotPath = "temp.jpeg";
    await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80, fullPage: true });

    res.sendFile(screenshotPath, (err) => {
        if (err) {
            console.error("❌ Error sending file:", err);
            res.status(500).json({ error: "Failed to send screenshot" });
        }
        fs.unlink(screenshotPath, (unlinkErr) => {
            if (unlinkErr) console.error("❌ Error deleting temp file:", unlinkErr);
        });
    });
});

app.get("/info", async (req, res) => {
    if (!browser) {
        return res.status(500).json({ error: "❌ Browser is not initialized yet." });
    }

    const version = await browser.version();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    res.json({
        puppeteer_version: require("puppeteer/package.json").version,
        browser_version: version,
        user_agent: userAgent,
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await initBrowser();
});
