# GESTION ET INVITATION DU PERSONNEL CUISINE

Ce guide explique comment la Direction de Convivium Home Hotel crée, invite et gère les comptes du personnel de **Cuisine**.

---

## 1. Rôle et Responsabilités de la Cuisine

Le personnel Cuisine dispose d'une responsabilité centrale :
- Réception et préparation des commandes clients.
- **Contrôle et vérification exclusive des paiements Mobile Money** : la Cuisine consulte le téléphone ou le relevé marchand officiel de l'hôtel, compare les montants et valide ou rejette les déclarations.
- **Gestion de la carte** : ajout, modification des prix en XAF, photos ImgBB et activation/désactivation immédiate de la disponibilité des plats et boissons.

> **Règle absolue** : La Direction (Admin) ne valide pas les paiements au quotidien. Cette opération de contrôle de caisse est exclusivement dévolue à la Cuisine.

---

## 2. Procédure d'Enregistrement d'un Compte Cuisine

### Étape 1 : Création du compte dans Supabase Auth
Dans **Supabase Dashboard > Authentication > Users > Add User** :
1. Créez l'adresse email professionnelle du cuisinier ou du chef de brigade (ex: `chef.eric@convivium.cm`).
2. Définissez son mot de passe initial sécurisé.
3. Cochez **« Auto Confirm User »**.
4. Copiez son identifiant UUID (ex: `e7f8a9b0-1234-5678-...`).

### Étape 2 : Attribution du Rôle Cuisine dans le Tableau de Bord Admin
1. Connectez-vous en tant qu'Administrateur sur l'application.
2. Rendez-vous dans l'onglet **« Équipe Cuisine »**.
3. Cliquez sur **« Inviter un membre Cuisine »**.
4. Collez l'UUID Supabase Auth et saisissez le nom complet du membre d'équipe (ex: `Chef Eric M.`).
5. Cliquez sur **« Enregistrer »**.

Le profil est immédiatement opérationnel avec le rôle `cuisine`.

---

## 3. Procédure de Révocation ou Désactivation Immédiate

En cas de départ, de fin de contrat ou de suspension temporaire :
1. Dans le tableau de bord Admin > **« Équipe Cuisine »**, repérez le membre concerné.
2. Cliquez sur le bouton **« Désactiver »**.
3. Le champ `is_active` passe à `false`.

### Effet Immédiat :
- Les politiques RLS (`public.current_user_role()`) refusent instantanément l'exécution de toute fonction protégée (`confirm_payment`, `reject_payment`, `update_order_preparation_status`).
- Si l'utilisateur possède une session encore ouverte dans son navigateur, le frontend détecte son statut inactif (`is_active === false`) et le déconnecte automatiquement à la requête suivante.
