const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const url = "https://github.com"; 
const cookiesPath = path.join(__dirname, "cookies.json");

let browser, page;

async function initBrowser() {
    if (browser) return;

    browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "networkidle2" });

    fs.writeFileSync(cookiesPath, JSON.stringify(await page.cookies(), null, 2));

    console.log("✅ Puppeteer is running and page is loaded.");
}

app.use(async (req, res, next) => {
    if (!page) {
        console.log("⏳ Initializing Puppeteer...");
        await initBrowser();
    }
    next();
});

// Screenshot route
app.get("/ss", async (req, res) => {
    try {
        const screenshotPath = path.resolve(__dirname, "temp.jpeg"); // ✅ Absolute path fix
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
    } catch (error) {
        console.error("❌ Screenshot error:", error);
        res.status(500).json({ error: "Failed to capture screenshot" });
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
