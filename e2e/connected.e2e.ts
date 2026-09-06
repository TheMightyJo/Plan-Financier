import { test, expect } from '@playwright/test'

/**
 * Parcours connecté (compte de test Supabase). Ignoré si les identifiants
 * ne sont pas fournis : E2E_EMAIL et E2E_PASSWORD (cf. docs/tests-e2e.md).
 * Le compte doit exister, être confirmé, et servir uniquement aux tests :
 * les données créées ici sont supprimées en fin de test.
 */
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.describe('Parcours connecté', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD non définis')

  test('connexion, ajout d’une opération, persistance après rechargement, suppression', async ({ page }) => {
    const label = `E2E ${Date.now()}`
    await page.goto('/login')
    await page.fill('input[type="email"]', EMAIL!)
    await page.fill('input[type="password"]', PASSWORD!)
    await page.locator('form button[type="submit"]').click()
    await expect(page.locator('[data-tour="quick-add"]')).toBeVisible({ timeout: 30_000 })

    // Ajout via la modale rapide.
    await page.locator('[data-tour="quick-add"]').click()
    await page.fill('input[placeholder="Ex: Courses Carrefour"]', label)
    await page.fill('input[placeholder="Ex: 42,50"]', '12')
    await page.locator('form button[type="submit"].hero-cta-button').last().click()
    await expect(page.locator('.app-toast')).toContainText(/ajout/i, { timeout: 10_000 })

    // Persistance : après rechargement, l'opération est toujours là (locale + cloud).
    await page.waitForTimeout(3_500)
    await page.reload()
    await expect(page.locator('[data-tour="quick-add"]')).toBeVisible({ timeout: 30_000 })
    await page.locator('.side-menu nav button', { hasText: 'Dépenses' }).click()
    await page.fill('.tx-search', label)
    await expect(page.locator('.transaction-list')).toContainText(label, { timeout: 10_000 })

    // Nettoyage : suppression depuis la liste.
    const row = page.locator('.transaction-list li', { hasText: label }).first()
    await row.locator('.tx-delete').click()
    await row.locator('.tx-confirm-yes').click()
    await expect(page.locator('.transaction-list')).not.toContainText(label, { timeout: 10_000 })
  })

  test('déconnexion ramène à l’écran de connexion', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', EMAIL!)
    await page.fill('input[type="password"]', PASSWORD!)
    await page.locator('form button[type="submit"]').click()
    await expect(page.locator('[data-tour="quick-add"]')).toBeVisible({ timeout: 30_000 })
    await page.locator('.side-menu button', { hasText: 'Déconnexion' }).click()
    await expect(page.locator('form button[type="submit"]')).toBeVisible({ timeout: 15_000 })
  })
})
