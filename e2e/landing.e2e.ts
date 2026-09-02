import { expect, test } from '@playwright/test'

test.describe('Vitrine', () => {
  test('affiche le hero et mène à la connexion puis revient', async ({ page }) => {
    await page.goto('/')
    // Laisse la vérification de session (Supabase) se terminer avant d'agir.
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre argent')
    await page.getByRole('button', { name: 'Se connecter' }).first().click()
    await expect(page.getByRole('textbox', { name: /email/i }).first()).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('button', { name: /retour au site/i }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre argent')
    await expect(page).toHaveURL(/\/$/)
  })

  test('les liens de la nav pointent vers les sections et le blog', async ({ page, isMobile }) => {
    test.skip(isMobile, 'liens de nav masqués sur mobile')
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Blog' }).first()).toHaveAttribute('href', '/blog/')
    await expect(page.getByRole('link', { name: 'Tarifs' })).toHaveAttribute('href', '#tarifs')
  })
})
