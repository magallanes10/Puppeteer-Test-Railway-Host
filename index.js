const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const MAIL_API = "https://api.tempmail.lol/v2";
const UA =
  "Mozilla/5.0 (Linux; Android 12; Infinix X669 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.79 Mobile Safari/537.36";

let browser;

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUser() {
  const { data } = await axios.get("https://randomuser.me/api");
  return data.results[0];
}

function genPass() {
  const rand = Math.random().toString(36).slice(2, 8);
  const num = Math.floor(Math.random() * 1000);
  return `JrDevccprojects${rand}${num}@`;
}

async function makeTempEmail() {
  try {
    const { data } = await axios.post(
      `${MAIL_API}/inbox/create`,
      { domain: null },
      {
        headers: {
          "User-Agent": UA,
          Referer: "https://tempmail.lol/en/",
        },
      }
    );
    return data;
  } catch (e) {
    throw new Error("Email creation failed: " + e.message);
  }
}

async function getEmails(token) {
  try {
    const { data } = await axios.get(`${MAIL_API}/inbox?token=${token}`, {
      headers: { "User-Agent": UA },
    });
    return data.emails || [];
  } catch {
    return [];
  }
}

async function initBrowser() {
  try {
    if (browser) await browser.close();

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-infobars",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dev-shm-usage",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36",
      ],
    });

    console.log("✅ Puppeteer initialized.");
  } catch (error) {
    console.error("❌ Failed to start Puppeteer:", error);
    setTimeout(initBrowser, 5000);
  }
}

app.use(async (req, res, next) => {
  if (!browser) {
    console.log("⏳ Initializing Puppeteer...");
    await initBrowser();
  }
  next();
});

app.get("/create", async (req, res) => {
  try {
    const user = await fetchUser();
    const { address: email, token } = await makeTempEmail();
    const pass = genPass();
    console.log("📧 Temp email:", email);

    const page = await browser.newPage();
    await page.goto("https://www.facebook.com/r.php", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.type('[name="firstname"]', user.name.first, { delay: 100 });
    await page.type('[name="lastname"]', user.name.last, { delay: 100 });
    await page.type('[name="reg_email__"]', email, { delay: 100 });
    await page.type('[name="reg_passwd__"]', pass, { delay: 100 });

    const dob = new Date(user.dob.date);
    await page.select("#day", dob.getDate().toString());
    await page.select("#month", (dob.getMonth() + 1).toString());
    await page.select("#year", dob.getFullYear().toString());

    await page.click(`input[value="${user.gender === "male" ? 2 : 1}"]`);
    await wait(1000);
    await page.click('button[name="websubmit"]');

    console.log("🔍 Looking for verification code...");
    let code;
    for (let i = 0; i < 12 && !code; i++) {
      await wait(10000);
      const emails = await getEmails(token);
      const fbMail = emails.find((e) => e.subject.includes("FB-"));
      code = fbMail?.body.match(/FB-(\d{5})/)?.[1];

      if (code) {
        console.log("✅ Got verification code:", code);
      }
    }

    if (code) {
      await page.type('[name="code"]', code, { delay: 100 });
      await page.click('[name="confirm"]');
      console.log("🎉 Facebook account created successfully!");

      res.json({
        message: "✅ Facebook account created!",
        email,
        password: pass,
      });
    } else {
      console.log("❌ No verification code received.");
      res.status(500).json({ error: "Failed to verify account" });
    }

    await page.close();
  } catch (error) {
    console.error("❌ Account creation error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.get("/info", async (req, res) => {
  try {
    const version = await browser.version();
    const page = await browser.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await page.close();

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

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initBrowser();
});
