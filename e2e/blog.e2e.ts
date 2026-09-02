import { expect, test } from '@playwright/test'

test.describe('Blog statique et SEO', () => {
  test('la liste des articles et un article sont servis en HTML pur', async ({ page }) => {
    await page.goto('/blog/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('blog Plan Financier')
    const links = page.locator('.posts h2 a')
    expect(await links.count()).toBeGreaterThanOrEqual(6)

    await links.first().click()
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /planfinancier\.app\/blog\//)
    expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('BlogPosting')
    await expect(page.locator('article h2').first()).toBeVisible()
  })

  test('sitemap et robots sont publiés', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBeTruthy()
    const xml = await sitemap.text()
    expect((xml.match(/<loc>/g) ?? []).length).toBeGreaterThanOrEqual(8)

    const robots = await request.get('/robots.txt')
    expect(await robots.text()).toContain('Sitemap: https://planfinancier.app/sitemap.xml')
  })
})
