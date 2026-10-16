# BILAN FACTUEL & ÉTAPES RESTANT À EFFECTUER
### Convivium Home Hotel

Ce document dresse l'état des lieux rigoureux et transparent du projet à date, en séparant ce qui est **réellement terminé et testé** de ce qui relève de **vérifications physiques, de secrets d'exploitation ou de décisions de la Direction**.

---

## 1. Ce qui est Réellement Terminé et Fonctionnel

- [x] **Identité Visuelle Conforme** : Intégration du logo officiel (Noir profond & Or `#D4AF37`, médaillons à méandres grecs, badge 3 étoiles `★★★`, typographie de prestige `Playfair Display`).
- [x] **Absence de Données Fictives** : La base de données de production est saine, sans faux produits, fausses commandes ni fausses statistiques.
- [x] **Absence Totale de Gestion de Stock** : Aucune table, aucun champ ni écran de stock.
- [x] **Absence de Descriptions de Produits** : Nom, catégorie, prix entier en XAF, image facultative et disponibilité seulement.
- [x] **Architecture Rôles & Sécurité PostgreSQL** :
  - Deux rôles stricts : `admin` et `cuisine`.
  - **Seul le rôle Cuisine peut vérifier, confirmer ou rejeter les paiements**.
  - L'Admin ne dispose pas de bouton de confirmation de paiement au quotidien.
  - Politiques RLS actives sur toutes les tables de l'API.
  - Fonctions `SECURITY DEFINER` sécurisées avec `SET search_path = public, pg_temp;`.
- [x] **Moteur de Commande & Idempotence** : Calcul du total strictly côté serveur, protection contre les doubles clics et réémissions réseau, jetons d'accès cryptographiques pour le suivi client.
- [x] **Application Bilingue Complète** : Français natif par défaut et Anglais avec dictionnaire unifié sans texte en dur.
- [x] **Intégration USSD & Téléphonie Sécurisée** : Génération du montant réel et des instructions ; désactivation stricte du composeur automatique tant que `is_tested_on_device` n'est pas validé sur le terrain.
- [x] **Suite de Tests Automatisés** : 28 tests unitaires et d'intégration validés (`7 test files, 28 passed, 0 failed`).
- [x] **Compilation de Production** : `npm run build` exécuté avec succès (code 0).

---

## 2. Étapes Physiques et Opérationnelles Restant à Réaliser

Ces actions nécessitent un accès physique sur le sol camerounais, des cartes SIM réelles ou des accès marchands que seul l'exploitant de l'hôtel peut fournir :

### 1. Renseigner les Vrais Codes Marchands Mobile Money
- Accéder au tableau de bord Direction > onglet **« MoMo & Orange Money »**.
- Renseigner le vrai numéro/code marchand Orange Money de l'hôtel.
- Renseigner le vrai numéro/code marchand MTN MoMo de l'hôtel.

### 2. Validation Physique des Formats USSD sur Téléphones Réels au Cameroun
- Avec une carte SIM MTN Cameroun : tester la composition de la syntaxe directe (`*126*14*CODE*MONTANT#`) et vérifier le prompt réseau.
- Avec une carte SIM Orange Cameroun : tester la composition directe (`#150*47*CODE*MONTANT#`).
- **Une fois la syntaxe validée sans ambiguïté** : activer la case `is_tested_on_device` dans le tableau de bord Direction pour autoriser le bouton de composition automatique sur mobile.

### 3. Obtention et Ajout de la Clé API ImgBB
- Créer un compte gratuit sur [https://api.imgbb.com/](https://api.imgbb.com/).
- Définir `VITE_IMGBB_API_KEY` dans le fichier `.env` ou sur la plateforme d'hébergement.

### 4. Attribution du Mot de Passe de la Direction
- L'utilisateur `biteckdebongethancade@gmail.com` existe dans Supabase Auth avec le rôle `admin`.
- Utiliser la console Supabase pour déclencher la réinitialisation du mot de passe ou définir le mot de passe initial de la Direction.

### 5. Déploiement et Configuration du Nom de Domaine
- Connecter le dépôt Git à Vercel, Netlify ou Cloudflare Pages.
- Configurer les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_IMGBB_API_KEY`).
- Ajouter le domaine de production dans Supabase Auth > URL Configuration.
