const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const MAIL_API = "https://api.tempmail.lol/v2";
const UA =
  "Mozilla/5.0 (Linux; Android 12; Infinix X669 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/132.0.6834.79 Mobile Safari/537.36";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    throw Error("Email creation failed: " + e.message);
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

async function createAccount() {
  const user = await fetchUser();
  const { address: email, token } = await makeTempEmail();
  const pass = genPass();

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-infobars",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.102 Safari/537.36",
    ],
  });

  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/r.php");

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

  let code;
  for (let i = 0; i < 12 && !code; i++) {
    await wait(10000);
    const emails = await getEmails(token);
    const fbMail = emails.find((e) => e.subject.includes("FB-"));
    code = fbMail?.body.match(/FB-(\d{5})/)?.[1];
  }

  if (code) {
    await page.type('[name="code"]', code, { delay: 100 });
    await page.click('[name="confirm"]');
    await browser.close();
    return { email, password: pass, verifycode: code, status: "success", message: "Facebook account created and verified" };
  } else {
    await browser.close();
    return { status: "error", message: "Failed to verify account. No code received." };
  }
}

app.get("/create", async (req, res) => {
  try {
    const accountData = await createAccount();
    res.json(accountData);
  } catch (error) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.get("/info", async (req, res) => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const version = await browser.version();
    const page = await browser.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await browser.close();

    res.json({
      puppeteer_version: require("puppeteer/package.json").version,
      browser_version: version,
      user_agent: userAgent,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch system info" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
