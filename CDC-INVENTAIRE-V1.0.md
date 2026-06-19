# Cahier des charges — Application Inventaire
## CDC-INVENTAIRE-V1.0

---

## Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Périmètre fonctionnel](#2-périmètre-fonctionnel)
3. [Modules détaillés](#3-modules-détaillés)
   - [M1 — Produits](#m1--produits)
   - [M2 — Entrepôts & Emplacements](#m2--entrepôts--emplacements)
   - [M3 — Mouvements de stock](#m3--mouvements-de-stock)
   - [M4 — Réassort](#m4--réassort)
   - [M5 — Codes-barres](#m5--codes-barres)
   - [M6 — Qualité](#m6--qualité)
   - [M7 — Achats](#m7--achats)
   - [M8 — Fabrication](#m8--fabrication)
   - [M9 — Maintenance](#m9--maintenance)
   - [M10 — Traçabilité](#m10--traçabilité)
   - [M11 — Réparations](#m11--réparations)
   - [M12 — Rapports](#m12--rapports)
4. [Exigences non-fonctionnelles](#4-exigences-non-fonctionnelles)
5. [Architecture technique](#5-architecture-technique)
6. [Modèle de données](#6-modèle-de-données)
7. [Sécurité & Conformité](#7-sécurité--conformité)
8. [Interfaces utilisateur](#8-interfaces-utilisateur)
9. [Déploiement](#9-déploiement)
10. [Glossaire](#10-glossaire)

---

## 1. Contexte et objectifs

### 1.1 Contexte

Cette application est une solution complète de **gestion d'inventaire et de chaîne d'approvisionnement** destinée aux entreprises de toute taille souhaitant piloter leurs stocks, leurs achats, leur production et leur qualité depuis une interface web unique.

### 1.2 Objectifs métier

| Objectif | Description |
|----------|-------------|
| Visibilité stock | Connaissance en temps réel des quantités disponibles par produit, emplacement et lot |
| Traçabilité | Suivi complet des mouvements de lot/numéro de série de l'entrée à la sortie |
| Optimisation | Alertes de réassort automatiques, calcul du coût moyen pondéré |
| Qualité | Points de contrôle configurables sur réception, fabrication et expédition |
| Multi-sites | Gestion de plusieurs entrepôts avec arborescence d'emplacements |

### 1.3 Utilisateurs cibles

- **Responsable logistique** : supervision globale, validation des opérations
- **Magasinier / Opérateur** : saisie des réceptions, expéditions, comptages
- **Acheteur** : gestion des commandes fournisseurs et du réassort
- **Responsable production** : ordres de fabrication, nomenclatures
- **Responsable qualité** : points de contrôle, alertes qualité
- **Administrateur système** : configuration, utilisateurs, paramètres

---

## 2. Périmètre fonctionnel

### 2.1 Modules livrés (12/12)

| # | Module | Statut |
|---|--------|--------|
| M1 | Produits (catalogue, lots, numéros de série, valorisation) | ✅ Livré |
| M2 | Entrepôts & Emplacements (arborescents, multi-sites) | ✅ Livré |
| M3 | Mouvements de stock (réception, expédition, transfert, retour) | ✅ Livré |
| M4 | Réassort (règles, PO automatiques groupés par fournisseur) | ✅ Livré |
| M5 | Codes-barres (scan caméra, GS1, mode entrepôt plein écran) | ✅ Livré |
| M6 | Qualité (points de contrôle, pass/fail, mesure, photo, alertes) | ✅ Livré |
| M7 | Achats (workflow PO draft→sent→confirmed→received) | ✅ Livré |
| M8 | Fabrication (BOM, ordres de fabrication, postes de travail) | ✅ Livré |
| M9 | Maintenance (parc équipements, interventions préventives/correctives) | ✅ Livré |
| M10 | Traçabilité (ascendante & descendante par lot/SN) | ✅ Livré |
| M11 | Réparations (workflow new→quoted→in_progress→done) | ✅ Livré |
| M12 | Rapports (état des stocks, vieillissement, performance fournisseurs) | ✅ Livré |

### 2.2 Hors périmètre (V1.0)

- Module ventes (facturation client, SO)
- Comptabilité analytique
- EDI / intégration ERP tiers
- Application mobile native (PWA uniquement)

---

## 3. Modules détaillés

---

### M1 — Produits

#### 3.1.1 Catalogue produits

Chaque produit possède les attributs suivants :

| Attribut | Type | Description |
|----------|------|-------------|
| SKU | Texte unique | Référence interne |
| Code-barres | Texte unique | EAN-13, QR, GS1 |
| Nom | Texte | Libellé commercial |
| Description | Texte long | Description interne, vente, achat |
| Type | Enum | `storable`, `consumable`, `service` |
| Suivi | Enum | `none`, `lot`, `serial` |
| Catégorie | Relation | Arborescence de catégories |
| Unités de mesure | Relation | Stock, Achat, Vente |
| Prix de vente | Décimal | HT |
| Coût | Décimal | Calculé ou saisi |
| Méthode de valorisation | Enum | `standard`, `average`, `fifo` |

#### 3.1.2 Gestion des lots et numéros de série

- Création automatique de lots à la réception
- Date d'expiration, date de retrait configurable par produit (`shelfLifeDays`, `alertDays`, `removalDays`)
- Numéros de série : unicité garantie par produit

#### 3.1.3 Valorisation du stock

- **Coût moyen pondéré (CMP)** : recalculé à chaque entrée en stock
- **FIFO / LIFO / FEFO** : configurables par catégorie
- Historique des coûts conservé

#### 3.1.4 Paramètres de réassort par produit

| Paramètre | Description |
|-----------|-------------|
| Qté min | Seuil déclencheur d'alerte |
| Qté max | Cible de remplissage |
| Qté réappro | Quantité à commander |
| Délai fournisseur | Jours |
| Stock de sécurité | Jours de couverture |

---

### M2 — Entrepôts & Emplacements

#### 3.2.1 Structure multi-sites

```
Société
└── Entrepôt A (Paris)
│   ├── Zone Réception
│   │   ├── Quai 1
│   │   └── Quai 2
│   └── Allée A
│       ├── A1-01
│       └── A1-02
└── Entrepôt B (Lyon)
    └── ...
```

- Arborescence illimitée d'emplacements
- Types d'emplacement : `internal`, `reception`, `quality`, `virtual`, `customer`, `supplier`, `transit`
- Capacité maximale configurable par emplacement

#### 3.2.2 Règles de rangement (Putaway)

- Règles par produit, catégorie ou type d'emballage
- Priorité configurable
- Destination automatique suggérée à la réception

#### 3.2.3 Inventaire cyclique

- Création de feuilles de comptage (`CountSheet`)
- Saisie des quantités comptées par opérateur
- Calcul automatique des écarts (théorique vs compté)
- Validation avec ajustement de stock

---

### M3 — Mouvements de stock

#### 3.3.1 Types de mouvements (Pickings)

| Type | Description | Flux |
|------|-------------|------|
| `receipt` | Réception fournisseur | Supplier → Entrepôt |
| `delivery` | Expédition client | Entrepôt → Customer |
| `internal` | Transfert interne | Empl. A → Empl. B |
| `manufacturing` | Consommation OF | Entrepôt → Production |
| `return` | Retour fournisseur/client | Entrepôt → Supplier |

#### 3.3.2 Workflow d'un bon de mouvement

```
draft → confirmed → assigned → done
                            ↘ cancelled
```

#### 3.3.3 Garanties d'intégrité

- Tous les mouvements de stock sont exécutés dans une **transaction atomique** Prisma
- Impossibilité de passer en négatif (contrôle avant validation)
- Audit-trail complet sur chaque ligne de mouvement

---

### M4 — Réassort

#### 3.4.1 Détection des besoins

- Analyse quotidienne / à la demande du stock disponible vs seuils min
- Produits concernés : type `storable`, avec `minQty > 0`
- Calcul de la quantité à commander = `maxQty - stockActuel`

#### 3.4.2 Génération des commandes

- **Regroupement automatique par fournisseur préféré**
- Création d'un brouillon de commande d'achat (PO) par fournisseur
- Délai de livraison pris en compte pour la date attendue

---

### M5 — Codes-barres

#### 3.5.1 Formats supportés

| Format | Standard | Utilisation |
|--------|----------|-------------|
| EAN-13 | GS1 | Identification produit |
| QR Code | ISO 18004 | Liens, lots, emplacements |
| GS1-128 | GS1 | AI 01 (GTIN), 10 (Lot), 17 (DLUO), 21 (SN), 30 (Qté) |
| Code 128 | ISO 15417 | Références internes |

#### 3.5.2 Modes de scan

- **Scan caméra** : via `BarcodeDetector` API (navigateur)
- **Mode entrepôt plein écran** : interface dédiée, optimisée pour tablette/mobile
- **Saisie manuelle** : fallback si caméra indisponible

#### 3.5.3 Actions déclenchées par scan

- Identification produit → affichage fiche
- Identification lot → traçabilité
- Identification emplacement → stock par emplacement

---

### M6 — Qualité

#### 3.6.1 Points de contrôle qualité (QCP)

Chaque QCP définit :

| Attribut | Valeurs possibles |
|----------|------------------|
| Déclencheur | `reception`, `manufacturing`, `delivery` |
| Type | `instructions`, `pass_fail`, `measure`, `photo` |
| Fréquence | `all`, `periodic`, `random` |
| Produit concerné | Optionnel (sinon s'applique à tous) |

#### 3.6.2 Résultats de contrôle

- `pass` / `fail` / `pending`
- Mesure numérique avec bornes min/max
- Commentaire libre

#### 3.6.3 Alertes qualité

- Création manuelle ou automatique sur échec de contrôle
- Sévérité : `low`, `medium`, `high`, `critical`
- Workflow : `new → in_progress → action → resolved`

---

### M7 — Achats

#### 3.7.1 Workflow commande fournisseur

```
draft → sent → confirmed → received → invoiced
                         ↘ cancelled
```

#### 3.7.2 Fonctionnalités

- Création manuelle ou depuis le module Réassort
- Lignes de commande avec prix unitaire, quantité, total HT
- Réception partielle (quantité reçue trackée par ligne)
- Génération automatique du bon de réception (Picking) à la validation

---

### M8 — Fabrication

#### 3.8.1 Nomenclatures (BOM)

- BOM par produit fini, avec version et quantité produite
- Composants avec quantité et unité
- Opérations avec durée et poste de travail

#### 3.8.2 Ordres de fabrication (MO)

Workflow :
```
draft → confirmed → in_progress → done
                               ↘ cancelled
```

- Consommation automatique des composants au lancement
- Suivi par poste de travail (WorkOrder)
- Mise en stock du produit fini à la clôture

#### 3.8.3 Postes de travail

- Coût horaire configurable
- Capacité (nb opérations simultanées)

---

### M9 — Maintenance

#### 3.9.1 Parc d'équipements

| Attribut | Description |
|----------|-------------|
| Référence | Identifiant unique |
| Catégorie | Libre |
| Localisation | Texte libre |
| Numéro de série | Optionnel |
| Fin de garantie | Date |

#### 3.9.2 Demandes de maintenance

- Types : `corrective` (panne), `preventive` (planifiée)
- Workflow : `new → scheduled → in_progress → done`
- Planification avec date prévue

---

### M10 — Traçabilité

#### 3.10.1 Traçabilité descendante

À partir d'un lot ou SN : retrouver **où il est allé** (réceptions → transferts → expéditions → ordres de fabrication)

#### 3.10.2 Traçabilité ascendante

À partir d'un produit fini ou d'un lot livré : retrouver **d'où viennent les composants** (fournisseur, lots de matières premières)

#### 3.10.3 Interface

- Saisie d'un numéro de lot ou SN
- Arbre interactif des mouvements liés
- Export possible

---

### M11 — Réparations

#### 3.11.1 Workflow

```
new → quoted → in_progress → done
            ↘ cancelled
```

#### 3.11.2 Attributs

| Attribut | Description |
|----------|-------------|
| Produit | Nom libre (équipement client) |
| Client | Nom du déposant |
| Diagnostic | Description de la panne |
| Devis HT | Montant estimé |
| Notes | Travaux réalisés |

---

### M12 — Rapports

#### 3.12.1 Rapports disponibles

| Rapport | Description |
|---------|-------------|
| État des stocks | Stock par produit, emplacement, lot avec valorisation |
| Vieillissement | Produits avec stock immobile > N jours |
| Performance fournisseurs | Délais de livraison, taux de conformité |
| Mouvements | Historique des entrées/sorties par période |

---

## 4. Exigences non-fonctionnelles

### 4.1 Sécurité

| Exigence | Implémentation |
|----------|----------------|
| Authentification | JWT + HttpOnly cookies (jose + bcrypt) |
| Autorisation | RBAC 4 niveaux : `admin`, `manager`, `operator`, `user` |
| Headers HTTP | OWASP (CSP, HSTS, X-Frame-Options, etc.) |
| Sessions | Expiration configurable, invalidation à la déconnexion |
| Brute-force | Compteur `failedAttempts` par utilisateur |
| Cookie sécurisé | `Secure` en production, `SameSite=Strict` |

### 4.2 Multi-tenant

- **Isolation stricte** par `companyId` sur toutes les tables métier
- Impossible d'accéder aux données d'une autre société sans compromission du JWT

### 4.3 Intégrité des données

- **Soft-delete** : les enregistrements supprimés conservent `deletedAt`, jamais effacés physiquement
- **Audit-trail** : table `AuditLog` — qui, quoi (action), sur quoi (entity + entityId), ancienne valeur, nouvelle valeur, IP
- **Transactions atomiques** : tous les mouvements de stock via `prisma.$transaction`

### 4.4 Performance

| Cible | Valeur |
|-------|--------|
| Temps de réponse page | < 500 ms (P95) |
| Temps de réponse API | < 200 ms (P95) |
| Concurrence | 50 utilisateurs simultanés minimum |
| Taille de catalogue | Testé jusqu'à 10 000 produits |

### 4.5 Disponibilité

- Mode offline partiel via PWA (Service Worker)
- Données mises en cache pour les pages consultées récemment

---

## 5. Architecture technique

### 5.1 Stack

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | Next.js App Router + React | 15 / 18 |
| Langage | TypeScript | 5.x |
| UI | Tailwind CSS + Lucide Icons | 3.x |
| Charts | Recharts | 2.x |
| ORM | Prisma | 5.x |
| BDD dev | SQLite | — |
| BDD prod | PostgreSQL | 16+ |
| Auth | jose (JWT) + bcrypt | — |
| PWA | Web App Manifest + Service Worker | — |

### 5.2 Structure des routes

```
app/
├── (app)/              # Routes authentifiées (layout avec sidebar)
│   ├── dashboard/
│   ├── produits/
│   ├── entrepots/
│   ├── emplacements/
│   ├── operations/
│   ├── inventaire/
│   ├── reassort/
│   ├── codes-barres/
│   ├── qualite/
│   ├── achats/
│   ├── fabrication/
│   ├── maintenance/
│   ├── reparations/
│   ├── rapports/
│   ├── tracabilite/
│   ├── partenaires/
│   └── parametres/
├── login/              # Page publique
└── api/
    └── auth/           # Endpoints d'authentification
```

### 5.3 Middleware de protection

Le fichier `middleware.ts` protège toutes les routes authentifiées via vérification du JWT à chaque requête.

---

## 6. Modèle de données

### 6.1 Entités principales

```
Company (1) ──── (N) User
Company (1) ──── (N) Product ──── (N) Lot
Company (1) ──── (N) Warehouse ──── (N) Location
Company (1) ──── (N) Partner
Company (1) ──── (N) Picking ──── (N) PickingLine
Company (1) ──── (N) PurchaseOrder ──── (N) PurchaseOrderLine
Company (1) ──── (N) ManufacturingOrder ──── (N) WorkOrder
Company (1) ──── (N) Equipment ──── (N) MaintenanceRequest
Company (1) ──── (N) RepairOrder
Company (1) ──── (N) QualityAlert
Product (1) ──── (N) StockLine (par Location + Lot)
Product (1) ──── (N) Bom ──── (N) BomComponent
```

### 6.2 Patterns transversaux

| Pattern | Description |
|---------|-------------|
| `companyId` | Sur toutes les tables métier — isolation multi-tenant |
| `deletedAt` | Soft-delete universel |
| `createdAt / updatedAt` | Horodatage automatique Prisma |
| `reference` | Numéro séquentiel auto (table `Sequence`) |
| `AuditLog` | Log de toutes les actions CRUD sensibles |

---

## 7. Sécurité & Conformité

### 7.1 Headers HTTP (OWASP)

| Header | Valeur |
|--------|--------|
| `Content-Security-Policy` | Définie, restrictive |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera autorisée (scan codes-barres), autres restrictifs |

### 7.2 Gestion des mots de passe

- Hachage bcrypt (coût 12)
- Aucun mot de passe en clair en base ou logs

### 7.3 RBAC — Matrice des droits

| Action | admin | manager | operator | user |
|--------|-------|---------|----------|------|
| Lire toutes les données | ✅ | ✅ | ✅ | ✅ |
| Créer / modifier produits | ✅ | ✅ | ❌ | ❌ |
| Valider mouvements de stock | ✅ | ✅ | ✅ | ❌ |
| Créer commandes d'achat | ✅ | ✅ | ❌ | ❌ |
| Gérer utilisateurs | ✅ | ❌ | ❌ | ❌ |
| Paramètres société | ✅ | ❌ | ❌ | ❌ |

---

## 8. Interfaces utilisateur

### 8.1 Principes généraux

- **Responsive** : desktop, tablette, mobile
- **Mode sombre** : toggle dans les paramètres, mémorisé
- **Accessibilité** : contrastes WCAG AA, navigation clavier, aria-labels
- **Internationalisation** : Français par défaut (i18n prévu)
- **PWA** : installable sur mobile/desktop, icônes, splash screen

### 8.2 Navigation principale (Sidebar)

```
Dashboard
├── Produits
├── Entrepôts
├── Emplacements
├── Opérations
├── Inventaire
├── Codes-barres
├── Réassort
├── Partenaires
├── Achats
├── Fabrication
├── Qualité
├── Maintenance
├── Réparations
├── Traçabilité
├── Rapports
└── Paramètres
```

### 8.3 Composants partagés

- `Sidebar` + `Header` avec indicateur de connexion serveur (ping)
- `LiveSearch` : recherche globale produits / partenaires / références
- `BarcodeScanner` : modal de scan caméra
- `BadgeStatut` : codes couleur par état de workflow
- `Charts` : composants Recharts wrappés (bar, line, area, pie)

---

## 9. Déploiement

### 9.1 Environnement de développement

```bash
npm run setup   # install + prisma generate + db push + seed
npm run dev     # Next.js dev server sur port 4040
```

**Compte admin initial** : `admin@inventaire.fr` / `admin123`

### 9.2 Build de production

```bash
npm run build
npm run start
```

### 9.3 Migration vers PostgreSQL

1. Modifier `prisma/schema.prisma` :
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Mettre `.env` : `DATABASE_URL=postgresql://...`
3. `npx prisma migrate deploy`

### 9.4 Variables d'environnement

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `DATABASE_URL` | URL de la base de données | ✅ |
| `JWT_SECRET` | Secret de signature des tokens JWT | ✅ |
| `NODE_ENV` | `development` ou `production` | ✅ |

### 9.5 Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run setup` | Installation complète + DB + seed |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run db:reset` | Réinitialisation complète de la base |
| `npm run db:seed` | Re-seed sans reset |

---

## 10. Glossaire

| Terme | Définition |
|-------|-----------|
| **BOM** (Bill of Materials) | Nomenclature : liste des composants pour fabriquer un produit |
| **CMP** | Coût Moyen Pondéré — méthode de valorisation du stock |
| **FEFO** | First Expired, First Out — les lots les plus proches de la péremption sortent en premier |
| **FIFO** | First In, First Out — premier entré, premier sorti |
| **LIFO** | Last In, First Out — dernier entré, premier sorti |
| **GS1** | Standard international d'identification par codes-barres (AI = Application Identifier) |
| **Lot** | Groupe d'articles fabriqués ou reçus ensemble, traçables collectivement |
| **MO** (Manufacturing Order) | Ordre de fabrication |
| **Picking** | Bon de mouvement de stock (réception, expédition, transfert) |
| **PO** (Purchase Order) | Commande d'achat |
| **PWA** | Progressive Web App — application web installable sur mobile/desktop |
| **RBAC** | Role-Based Access Control — droits d'accès basés sur le rôle utilisateur |
| **SKU** | Stock Keeping Unit — référence produit unique |
| **SN** | Numéro de Série — identifiant unique d'un exemplaire individuel |
| **Soft-delete** | Suppression logique (champ `deletedAt`) sans effacement physique |
| **WH** | Abréviation de Warehouse (Entrepôt) dans les références de mouvements |

---

*Document généré le 18 juin 2026 — Version 1.0*
*Application Inventaire — CDC-INVENTAIRE-V1.0*
