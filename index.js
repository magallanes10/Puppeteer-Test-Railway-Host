const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const url = "https://github.com/"; 
const cookiesPath = path.join(__dirname, "cookies.json");

let browser, page;

async function initBrowser() {
    browser = await puppeteer.launch({
        headless: false, 
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath));
        await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: "networkidle2" });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

    console.log("Browser initialized and page loaded.");
}

app.get("/ss", async (req, res) => {
    if (!page) {
        return res.status(500).json({ error: "Browser is not initialized yet." });
    }

    const screenshotPath = path.join(__dirname, "temp.jpeg");
    await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 80, fullPage: true });

    res.sendFile(screenshotPath, (err) => {
        if (err) {
            console.error("Error sending file:", err);
            res.status(500).json({ error: "Failed to send screenshot" });
        }
        fs.unlink(screenshotPath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
        });
    });
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initBrowser();
});
