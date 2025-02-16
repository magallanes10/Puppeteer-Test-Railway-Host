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
    try {
        if (browser) await browser.close(); // Close existing browser if any

        console.log("🔄 Restarting Puppeteer...");
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
        await page.waitForTimeout(2000); // Extra stability

        console.log("✅ Puppeteer is running in mobile view and page is fully loaded.");
    } catch (error) {
        console.error("❌ Failed to start Puppeteer:", error);
        setTimeout(initBrowser, 5000); // Retry after 5 seconds
    }
}

// ✅ Middleware to auto-fix crashes
app.use(async (req, res, next) => {
    if (!page) {
        console.log("⏳ Re-initializing Puppeteer...");
        await initBrowser();
    }
    next();
});

// ✅ Screenshot Route - Auto-reconnects on error
app.get("/ss", async (req, res) => {
    try {
        if (!page) throw new Error("Browser not initialized");

        // Ensure page is still connected
        if (!page.isClosed()) {
            console.log("📸 Capturing new screenshot...");
            const screenshotPath = path.resolve(__dirname, `screenshot-${Date.now()}.jpeg`);

            await page.waitForSelector("body", { timeout: 60000 });
            await page.waitForFunction(() => document.readyState === "complete");
            await page.waitForTimeout(2000); // Extra wait before screenshot

            await page.screenshot({ 
                path: screenshotPath, 
                type: "jpeg", 
                quality: 80, 
                fullPage: true 
            });

            res.sendFile(screenshotPath, (err) => {
                if (err) {
                    console.error("❌ Screenshot send error:", err);
                    res.status(500).json({ error: "Failed to send screenshot" });
                }
                // ✅ Delete old screenshot after sending
                fs.unlink(screenshotPath, (unlinkErr) => {
                    if (unlinkErr) console.error("❌ Error deleting temp file:", unlinkErr);
                });
            });

        } else {
            throw new Error("Page disconnected");
        }

    } catch (error) {
        console.error("❌ Screenshot error:", error);
        await initBrowser(); // Restart Puppeteer if error occurs
        res.status(500).json({ error: "Puppeteer restarted due to an error" });
    }
});

// ✅ Reload Route - Auto-reconnects on error
app.get("/reload", async (req, res) => {
    try {
        if (!page) throw new Error("Browser not initialized");

        console.log("🔄 Reloading page...");
        await page.reload({ waitUntil: "domcontentloaded" });

        await page.waitForSelector("body", { timeout: 60000 });
        await page.waitForFunction(() => document.readyState === "complete");

        console.log("✅ Page reloaded.");
        res.json({ message: "The page is reloaded" });

    } catch (error) {
        console.error("❌ Reload error:", error);
        await initBrowser(); // Restart Puppeteer if error occurs
        res.status(500).json({ error: "Puppeteer restarted due to an error" });
    }
});

// ✅ Info Route - Auto-reconnects on error
app.get("/info", async (req, res) => {
    try {
        if (!page) throw new Error("Browser not initialized");

        const version = await browser.version();
        const userAgent = await page.evaluate(() => navigator.userAgent);

        res.json({
            puppeteer_version: require("puppeteer/package.json").version,
            browser_version: version,
            user_agent: userAgent,
        });

    } catch (error) {
        console.error("❌ Info error:", error);
        await initBrowser(); // Restart Puppeteer if error occurs
        res.status(500).json({ error: "Puppeteer restarted due to an error" });
    }
});

// Start server & initialize Puppeteer
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await initBrowser();
});
