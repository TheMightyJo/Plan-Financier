import { test, expect } from '@playwright/test'

const SHOTS = process.env.TOUR_SHOTS_DIR

/** Tour guidé forcé (?tour=1) en démo : projecteur aligné sur la cible, étapes, fin. */
test.describe('Tour guidé', () => {
  test('met en lumière les cibles, saute Cash en démo et se termine', async ({ page }) => {
    await page.goto('/demo?tour=1')
    const bubble = page.locator('.tour-bubble')
    await expect(bubble).toContainText('Bienvenue dans Plan Financier', { timeout: 10_000 })
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tour-1.png` })

    await bubble.getByRole('button', { name: 'Suivant' }).click()
    await expect(bubble.locator('h3')).toHaveText('Votre reste à dépenser')
    const spotlight = page.locator('.tour-spotlight')
    await expect(spotlight).toBeVisible()
    // Laisse la transition de position du projecteur se terminer.
    await page.waitForTimeout(400)
    const hero = await page.locator('[data-tour="hero"]').boundingBox()
    const spot = await spotlight.boundingBox()
    expect(hero).not.toBeNull()
    expect(spot).not.toBeNull()
    // Projecteur = cible + 8 px de marge.
    expect(Math.abs(spot!.x - (hero!.x - 8))).toBeLessThan(3)
    expect(Math.abs(spot!.y - (hero!.y - 8))).toBeLessThan(3)
    expect(Math.abs(spot!.width - (hero!.width + 16))).toBeLessThan(3)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tour-2.png` })

    // Étapes 3 → 5 (ajout rapide, Dépenses, Budget).
    for (const title of ['Ajouter en 3 secondes', 'Dépenses et calendrier', 'Budget : poches et objectifs']) {
      await bubble.getByRole('button', { name: 'Suivant' }).click()
      await expect(bubble.locator('h3')).toHaveText(title)
      await expect(spotlight).toBeVisible()
    }
    await page.waitForTimeout(400)
    const nav = await page.locator('[data-tour="nav-budget"]').boundingBox()
    const spotNav = await spotlight.boundingBox()
    expect(Math.abs(spotNav!.x - (nav!.x - 8))).toBeLessThan(3)
    expect(Math.abs(spotNav!.y - (nav!.y - 8))).toBeLessThan(3)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tour-5.png` })

    // Statistiques, puis Cash (absent en démo → sauté) → Paramètres.
    await bubble.getByRole('button', { name: 'Suivant' }).click()
    await expect(bubble.locator('h3')).toHaveText('Statistiques semaine par semaine')
    await bubble.getByRole('button', { name: 'Suivant' }).click()
    await expect(bubble.locator('h3')).toHaveText('Paramètres', { timeout: 5_000 })
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/tour-8.png` })

    await bubble.getByRole('button', { name: "C'est parti !" }).click()
    await expect(bubble).toHaveCount(0)
  })

  test('« Passer le tour » ferme immédiatement', async ({ page }) => {
    await page.goto('/demo?tour=1')
    const bubble = page.locator('.tour-bubble')
    await expect(bubble).toBeVisible({ timeout: 10_000 })
    await bubble.locator('.tour-skip').click()
    await expect(bubble).toHaveCount(0)
    await expect(page.locator('.tour-root')).toHaveCount(0)
  })
})
