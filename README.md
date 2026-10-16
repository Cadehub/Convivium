# CONVIVIUM HOME HOTEL — APPLICATION WEB OFFICIELLE
### Menu Numérique & Prise de Commandes Sécurisée

Application web de menu numérique et de commande en ligne développée spécifiquement pour **Convivium Home Hotel** au Cameroun (Douala / Yaoundé).

---

## 1. Identité Visuelle & Conception

L'interface s'inspire du médaillon officiel de l'établissement :
- **Palette** : Noir profond Onyx (`#0A0A0A`, `#121212`) et Or Impérial (`#D4AF37`, `#EACD6D`).
- **Graphisme** : Bordures et liserés géométriques à méandres grecs, typographie avec empattements de haute distinction (`Playfair Display`) combinée à une typographie sans-serif moderne (`Plus Jakarta Sans`) pour une lisibilité optimale sur écrans mobiles.
- **Règles visuelles** : Aucun emoji dans l'interface (remplacés par la bibliothèque d'icônes vectorielles Lucide), zéro cliché décoratif d'IA, badge 3 étoiles officiel (`★★★`).

---

## 2. Principes Fondamentaux & Règles Métier Strictes

1. **Aucune donnée de démonstration en base de production** : La base de données ne contient aucun faux plat, aucune boisson fictive, aucune fausse commande ni statistique truquée. Les états vides sont conçus avec élégance.
2. **Aucun système de stock** : Conformément au cahier des charges, aucune table, aucun champ ni compteur de stock n'existe dans l'application.
3. **Aucune description de plat ou boisson** : Un produit comporte uniquement son nom, sa catégorie, son prix en XAF (entier sans décimales), une image facultative et un état de disponibilité immédiate.
4. **Exactement deux rôles internes** :
   - **Direction (Admin)** : Supervision globale, paramétrage des moyens de paiement (Orange Money, MTN MoMo), activation des modes de commande, gestion et révocation des comptes Cuisine. **L'Admin ne confirme pas les paiements dans le fonctionnement opérationnel normal.**
   - **Cuisine** : Contrôle opérationnel, consultation des commandes, **vérification et confirmation ou rejet exclusifs des paiements**, gestion de la carte (plats, boissons, prix, disponibilité).
5. **Paiement Mobile Money direct sans API payante** : Le client effectue son transfert USSD directement vers le compte marchand réel de l'hôtel. Le clic sur « J'ai payé » déclare la transaction sans jamais la valider automatiquement. Seul un membre Cuisine confirme la réception après vérification sur le relevé ou terminal officiel.
6. **Sécurité Cryptographique du Suivi Client** : Chaque commande génère un jeton d'accès aléatoire de haute entropie (256 bits). Seul le hachage cryptographique (`crypt` Blowfish) est stocké en base. Le client ne peut consulter que sa propre commande.
7. **Idempotence & Total Serveur** : Les totaux et sous-totaux sont calculés exclusivement par le moteur PostgreSQL à partir des prix officiels. Les soumissions répétées ou coupures réseau utilisent une clé d'idempotence unique.

---

## 3. Architecture Technique

- **Frontend** : React 18, TypeScript 5, Vite 6, Tailwind CSS 3, Lucide React.
- **Base de données & Auth** : Supabase PostgreSQL 17 (projet `gmtlaptsdffcprtpkdck`), Row Level Security (RLS) activé sur toutes les tables, fonctions `SECURITY DEFINER` avec `search_path = public, pg_temp` strict.
- **Hébergement d'images** : ImgBB API (téléversement direct côté client par le personnel authentifié, sans clé secrète dans le bundle).
- **Internationalisation** : Bilingue Français (langue native par défaut) et Anglais avec mémorisation locale (`LanguageContext`).
- **Tests** : Suite de tests automatisés Vitest & Testing Library couvrant l'ensemble des règles métier, calculs, permissions et sécurité.

---

## 4. Démarrage Rapide

### Prérequis
- Node.js >= 18
- npm >= 9

### Installation
```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
```

Renseignez dans votre `.env` :
```env
VITE_SUPABASE_URL=https://gmtlaptsdffcprtpkdck.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
VITE_IMGBB_API_KEY=votre_cle_imgbb_facultative
```

### Lancer en développement
```bash
npm run dev
```
L'application est accessible sur `http://localhost:3000`.

### Exécuter les tests automatisés
```bash
npm test
```
Tous les tests sont exécutés avec des fixtures synthétiques isolées et ne touchent jamais la base de production.

### Compiler pour la production
```bash
npm run build
```

---

## 5. Documentation Détaillée

- [Procédure de création du premier Admin (Bootstrap)](docs/ADMIN_BOOTSTRAP.md)
- [Procédure d'invitation des comptes Cuisine](docs/CUISINE_INVITATIONS.md)
- [Configuration Mobile Money (Orange Money & MTN MoMo) et validation USSD](docs/PAYMENTS_AND_USSD.md)
- [Configuration du service d'images ImgBB](docs/IMGBB_INTEGRATION.md)
- [Guide de Déploiement en Production](docs/DEPLOYMENT_GUIDE.md)
- [Liste des Étapes Restantes à Réaliser](docs/REMAINING_STEPS.md)
