const express = require("express");
const puppeteer = require("puppeteer");
const os = require("os");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/screenshot", async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        const screenshotPath = path.join(__dirname, "temp.jpeg");
        await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80, fullPage: true });

        await browser.close();

        res.sendFile(screenshotPath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).json({ error: "Failed to send screenshot" });
            }
            fs.unlink(screenshotPath, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to capture screenshot" });
    }
});

app.get("/info", async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const version = await browser.version();
        const page = await browser.newPage();

        const userAgent = await page.evaluate(() => navigator.userAgent);

        await browser.close();

        res.json({
            puppeteer_version: require("puppeteer/package.json").version,
            browser_version: version,
            os: {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
            },
            user_agent: userAgent,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch system info" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
