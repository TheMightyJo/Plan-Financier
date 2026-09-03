// Générateur du blog statique (SEO) — sans dépendance.
// ---------------------------------------------------------------------------
// Lit content/blog/*.md (front-matter + Markdown minimal) et produit, après
// `vite build`, des pages HTML pures dans dist/ :
//   dist/blog/index.html            liste des articles
//   dist/blog/<slug>/index.html     un article
//   dist/sitemap.xml                accueil + blog + articles
//   dist/robots.txt
// Les pages sont servies telles quelles par Apache (le .htaccess ne réécrit
// pas les fichiers/dossiers existants) : indexables sans JavaScript.
//
// Usage : node scripts/build-blog.mjs   (branché dans `npm run build`)
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_DIR = join(ROOT, 'content', 'blog')
const DIST_DIR = join(ROOT, 'dist')
const SITE = 'https://planfinancier.app'
const BRAND = 'Plan Financier'
const OG_IMAGE = `${SITE}/og-image.png`
const LOGO_IMAGE = `${SITE}/logo.png`
/** Symbole de marque inline (traits en currentColor → suit le thème). */
const BRAND_MARK = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="vertical-align:-0.2em;margin-right:.35em"><line x1="16" y1="12" x2="16" y2="56" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M16 12 H30 A14 14 0 0 1 44 26" stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M44 26 A14 14 0 0 1 30 40 H24" stroke="#B8963E" stroke-width="9" stroke-linecap="round" fill="none"/></svg>`

// ── Front-matter ──────────────────────────────────────────────────────────

const parseFrontMatter = (raw) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return { meta: {}, body: raw }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return { meta, body: match[2] }
}

// ── Markdown minimal → HTML ───────────────────────────────────────────────

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (text) =>
  escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const external = /^https?:\/\//.test(href) && !href.startsWith(SITE)
      return `<a href="${href}"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`
    })

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const markdownToHtml = (markdown) => {
  const blocks = markdown.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
  const html = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const first = lines[0]
    const heading = /^(#{1,3})\s+(.+)$/.exec(first)
    if (heading && lines.length === 1) {
      const level = Math.max(2, heading[1].length) // h1 réservé au titre de page : # et ## → h2, ### → h3
      const text = heading[2].trim()
      html.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`)
      continue
    }
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      html.push(`<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      html.push(`<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`)
      continue
    }
    if (lines.every((line) => /^>\s?/.test(line))) {
      html.push(`<blockquote><p>${inline(lines.map((line) => line.replace(/^>\s?/, '')).join(' '))}</p></blockquote>`)
      continue
    }
    html.push(`<p>${inline(lines.join(' '))}</p>`)
  }
  return html.join('\n')
}

// ── Gabarit HTML ──────────────────────────────────────────────────────────

const STYLES = `
:root{color-scheme:light dark;--bg:#FDFAF6;--surface:#FFFFFF;--soft:#F4EEE4;--border:#E6DCCB;--text:#2A1810;--text-2:#6B5644;--accent:#B8963E;--terracotta:#C05C2A;--green:#3A7D44}
@media (prefers-color-scheme:dark){:root{--bg:#1F1410;--surface:#2A1810;--soft:#33221A;--border:#4A3628;--text:#FDFAF6;--text-2:#D6C5B0}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
a{color:var(--terracotta)}a:hover{text-decoration-thickness:2px}
.wrap{max-width:44rem;margin:0 auto;padding:0 1.1rem}
header.site{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:3.6rem}
.brand{font-weight:400;color:var(--text);text-decoration:none;font-size:1.05rem;white-space:nowrap;display:inline-flex;align-items:center}.brand strong{font-weight:800;margin-right:.3em}
nav.site{white-space:nowrap}
nav.site a{color:var(--text-2);text-decoration:none;font-weight:600;margin-left:1rem;font-size:.95rem}
@media (max-width:480px){.brand{font-size:.95rem}nav.site a{margin-left:.7rem;font-size:.88rem}nav.site a.hide-sm{display:none}}
nav.site a:hover{color:var(--text)}
main{padding:2.2rem 0 3rem}
h1{font-size:clamp(1.75rem,4.5vw,2.5rem);line-height:1.15;margin:0 0 .6rem}
h2{font-size:1.45rem;margin:2rem 0 .6rem;line-height:1.25}
h3{font-size:1.15rem;margin:1.5rem 0 .4rem}
p,li{color:var(--text)}
.meta{color:var(--text-2);font-size:.92rem;margin:0 0 1.6rem}
.lead{font-size:1.12rem;color:var(--text-2)}
blockquote{margin:1.4rem 0;padding:.9rem 1.1rem;border-left:4px solid var(--accent);background:var(--soft);border-radius:.6rem}
blockquote p{margin:0}
code{background:var(--soft);padding:.1em .35em;border-radius:.35rem;font-size:.92em}
.cta{margin:2.4rem 0 0;padding:1.4rem;border-radius:1rem;background:var(--soft);border:1px solid var(--border);text-align:center}
.cta h2{margin:0 0 .4rem;font-size:1.25rem}
.cta p{margin:0 0 1rem;color:var(--text-2)}
.btn{display:inline-block;padding:.75rem 1.3rem;border-radius:999px;background:linear-gradient(130deg,#8B6C52,#B8963E);color:#fff;font-weight:700;text-decoration:none}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--border);margin-left:.5rem}
.posts{list-style:none;padding:0;margin:0;display:grid;gap:1rem}
.posts li{padding:1.2rem;border-radius:1rem;background:var(--surface);border:1px solid var(--border)}
.posts h2{margin:0 0 .35rem;font-size:1.25rem}
.posts h2 a{color:var(--text);text-decoration:none}
.posts h2 a:hover{color:var(--terracotta)}
.posts p{margin:0;color:var(--text-2)}
.posts time{display:block;margin-top:.5rem;color:var(--text-2);font-size:.88rem}
.related{margin-top:2.4rem;padding-top:1.4rem;border-top:1px solid var(--border)}
.related h2{font-size:1.15rem;margin:0 0 .6rem}
.related ul{margin:0;padding-left:1.2rem}
footer.site{border-top:1px solid var(--border);padding:1.6rem 0;color:var(--text-2);font-size:.9rem}
footer.site a{color:var(--text-2)}
`

const layout = ({ title, description, canonical, body, jsonLd, ogType }) => `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#8B6C52" />
  <meta property="og:site_name" content="${BRAND}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${OG_IMAGE}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${STYLES}</style>
</head>
<body>
  <header class="site">
    <div class="wrap">
      <a class="brand" href="/">${BRAND_MARK(22)}<strong>Plan</strong> Financier</a>
      <nav class="site" aria-label="Site">
        <a href="/blog/">Blog</a>
        <a href="/#tarifs" class="hide-sm">Tarifs</a>
        <a href="/login">Se connecter</a>
      </nav>
    </div>
  </header>
  <main class="wrap">
${body}
  </main>
  <footer class="site">
    <div class="wrap">
      © ${new Date().getFullYear()} ${BRAND} · Fait en France 🇫🇷 par ProtoJo Digital · <a href="/">Accueil</a> · <a href="/blog/">Blog</a> · <a href="/demo">Essayer la démo</a>
    </div>
  </footer>
</body>
</html>
`

const ctaBlock = `
<aside class="cta">
  <h2>Envie de voir clair dans votre budget ?</h2>
  <p>Plan Financier : calendrier des dépenses, poches d'argent, assistant IA — sans connexion bancaire. Gratuit pour commencer.</p>
  <a class="btn" href="/login">Créer mon compte gratuit</a><a class="btn ghost" href="/demo">Essayer la démo</a>
</aside>`

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// ── Construction ──────────────────────────────────────────────────────────

if (!existsSync(DIST_DIR)) {
  console.error('build-blog: dist/ introuvable — lancez `vite build` d’abord.')
  process.exit(1)
}

const posts = readdirSync(CONTENT_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const { meta, body } = parseFrontMatter(readFileSync(join(CONTENT_DIR, file), 'utf8'))
    const slug = meta.slug || file.replace(/\.md$/, '')
    if (!meta.title || !meta.description || !meta.date) {
      throw new Error(`build-blog: front-matter incomplet (title/description/date) dans ${file}`)
    }
    return { slug, title: meta.title, description: meta.description, date: meta.date, html: markdownToHtml(body) }
  })
  .sort((a, b) => b.date.localeCompare(a.date))

for (const post of posts) {
  const url = `${SITE}/blog/${post.slug}/`
  const related = posts.filter((other) => other.slug !== post.slug).slice(0, 3)
  const body = `
<article>
  <h1>${escapeHtml(post.title)}</h1>
  <p class="meta">Publié le <time datetime="${post.date}">${formatDate(post.date)}</time> · ${BRAND}</p>
  <p class="lead">${escapeHtml(post.description)}</p>
${post.html}
</article>
${ctaBlock}
<section class="related">
  <h2>À lire aussi</h2>
  <ul>${related.map((r) => `<li><a href="/blog/${r.slug}/">${escapeHtml(r.title)}</a></li>`).join('')}</ul>
</section>`
  const html = layout({
    title: `${post.title} — ${BRAND}`,
    description: post.description,
    canonical: url,
    body,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      inLanguage: 'fr-FR',
      mainEntityOfPage: url,
      image: OG_IMAGE,
      author: { '@type': 'Organization', name: 'ProtoJo Digital' },
      publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: LOGO_IMAGE } },
    },
  })
  const dir = join(DIST_DIR, 'blog', post.slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
}

const indexBody = `
<h1>Le blog Plan Financier</h1>
<p class="lead">Des conseils concrets pour tenir le budget de la famille : méthodes simples, pièges à éviter, et de quoi respirer en fin de mois.</p>
<ul class="posts">
${posts
  .map(
    (post) => `  <li>
    <h2><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h2>
    <p>${escapeHtml(post.description)}</p>
    <time datetime="${post.date}">${formatDate(post.date)}</time>
  </li>`,
  )
  .join('\n')}
</ul>
${ctaBlock}`

writeFileSync(
  join(DIST_DIR, 'blog', 'index.html'),
  layout({
    title: `Blog budget familial — ${BRAND}`,
    description: 'Conseils pratiques pour gérer le budget de la famille : méthode des enveloppes, règle 50/30/20, dépenses invisibles, et plus.',
    canonical: `${SITE}/blog/`,
    body: indexBody,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `Blog ${BRAND}`,
      url: `${SITE}/blog/`,
      inLanguage: 'fr-FR',
      publisher: { '@type': 'Organization', name: BRAND },
    },
  }),
)

const urls = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'weekly' },
  { loc: `${SITE}/blog/`, priority: '0.8', changefreq: 'weekly' },
  ...posts.map((post) => ({ loc: `${SITE}/blog/${post.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: post.date })),
]
writeFileSync(
  join(DIST_DIR, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
)

writeFileSync(
  join(DIST_DIR, 'robots.txt'),
  `User-agent: *
Allow: /
Disallow: /app
Sitemap: ${SITE}/sitemap.xml
`,
)

console.log(`build-blog: ${posts.length} article(s) → dist/blog/, sitemap.xml, robots.txt`)
