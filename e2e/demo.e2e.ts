import { expect, test } from '@playwright/test'

test.describe('Mode démo', () => {
  test('ouvre la démo avec ses données et permet d’ajouter une dépense', async ({ page, isMobile }) => {
    await page.goto('/demo')
    await expect(page.getByText('Mode démo')).toBeVisible()
    // Données de démonstration présentes (revenus du mois).
    await expect(page.getByText('Revenus ce mois', { exact: false }).first()).toBeVisible()
    await expect(page.locator('.kpi-card--secondary .kpi-card-value')).toContainText('2')

    // Premiers pas visibles (démo : objectif déjà présent, charge fixe absente).
    await expect(page.locator('.start-checklist')).toBeVisible()

    // Ajout rapide depuis le hero.
    await page.getByRole('button', { name: /ajouter une dépense ou un revenu/i }).click()
    const modal = page.locator('.quick-add-modal')
    await expect(modal).toBeVisible()
    await modal.getByPlaceholder('Ex: Courses Carrefour').fill('Boulangerie E2E')
    await modal.getByPlaceholder('Ex: 42,50').fill('4,20')
    await modal.getByRole('button', { name: /ajouter la dépense/i }).click()
    await expect(modal).toBeHidden()

    // La dépense apparaît dans la vue Dépenses (liste condensée : on filtre).
    await page.locator('.side-menu nav button[aria-label="Dépenses"]').click()
    await page.getByPlaceholder(/rechercher un libellé/i).fill('Boulangerie')
    await expect(page.getByText('Boulangerie E2E').first()).toBeVisible()

    if (isMobile) {
      // Barre d'onglets fixe en bas d'écran.
      const nav = page.locator('.side-menu nav')
      await expect(nav).toHaveCSS('position', 'fixed')
    }
  })

  test('bloque les actions réelles en démo (toast)', async ({ page }) => {
    await page.goto('/demo')
    await expect(page.getByText('Mode démo')).toBeVisible()
    await page.locator('.side-menu-settings-btn').click()
    await page.locator('.settings-nav button', { hasText: 'Abonnement' }).click()
    await page.locator('.subscription-plan__actions button').first().click()
    await expect(page.locator('.app-toast')).toContainText('Mode démo')
  })
})
