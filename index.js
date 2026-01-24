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
const API_KEY = "xRDmp6nGSxVBZhLTBN6XIufrr";
const API_SECRET = "Y6Io44b92DtMzIL4MOWvqQ8ao5eYXB1hhrnmSuEB4XcvuP7kfV";
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
   LOGIN
   ========================= */
app.get("/", async (req, res) => {
  try {
    const requestData = {
      url: "https://api.twitter.com/oauth/request_token",
      method: "POST",
      data: { oauth_callback: CALLBACK_URL }
    };

    const headers = oauth.toHeader(oauth.authorize(requestData));

    const r = await axios.post(
      requestData.url,
      new URLSearchParams({ oauth_callback: CALLBACK_URL }),
      { headers }
    );

    const p = new URLSearchParams(r.data);
    const token = p.get("oauth_token");
    const secret = p.get("oauth_token_secret");

    requestTokens.set(token, secret);

    res.redirect(`https://api.twitter.com/oauth/authorize?oauth_token=${token}`);
  } catch (e) {
    console.error("LOGIN ERROR:", e.response?.data || e.message);
    res.send("Error iniciando login con X");
  }
});

/* =========================
   CALLBACK
   ========================= */
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

    const accessToken = p.get("oauth_token");
    const accessSecret = p.get("oauth_token_secret");

    await updateProfileImage(accessToken, accessSecret);

    res.redirect("https://twitter.com/home");

  } catch (e) {
    console.error("ACCESS TOKEN ERROR:", e.response?.data || e.message);
    res.send("Error finalizando autenticación");
  }
});

/* =========================
   SUBIR IMAGEN A MEDIA API
   ========================= */
async function uploadImage(key, secret) {
  const mediaData = fs.readFileSync("profile.jpg").toString("base64");

  const requestData = {
    url: "https://upload.twitter.com/1.1/media/upload.json",
    method: "POST"
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, { key, secret })
  );

  const r = await axios.post(
    requestData.url,
    new URLSearchParams({ media_data: mediaData }),
    { headers }
  );

  return r.data.media_id_string;
}

/* =========================
   APLICAR FOTO PERFIL
   ========================= */
async function updateProfileImage(key, secret) {
  const mediaId = await uploadImage(key, secret);

  const requestData = {
    url: "https://api.twitter.com/1.1/account/update_profile_image.json",
    method: "POST"
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, { key, secret })
  );

  await axios.post(
    requestData.url,
    new URLSearchParams({ media_id: mediaId }),
    { headers }
  );

  console.log("✅ Foto de perfil actualizada");
}

/* ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor listo en puerto", PORT));
