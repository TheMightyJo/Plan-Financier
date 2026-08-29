// Avatars de profils : initiales + couleur déterministe (aucun champ avatar en
// base — on dérive tout du nom / de l'id). Pur et testable.

// Palette issue de la charte (teintes distinctes pour différencier les profils).
const AVATAR_PALETTE = ['#3A7D44', '#C05C2A', '#6B5B8A', '#B8963E', '#8B6C52', '#A08060']

/** 1 à 2 lettres majuscules représentant le profil (ex. « Moi » → « MO »). */
export const avatarInitials = (name: string): string => {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

/** Couleur stable pour un profil donné (même seed → même couleur). */
export const avatarColor = (seed: string): string => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

/**
 * Presets d'avatars « argent » : des emoji, donc libres de droit par nature —
 * aucune image tierce à héberger ni licence à vérifier.
 */
export const MONEY_AVATAR_PRESETS = [
  '💰', '🐷', '💳', '📈', '🪙', '💶', '🏦', '💎', '📊', '🧮', '🎯', '🔐',
] as const

/** Taille maxi acceptée pour une photo importée (data URI en localStorage). */
export const AVATAR_MAX_DATA_URI_LENGTH = 200_000

/**
 * Lit un fichier image et le réduit en carré `size`×`size` (crop centré),
 * renvoyé en data URI JPEG compact — adapté au stockage localStorage.
 */
export const readAndResizeImage = (file: File, size = 96): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('canvas unavailable'))
        return
      }
      // Crop carré centré puis réduction.
      const side = Math.min(image.width, image.height)
      const sx = (image.width - side) / 2
      const sy = (image.height - side) / 2
      context.drawImage(image, sx, sy, side, side, 0, 0, size, size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      if (dataUrl.length > AVATAR_MAX_DATA_URI_LENGTH) {
        reject(new Error('image too large'))
        return
      }
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable image'))
    }
    image.src = url
  })
