# Inventaire — Application web de gestion d'inventaire professionnelle

Solution complète de gestion d'inventaire et de chaîne d'approvisionnement,
développée d'après le cahier des charges **CDC-INVENTAIRE-V1.0** (12 modules).

## Stack technique

- **Frontend / Backend** : [Next.js 15](https://nextjs.org) (App Router) + React 18 + TypeScript
- **UI** : Tailwind CSS + Lucide
- **Base de données** : [Prisma](https://prisma.io) ORM + SQLite (PostgreSQL en production)
- **Auth** : JWT (jose) + bcrypt + cookies HttpOnly
- **Charts** : Recharts
- **Codes-barres** : BarcodeDetector API + parser GS1 (AI 01, 10, 17, 21, 30)
- **PWA** : manifest + service worker

## Démarrage rapide

```bash
# Installation des dépendances + initialisation DB + seed
npm run setup

# Démarrer le serveur de développement
npm run dev
```

Application disponible sur **http://localhost:4040**

### Compte administrateur initial

| Rôle  | E-mail              | Mot de passe |
|-------|---------------------|--------------|
| Admin | admin@inventaire.fr | admin123     |

> ⚠️ **Base vierge** : aucune donnée métier n'est pré-chargée. Le seed crée uniquement
> la société, le compte admin, les unités de mesure de référence et les compteurs
> de séquences. Commencez par créer un entrepôt, puis vos premiers produits.

## Modules livrés (12/12)

| Module | Pages | Statut |
|--------|-------|--------|
| **M1 — Produits** | `/produits` (liste, fiche détail, création) avec lots, numéros de série, valorisation | ✅ |
| **M2 — Entrepôts** | `/entrepots`, `/emplacements` (arborescents), `/inventaire` (comptages cycliques) | ✅ |
| **M3 — Mouvements** | `/operations` (réception, expédition, transferts internes, retours) | ✅ |
| **M4 — Réassort** | `/reassort` avec génération automatique de PO regroupés par fournisseur | ✅ |
| **M5 — Codes-barres** | `/codes-barres` mode entrepôt plein écran, scan caméra + GS1 | ✅ |
| **M6 — Qualité** | `/qualite` points de contrôle (instructions, pass/fail, mesure, photo) + alertes | ✅ |
| **M7 — Achats** | `/achats` workflow draft → sent → confirmed → received + génération réception | ✅ |
| **M8 — Fabrication** | `/fabrication` BOM, ordres de fabrication, postes de travail, consommation auto | ✅ |
| **M9 — Maintenance** | `/maintenance` parc d'équipements + interventions préventives/correctives | ✅ |
| **M11 — Réparations** | `/reparations` workflow new → quoted → in_progress → done | ✅ |
| **M12 — Rapports** | `/rapports` état des stocks, vieillissement, perf fournisseurs | ✅ |
| **Traçabilité** | `/tracabilite` ascendante & descendante par lot/SN | ✅ |

## Exigences non-fonctionnelles

- ✅ Multi-tenant (cloisonnement `companyId` sur toutes les tables métier)
- ✅ Soft-delete (`deletedAt`)
- ✅ Audit-trail complet (`AuditLog` : qui, quoi, quand)
- ✅ RBAC (admin / manager / operator / user)
- ✅ Mouvements de stock atomiques (`prisma.$transaction`)
- ✅ Coût moyen pondéré recalculé à chaque entrée
- ✅ FIFO/LIFO/FEFO configurables par catégorie
- ✅ PWA installable (manifest + SW)
- ✅ Mode sombre, accessibilité, responsive
- ✅ Internationalisation (FR par défaut)

## Structure du projet

```
inventaire/
├── app/
│   ├── (app)/                # Routes authentifiées (sidebar + header)
│   │   ├── dashboard/
│   │   ├── produits/
│   │   ├── entrepots/
│   │   ├── emplacements/
│   │   ├── operations/
│   │   ├── inventaire/
│   │   ├── reassort/
│   │   ├── codes-barres/
│   │   ├── qualite/
│   │   ├── achats/
│   │   ├── fabrication/
│   │   ├── maintenance/
│   │   ├── reparations/
│   │   ├── rapports/
│   │   ├── tracabilite/
│   │   ├── partenaires/
│   │   └── parametres/
│   ├── login/                # Page de connexion publique
│   ├── api/auth/             # Endpoints d'auth
│   ├── manifest.webmanifest/ # PWA manifest
│   ├── layout.tsx            # Layout racine
│   └── globals.css           # Tailwind + thèmes
├── components/               # Sidebar, Header, Cards, Badges, Charts, Scanner...
├── lib/                      # db, auth, format, sequence, stock
├── prisma/
│   ├── schema.prisma         # Schéma couvrant les 12 modules
│   ├── seed.ts               # Données de démo (FR)
│   └── dev.db                # Base SQLite (créée au setup)
├── public/                   # Icônes PWA, favicon, service worker
└── middleware.ts             # Protection des routes par JWT
```

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run setup` | Installation + initialisation DB + seed |
| `npm run dev` | Serveur de développement (port 4040) |
| `npm run build` | Build de production |
| `npm run start` | Démarre le serveur de production |
| `npm run db:reset` | Réinitialise la base + relance le seed |
| `npm run db:seed` | Relance uniquement le seed |

## Mise en production

Le code est prêt pour un déploiement conteneurisé. Pour passer en PostgreSQL :

1. Modifier `prisma/schema.prisma` :
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Mettre à jour `.env` avec l'URL PostgreSQL.
3. `npx prisma migrate deploy` pour appliquer les migrations.

---

© 2026 Inventaire — Réalisé d'après CDC-INVENTAIRE-V1.0
