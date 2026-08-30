import { X } from 'lucide-react'

type Props = {
  /** 'privacy' = politique de confidentialité, 'terms' = CGU */
  doc: 'privacy' | 'terms'
  onClose: () => void
}

/**
 * Affiche en plein écran la politique de confidentialité ou les CGU.
 * Le contenu est versionné dans `docs/privacy-policy.md` ; ce composant
 * reprend la même structure en JSX pour ne pas dépendre d'un parser
 * markdown au runtime (poids bundle + couverture i18n simplifiée).
 */
export function PrivacyPolicyModal({ doc, onClose }: Props) {
  return (
    <div
      className="legal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={doc === 'privacy' ? 'Politique de confidentialité' : "Conditions d'utilisation"}
    >
      <div className="legal-modal glass-card">
        <header className="legal-header">
          <div>
            <span className="eyebrow">Mention légale</span>
            <h2>
              {doc === 'privacy'
                ? 'Politique de confidentialité'
                : "Conditions d'utilisation"}
            </h2>
            <p className="legal-subtitle">
              Version 1.0 — dernière mise à jour : 2026-05-16.
            </p>
          </div>
          <button
            type="button"
            className="legal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        <div className="legal-body">
          {doc === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  )
}

function PrivacyContent() {
  return (
    <>
      <p className="legal-note">
        Ce document est une <strong>version V1</strong> couvrant les obligations
        RGPD principales. Pour une activité commerciale soutenue, faire valider
        par un juriste.
      </p>

      <h3>1. Responsable du traitement</h3>
      <p>
        <strong>Éditeur :</strong> Johan Quille (auto-entrepreneur)<br />
        <strong>Adresse :</strong> 59 voie des sculpteurs, 92800 Puteaux, France<br />
        <strong>Contact RGPD :</strong>{' '}
        <a href="mailto:contact@protojo.fr">contact@protojo.fr</a>
      </p>
      <p>
        Plan Financier collecte et traite vos données dans le seul but de fournir
        le service. Vous pouvez exercer vos droits (accès, rectification,
        effacement, portabilité) directement depuis l'app — Settings →{' '}
        <em>Mes données RGPD</em> — ou par email à l'adresse ci-dessus.
      </p>

      <h3>2. Données collectées</h3>
      <ul>
        <li>
          <strong>Authentification</strong> : email + mot de passe (haché par
          Supabase, jamais en clair).
        </li>
        <li>
          <strong>Profil</strong> : nom d'affichage (dérivé de votre email par
          défaut), préférences UI/IA, locale.
        </li>
        <li>
          <strong>Données métier saisies par vous</strong> : comptes, transactions,
          objectifs, règles récurrentes, catégories personnalisées.
        </li>
        <li>
          <strong>Sécurité locale</strong> : données protégées sur l'appareil (PBKDF2-SHA256
          200 000 itérations + sel aléatoire), <em>jamais transmis au serveur</em>.
        </li>
        <li>
          <strong>Logs d'audit</strong> (connexion, déconnexion, export, suppression,
          événements de sécurité) avec horodatage et hash anonyme du User-Agent
          (8 premiers octets seulement).
        </li>
        <li>
          <strong>Sessions IA</strong> (si activées) : messages stockés
          <em> déjà anonymisés</em> (noms propres et montants exacts remplacés par
          des placeholders avant tout envoi à votre fournisseur IA).
        </li>
      </ul>

      <h3>3. Ce que nous ne collectons PAS</h3>
      <ul>
        <li>Aucun cookie tiers, aucun pixel publicitaire</li>
        <li>Aucun outil d'analytics (Google Analytics, Mixpanel, etc.)</li>
        <li>Aucune empreinte navigateur (fingerprinting)</li>
        <li>Aucune donnée de localisation GPS</li>
        <li>
          Aucune connexion à votre banque (pas d'agrégation Open Banking type
          Bridge / Tink / Powens)
        </li>
        <li>Aucune donnée biométrique</li>
      </ul>

      <h3>4. Bases légales (Art. 6 RGPD)</h3>
      <ul>
        <li>Création de compte + stockage des données métier : <em>exécution du contrat</em></li>
        <li>Protection des données locales : <em>intérêt légitime + sécurité</em></li>
        <li>Assistant IA (optionnel) : <em>consentement explicite</em></li>
        <li>Logs d'audit : <em>intérêt légitime + obligation légale</em></li>
      </ul>

      <h3>5. Sous-traitants</h3>
      <ul>
        <li>
          <strong>Supabase</strong> (hébergement Auth, Postgres, Storage, Edge
          Functions) — données stockées <strong>Frankfurt, Allemagne (UE)</strong>.
        </li>
        <li>
          <strong>Fournisseur IA choisi</strong> (Anthropic / OpenAI / Mistral /
          Google / OpenRouter) — vous choisissez à l'activation. Les messages
          envoyés sont anonymisés.
        </li>
        <li>
          <strong>Aucun transfert hors UE</strong> par défaut. Si vous choisissez
          un fournisseur IA hors UE, le transfert est encadré par les clauses
          contractuelles types de la Commission européenne.
        </li>
      </ul>

      <h3>6. Durée de conservation</h3>
      <ul>
        <li>Compte actif : tant que vous le souhaitez</li>
        <li>Données métier après suppression du compte : purge sous 30 jours</li>
        <li>Logs d'audit : 1 an puis purge automatique</li>
        <li>Sessions IA : 3 mois puis purge automatique</li>
      </ul>

      <h3>7. Vos droits</h3>
      <ul>
        <li>
          <strong>Accès, rectification, portabilité, effacement</strong> :
          directement depuis votre compte (Settings → "Mes données RGPD").
        </li>
        <li>
          <strong>Réclamation</strong> auprès de la CNIL :{' '}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">
            cnil.fr/fr/plaintes
          </a>
        </li>
      </ul>

      <h3>8. Sécurité</h3>
      <p>
        HTTPS / TLS 1.3 en transit, AES-256 au repos (Postgres Supabase), JWT pour
        l'authentification, Row-Level Security sur toutes les tables (chaque user
        n'accède qu'à ses propres rows), Content Security Policy restrictive,
        audit logs immuables (UPDATE et DELETE revoke).
      </p>

      <h3>9. Cookies</h3>
      <p>
        Plan Financier n'utilise pas de cookies au sens de la directive ePrivacy.
        L'application utilise uniquement le <code>localStorage</code> du navigateur
        pour stocker vos données métier (cache offline en attendant la sync
        Supabase) et votre PIN haché.
      </p>

      <h3>10. Mineurs</h3>
      <p>
        Plan Financier n'est pas destiné aux personnes de moins de 15 ans. Si vous
        êtes parent et activez le mode famille, vous êtes responsable des comptes
        attribués à vos enfants.
      </p>

      <h3>11. Contact</h3>
      <p>
        Pour toute question relative à cette politique ou à l'exercice de vos
        droits :<br />
        📧 <a href="mailto:contact@protojo.fr">contact@protojo.fr</a><br />
        📬 Johan Quille — 59 voie des sculpteurs, 92800 Puteaux, France
      </p>
      <p>
        <strong>DPO :</strong> non applicable (structure individuelle &lt; 250
        employés). Les demandes RGPD sont traitées directement par l'éditeur.
      </p>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p className="legal-note">
        Ce document est une <strong>version V1 minimaliste</strong> destinée à
        couvrir les bases. Il devra être enrichi et validé juridiquement avant un
        lancement commercial.
      </p>

      <h3>1. Objet</h3>
      <p>
        Plan Financier (« le Service ») est une application web de suivi
        budgétaire personnel et familial. Les présentes conditions régissent
        l'accès et l'utilisation du Service.
      </p>

      <h3>2. Compte utilisateur</h3>
      <p>
        L'inscription est gratuite. Vous êtes responsable de la confidentialité de
        votre mot de passe et de toutes les actions effectuées depuis votre compte.
        Vous garantissez l'exactitude des informations fournies à l'inscription.
      </p>

      <h3>3. Usage acceptable</h3>
      <ul>
        <li>Le Service est destiné à un usage personnel ou familial.</li>
        <li>
          Vous vous engagez à ne pas utiliser le Service à des fins illicites,
          frauduleuses, ou pour porter atteinte aux droits de tiers.
        </li>
        <li>
          Toute tentative d'accès non autorisé aux données d'autres utilisateurs,
          d'attaque contre l'infrastructure, ou de contournement des mesures de
          sécurité entraîne la suspension immédiate du compte.
        </li>
      </ul>

      <h3>4. Assistant IA (optionnel)</h3>
      <p>
        Si vous activez l'assistant IA, vous êtes responsable :
      </p>
      <ul>
        <li>du choix du fournisseur (Anthropic, OpenAI, Mistral, Google, OpenRouter) ;</li>
        <li>du contrat, de la facturation et des transferts de données qui en découlent ;</li>
        <li>du respect des conditions d'utilisation du fournisseur sélectionné.</li>
      </ul>
      <p>
        Les conseils générés par l'IA sont indicatifs et ne constituent pas un
        conseil financier régulé (AMF). Plan Financier ne saurait être tenu
        responsable des décisions prises sur la base de ces suggestions.
      </p>

      <h3>5. Propriété intellectuelle</h3>
      <p>
        Vous restez propriétaire de vos données métier (transactions, comptes,
        objectifs). L'éditeur reste propriétaire du code source du Service et de
        la marque "Plan Financier".
      </p>

      <h3>6. Limitation de responsabilité</h3>
      <p>
        Le Service est fourni "en l'état". L'éditeur ne garantit pas l'absence
        d'interruption ou d'erreur. Vous restez seul responsable de vos décisions
        financières. L'éditeur ne saurait être tenu responsable de pertes
        financières indirectes liées à l'usage du Service.
      </p>

      <h3>7. Résiliation</h3>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis Settings →
        "Mes données RGPD". Vos données métier sont purgées sous 30 jours.
        L'éditeur se réserve le droit de suspendre tout compte enfreignant les
        présentes conditions.
      </p>

      <h3>8. Modification des CGU</h3>
      <p>
        Toute modification substantielle vous sera notifiée par email et
        nécessitera votre acceptation à votre prochaine connexion.
      </p>

      <h3>9. Droit applicable</h3>
      <p>
        Les présentes conditions sont régies par le droit français. Tout litige
        sera porté devant les tribunaux français compétents.
      </p>

      <h3>10. Mentions légales</h3>
      <p>
        <strong>Éditeur :</strong> Johan Quille (auto-entrepreneur)<br />
        <strong>Adresse :</strong> 59 voie des sculpteurs, 92800 Puteaux, France
        <br />
        <strong>Contact :</strong>{' '}
        <a href="mailto:contact@protojo.fr">contact@protojo.fr</a>
        <br />
        <strong>Hébergement :</strong> OVHcloud SAS, 2 rue Kellermann, 59100
        Roubaix, France
        <br />
        <strong>Auth + données :</strong> Supabase Inc., région Frankfurt
        (Allemagne, UE)
      </p>
    </>
  )
}
