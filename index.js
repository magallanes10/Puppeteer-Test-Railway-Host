const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const url = "https://laughing-goggles-jjq4wjpg49wq3qr95.github.dev/";
const cookiesPath = path.join(__dirname, "cookies.json");

let browser, page;

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initBrowser() {
    try {
        if (browser) await browser.close();

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
        await page.emulate({
            viewport: { width: 412, height: 915, isMobile: true },
            userAgent:
                "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Mobile Safari/537.36",
        });

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath));
            await page.setCookie(...cookies);
        }

        let retries = 3;
        while (retries > 0) {
            try {
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
                await page.waitForSelector("body", { timeout: 60000 });
                await page.waitForFunction(() => document.readyState === "complete");
                await wait(2000);
                fs.writeFileSync(cookiesPath, JSON.stringify(await page.cookies(), null, 2));
                console.log("✅ Puppeteer is running.");
                break;
            } catch (error) {
                console.error("❌ Error loading page:", error);
                retries--;
                if (retries === 0) throw error;
                await wait(5000);
            }
        }
    } catch (error) {
        console.error("❌ Failed to start Puppeteer:", error);
        setTimeout(initBrowser, 5000);
    }
}

app.use(async (req, res, next) => {
    if (!page) {
        console.log("⏳ Initializing Puppeteer...");
        await initBrowser();
    }
    next();
});

app.get("/ss", async (req, res) => {
    try {
        const screenshotPath = path.resolve(__dirname, `screenshot_${Date.now()}.jpeg`);
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

app.get("/reload", async (req, res) => {
    try {
        await initBrowser();
        res.json({ message: "The page is reloaded" });
    } catch (error) {
        console.error("❌ Reload error:", error);
        res.status(500).json({ error: "Failed to reload page" });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await initBrowser();
});
