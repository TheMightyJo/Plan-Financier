# Templates email Supabase Auth

Templates HTML français aux couleurs charte Plan Financier, à coller dans :
**Supabase Dashboard → Authentication → Email Templates**

Variables disponibles (injectées par Supabase) :
- `{{ .ConfirmationURL }}` — lien de confirmation/reset
- `{{ .Token }}` — code OTP (si activé)
- `{{ .SiteURL }}` — URL du site (configurable dans Auth → URL Configuration)
- `{{ .Email }}` — email du destinataire

> ⚠️ Pense à mettre à jour **Auth → URL Configuration → Site URL** sur ton URL réelle (en dev : `http://localhost:5173`, en prod : ton domaine).

---

## 1. Confirm signup — sujet

```
Confirmez votre compte Plan Financier
```

## 1. Confirm signup — corps HTML

À coller dans **Email Templates → Confirm signup → Message body** :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmez votre compte Plan Financier</title>
</head>
<body style="margin:0;padding:0;background:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3D2B1F;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5EFE6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#FDFAF6;border-radius:16px;border:0.5px solid rgba(0,0,0,0.06);overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#8B6C52;text-align:center;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:600;color:#FFF8F0;letter-spacing:-1px;line-height:48px;">FP</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="font-size:18px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Plan Financier</div>
                    <div style="font-size:11px;color:#A08060;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Votre budget, simplement</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Bienvenue 👋</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3D2B1F;">
                Plus qu'une étape pour activer votre compte Plan Financier.
                Confirmez votre email en cliquant sur le bouton ci-dessous —
                vous serez automatiquement connecté·e.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 28px;background:#8B6C52;color:#FFF8F0;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                      Activer mon compte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 8px 32px;">
              <p style="margin:0;font-size:13px;color:#A08060;line-height:1.6;">
                Le bouton ne fonctionne pas ? Copiez-collez ce lien dans votre navigateur :
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#8B6C52;word-break:break-all;font-family:'SF Mono',Consolas,monospace;background:#F5EFE6;padding:10px 12px;border-radius:8px;border:0.5px solid #D6C5B0;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;">
              <div style="border-top:0.5px solid #D6C5B0;padding-top:20px;">
                <p style="margin:0 0 8px 0;font-size:12px;color:#A08060;line-height:1.6;">
                  <strong style="color:#3D2B1F;">Confidentialité :</strong>
                  vos données financières restent sur votre appareil. Plan Financier
                  utilise Supabase (région EU) uniquement pour l'authentification.
                  L'IA, quand activée, ne reçoit jamais vos noms ni montants exacts.
                </p>
                <p style="margin:8px 0 0 0;font-size:12px;color:#A08060;line-height:1.6;">
                  Si vous n'êtes pas à l'origine de cette inscription, ignorez ce
                  message — aucun compte ne sera créé.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#A08060;text-transform:uppercase;letter-spacing:0.07em;">
                Plan Financier — Votre budget, simplement
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Reset password — sujet

```
Réinitialisez votre mot de passe Plan Financier
```

## 2. Reset password — corps HTML

À coller dans **Email Templates → Reset password → Message body** :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Réinitialisez votre mot de passe</title>
</head>
<body style="margin:0;padding:0;background:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3D2B1F;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5EFE6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#FDFAF6;border-radius:16px;border:0.5px solid rgba(0,0,0,0.06);overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#8B6C52;text-align:center;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:600;color:#FFF8F0;letter-spacing:-1px;line-height:48px;">FP</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="font-size:18px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Plan Financier</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0 32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Réinitialisation du mot de passe</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3D2B1F;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur
                le bouton ci-dessous pour en choisir un nouveau.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 28px;background:#8B6C52;color:#FFF8F0;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                      Choisir un nouveau mot de passe
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 8px 32px;">
              <p style="margin:0;font-size:13px;color:#A08060;line-height:1.6;">
                Le bouton ne fonctionne pas ? Copiez-collez ce lien :
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#8B6C52;word-break:break-all;font-family:'SF Mono',Consolas,monospace;background:#F5EFE6;padding:10px 12px;border-radius:8px;border:0.5px solid #D6C5B0;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 28px 32px;">
              <div style="border-top:0.5px solid #D6C5B0;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#A08060;line-height:1.6;">
                  Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine
                  de cette demande, ignorez ce message — votre mot de passe actuel
                  reste inchangé.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link — sujet (optionnel, V2)

```
Connectez-vous à Plan Financier
```

## 3. Magic Link — corps HTML

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3D2B1F;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5EFE6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#FDFAF6;border-radius:16px;border:0.5px solid rgba(0,0,0,0.06);overflow:hidden;">
          <tr>
            <td style="padding:32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="width:48px;height:48px;border-radius:14px;background:#8B6C52;text-align:center;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:600;color:#FFF8F0;letter-spacing:-1px;line-height:48px;">FP</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="font-size:18px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Plan Financier</div>
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;color:#3D2B1F;letter-spacing:-0.5px;">Votre lien de connexion</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3D2B1F;">
                Cliquez sur le bouton pour vous connecter sans mot de passe.
                Le lien est valable 1 heure.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 28px;background:#8B6C52;color:#FFF8F0;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                      Se connecter
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#A08060;line-height:1.6;border-top:0.5px solid #D6C5B0;padding-top:16px;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Étapes côté Dashboard Supabase

1. https://supabase.com/dashboard/project/lgcprvjpemvphjicubaf/auth/templates
2. Sélectionner le template à modifier (Confirm signup, Reset password…)
3. Onglet "Source" → coller le sujet + le HTML
4. Cliquer **Save**
5. (Optionnel) Onglet "Preview" → vérifier le rendu

## Notes techniques

- Les emails Supabase sont envoyés via leur **SMTP par défaut** (rate-limité à ~4 emails/heure en free tier). Pour la prod, configurer un SMTP custom : **Project Settings → Auth → SMTP Settings** (Resend, Postmark, SendGrid…).
- Le rendu peut varier entre Gmail, Outlook, Apple Mail. Le template est volontairement table-based (inline styles only) pour compat email-client maximale.
- Logo : pour V1 c'est juste un carré "FP" en CSS pur. Pour V1.5 on peut héberger une image PNG dans Supabase Storage et la référencer en `<img>` (mais attention à la CSP des clients mail).
