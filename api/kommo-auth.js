// api/kommo-auth.js
// Handles Kommo OAuth callback — exchanges code for tokens, stores in Blob

import { put } from '@vercel/blob';

export const config = { maxDuration: 30 };

const CLIENT_ID     = process.env.KOMMO_CLIENT_ID;
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET;
const SUBDOMAIN     = process.env.KOMMO_SUBDOMAIN;
const REDIRECT_URI  = process.env.KOMMO_REDIRECT_URI || 'https://acacia-estimator.vercel.app/api/kommo-auth';

export default async function handler(req, res) {
  // ── Handle OAuth callback (GET with ?code=...) ────────────────────────────
  if (req.method === 'GET') {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`/?kommo_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      // No code — show the "Connect to Kommo" button
      const authUrl = `https://www.kommo.com/oauth/?client_id=${CLIENT_ID}&state=acacia&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&mode=popup`;
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Connect Kommo</title>
          <style>
            body { font-family: Georgia, serif; background: #f7f5f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #fff; border: 1px solid #e8e2d8; border-radius: 12px; padding: 40px 44px; max-width: 400px; text-align: center; }
            .logo { width: 44px; height: 44px; background: #c8a84b; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; color: #1a1714; margin: 0 auto 18px; }
            h2 { color: #1a1714; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
            p { color: #8a7a60; font-size: 13px; margin-bottom: 28px; line-height: 1.6; }
            a { display: inline-block; background: #c8a84b; color: #1a1714; text-decoration: none; border-radius: 6px; padding: 11px 28px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">A</div>
            <h2>Connect Kommo CRM</h2>
            <p>Click below to authorize Acacia Estimator to access your Kommo account.</p>
            <a href="${authUrl}">Authorize with Kommo</a>
          </div>
        </body>
        </html>
      `);
    }

    // Exchange code for tokens
    try {
      const tokenRes = await fetch(`https://${SUBDOMAIN}.kommo.com/oauth2/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok || tokens.error) {
        throw new Error(tokens.hint || tokens.detail || 'Token exchange failed');
      }

      // Store tokens in Blob
      await put('kommo/tokens.json', JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        token_type: tokens.token_type,
        saved_at: new Date().toISOString(),
      }), {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: 'application/json',
        allowOverwrite: true,
      });

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Kommo Connected</title>
          <style>
            body { font-family: Georgia, serif; background: #f7f5f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #fff; border: 1px solid #e8e2d8; border-radius: 12px; padding: 40px 44px; max-width: 400px; text-align: center; }
            .check { font-size: 48px; margin-bottom: 16px; }
            h2 { color: #1a1714; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
            p { color: #8a7a60; font-size: 13px; margin-bottom: 28px; }
            a { display: inline-block; background: #1a1714; color: #c8a84b; text-decoration: none; border-radius: 6px; padding: 11px 28px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="check">✓</div>
            <h2>Kommo Connected!</h2>
            <p>Your Kommo account is now linked to Acacia Estimator.</p>
            <a href="/">Back to Estimator</a>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      return res.status(500).send(`
        <!DOCTYPE html><html><body style="font-family:Georgia,serif;text-align:center;padding:60px">
        <h2 style="color:#c05040">Connection Failed</h2>
        <p>${err.message}</p>
        <a href="/api/kommo-auth">Try again</a>
        </body></html>
      `);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
