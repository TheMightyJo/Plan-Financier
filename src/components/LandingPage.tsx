import { useState } from 'react'
import { PrivacyPolicyModal } from './PrivacyPolicyModal'
import { CalendarIllustration, EnvelopesIllustration, WeeklyChartIllustration } from './LandingIllustrations'

type Props = {
  /** Ouvre l'écran de connexion / inscription. */
  onLogin: () => void
  /** Lance le mode démo sans compte. */
  onTryDemo: () => void
}

const FEATURES = [
  {
    icon: '📅',
    title: 'Le calendrier de vos dépenses',
    text: "Chaque jour montre ce qui est parti et ce qui arrive. Les échéances récurrentes s'affichent avant qu'elles ne tombent — fini les surprises.",
  },
  {
    icon: '✉️',
    title: 'Des poches, comme des enveloppes',
    text: 'Courses, Maison, Vacances… mettez de l’argent dans chaque poche et suivez sa météo : ☀️ tout va bien, ⛈️ ça déborde.',
  },
  {
    icon: '🤖',
    title: 'Cash, votre assistant IA',
    text: 'Il analyse votre mois, repère où économiser, lit vos tickets de caisse en photo et répond à vos questions en français.',
  },
  {
    icon: '📊',
    title: 'La météo de vos semaines',
    text: 'Chaque semaine est notée — Danger, Normal, Up ou Record — avec le conseil pour agir avant la fin du mois.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Le budget en famille',
    text: 'Invitez votre conjoint·e par email : deux comptes, une vue fusionnée des budgets et des dépenses du foyer.',
  },
  {
    icon: '📧',
    title: 'Vos rapports automatiques',
    text: 'Un bilan clair chaque semaine ou chaque mois dans votre boîte mail, avec PDF, CSV ou Excel en pièce jointe.',
  },
]

const PLANS = [
  {
    name: 'Découverte',
    price: '0 €',
    period: 'pour toujours',
    highlight: false,
    features: [
      '1 profil',
      'Dépenses, revenus et calendrier',
      '3 poches budgétaires',
      'Statistiques hebdomadaires',
      'Vos données vous appartiennent',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    name: 'Premium',
    price: '3,99 €',
    period: 'par mois · ou 29,99 €/an (−37 %)',
    highlight: true,
    features: [
      'Profils illimités',
      'Cash, l’assistant IA complet',
      'Poches illimitées + objectifs',
      'Rapports email automatiques (PDF, CSV, Excel)',
      'Exports et sauvegardes avancés',
      'Synchronisation multi-appareils',
    ],
    cta: 'Essayer Premium',
  },
  {
    name: 'Famille',
    price: '5,99 €',
    period: 'par mois · ou 44,99 €/an',
    highlight: false,
    features: [
      'Tout Premium',
      'Jusqu’5 membres du foyer',
      'Vue famille fusionnée',
      'Invitations par email',
      'Un seul paiement pour tous',
    ],
    cta: 'Choisir Famille',
  },
]

const SHOWCASE = [
  {
    title: 'Chaque jour, vous savez où vous en êtes',
    text: 'Le calendrier affiche vos dépenses et revenus jour par jour, et vos échéances récurrentes avant qu’elles ne tombent. Le mois entier tient dans un seul écran.',
    art: <CalendarIllustration />,
  },
  {
    title: 'Des poches qui ont leur météo',
    text: 'Mettez de l’argent dans chaque poche — Courses, Maison, Vacances — et voyez d’un coup d’œil si le ciel est dégagé ☀️ ou si l’orage gronde ⛈️.',
    art: <EnvelopesIllustration />,
  },
  {
    title: 'Vos semaines, notées comme un bulletin',
    text: 'Dépenses contre revenus, du lundi au dimanche. Danger, Normal, Up ou Record : le verdict arrive assez tôt pour corriger le tir avant la fin du mois.',
    art: <WeeklyChartIllustration />,
  },
]

const FAQ = [
  {
    q: 'Mes données bancaires sont-elles connectées ?',
    a: 'Non — et c’est voulu. Vous saisissez (ou photographiez) vos dépenses : aucune connexion à votre banque, aucun identifiant bancaire demandé, jamais.',
  },
  {
    q: 'Où sont stockées mes données ?',
    a: 'Sur votre appareil, et dans votre espace personnel sécurisé en Europe pour la synchronisation. Vous pouvez tout exporter ou tout supprimer à tout moment (RGPD).',
  },
  {
    q: 'L’assistant IA lit-il mes données ?',
    a: 'Cash n’analyse que les chiffres nécessaires à votre demande. L’IA est incluse avec votre compte (quota mensuel selon la formule) et rien n’est utilisé pour entraîner des modèles.',
  },
  {
    q: 'Puis-je essayer sans créer de compte ?',
    a: 'Oui ! Le mode démo ouvre l’application complète avec des données fictives. Rien n’est enregistré.',
  },
]

export function LandingPage({ onLogin, onTryDemo }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null)

  return (
    <div className="landing">
      {/* ── Barre de navigation ── */}
      <header className="landing-nav">
        <span className="landing-brand">💰 Plan Financier</span>
        <nav className="landing-nav-links" aria-label="Navigation du site">
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#apercu">Aperçu</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#faq">Questions</a>
        </nav>
        <div className="landing-nav-actions">
          <button type="button" className="landing-login-btn" onClick={onLogin}>
            Se connecter
          </button>
          <button type="button" className="hero-cta-button landing-signup-btn" onClick={onLogin}>
            Créer mon compte
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <h1>
          Votre argent, enfin <em>clair</em>.
        </h1>
        <p className="landing-hero-sub">
          Le cockpit budgétaire des familles : calendrier des dépenses, poches d'argent,
          assistant IA et météo de vos semaines — sans jamais connecter votre banque.
        </p>
        <div className="landing-hero-ctas">
          <button type="button" className="hero-cta-button landing-cta-main" onClick={onLogin}>
            Créer mon compte gratuit
          </button>
          <button type="button" className="ghost-button landing-cta-demo" onClick={onTryDemo}>
            🎬 Essayer la démo sans compte
          </button>
        </div>
        <p className="landing-hero-note">Gratuit pour commencer · Aucune carte bancaire demandée</p>

        {/* Aperçu stylisé (pur CSS, pas de capture) */}
        <div className="landing-preview" aria-hidden="true">
          <div className="landing-preview-card">
            <span className="landing-preview-label">Reste à dépenser</span>
            <strong>1 245 €</strong>
            <div className="landing-preview-bar"><span style={{ width: '58%' }} /></div>
          </div>
          <div className="landing-preview-card">
            <span className="landing-preview-label">Semaine en cours</span>
            <strong>📈 Up · +180 €</strong>
            <small>Solde en hausse — continuez !</small>
          </div>
          <div className="landing-preview-card">
            <span className="landing-preview-label">Poche Vacances</span>
            <strong>☀️ 320 € dispo</strong>
            <div className="landing-preview-bar"><span style={{ width: '34%' }} /></div>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="landing-section" id="fonctionnalites">
        <h2>Tout ce qu'il faut pour tenir votre budget</h2>
        <div className="landing-features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing-feature">
              <span className="landing-feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Aperçu illustré (SVG maison, libres de droit) ── */}
      <section className="landing-section" id="apercu">
        <h2>À quoi ça ressemble</h2>
        <p className="landing-section-sub">
          Trois écrans du quotidien — dessinés pour Plan Financier, comme tout le reste.
        </p>
        <div className="landing-showcase">
          {SHOWCASE.map((item) => (
            <article key={item.title} className="landing-showcase-item">
              <div className="landing-showcase-art">{item.art}</div>
              <div className="landing-showcase-text">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section className="landing-section landing-section--alt" id="tarifs">
        <h2>Un prix simple, sans surprise</h2>
        <p className="landing-section-sub">
          Commencez gratuitement. Passez à Premium quand vous voulez — résiliable en un clic.
        </p>
        <div className="landing-plans">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`landing-plan${plan.highlight ? ' landing-plan--highlight' : ''}`}>
              {plan.highlight ? <span className="landing-plan-badge">Le plus choisi</span> : null}
              <h3>{plan.name}</h3>
              <p className="landing-plan-price">
                <strong>{plan.price}</strong>
                <small>{plan.period}</small>
              </p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <button
                type="button"
                className={plan.highlight ? 'hero-cta-button' : 'ghost-button'}
                onClick={onLogin}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </div>
        <p className="landing-plans-note">
          Les abonnements arrivent bientôt — aujourd'hui, toutes les fonctionnalités sont
          offertes aux premiers inscrits. Profitez-en !
        </p>
      </section>

      {/* ── FAQ ── */}
      <section className="landing-section" id="faq">
        <h2>Vos questions, nos réponses</h2>
        <div className="landing-faq">
          {FAQ.map((item, index) => (
            <div key={item.q} className="landing-faq-item">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                aria-expanded={openFaq === index}
              >
                {item.q}
                <span aria-hidden="true">{openFaq === index ? '−' : '+'}</span>
              </button>
              {openFaq === index ? <p>{item.a}</p> : null}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="landing-final-cta">
        <h2>Prêt·e à voir clair dans votre argent ?</h2>
        <button type="button" className="hero-cta-button landing-cta-main" onClick={onLogin}>
          Créer mon compte gratuit
        </button>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span>💰 Plan Financier</span>
          <span>Fait en France 🇫🇷 par <strong>ProtoJo Digital</strong></span>
        </div>
        <nav className="landing-footer-links" aria-label="Liens légaux">
          <button type="button" onClick={() => setLegalDoc('terms')}>Conditions d'utilisation</button>
          <button type="button" onClick={() => setLegalDoc('privacy')}>
            Mentions légales · Confidentialité · Cookies
          </button>
        </nav>
      </footer>

      {legalDoc ? <PrivacyPolicyModal doc={legalDoc} onClose={() => setLegalDoc(null)} /> : null}
    </div>
  )
}
