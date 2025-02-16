const express = require("express");
const puppeteer = require("puppeteer");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/screenshot", async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        const screenshot = await page.screenshot({ fullPage: true });

        await browser.close();

        res.setHeader("Content-Type", "image/png");
        res.send(screenshot);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to capture screenshot" });
    }
});

app.get("/info", async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const version = await browser.version();
        const page = await browser.newPage();
        const userAgent = await page.userAgent();

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
