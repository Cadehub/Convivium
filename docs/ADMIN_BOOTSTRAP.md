# PROCÉDURE DE CRÉATION ET BOOTSTRAP DU PREMIER ADMINISTRATEUR

Ce document détaille la procédure de sécurisation et d'initialisation du premier compte Administrateur (Direction) pour **Convivium Home Hotel**.

---

## 1. Règle de Sécurité Absolue

- **Aucun mot de passe ni identifiant n'est codé en dur** dans le code source, le dépôt Git ou le frontend.
- **L'inscription publique du personnel est désactivée**. Les visiteurs ne disposent d'aucun formulaire d'inscription libre.
- Le premier administrateur est créé via un environnement d'administration sécurisé (Tableau de bord Supabase ou SQL sécurisé).

---

## 2. État Initial du Projet

Dans le projet Supabase ciblé (`gmtlaptsdffcprtpkdck`), le compte administrateur initial est configuré :
- **ID Utilisateur Supabase Auth** : `877ab03f-6d45-432b-919a-6ee25a1d5dc9`
- **Email associé** : `biteckdebongethancade@gmail.com`
- **Profil associé dans `public.profiles`** :
  - `role` : `admin`
  - `full_name` : `Direction Convivium Home Hotel`
  - `is_active` : `true`

---

## 3. Procédure pour Définir ou Réinitialiser le Mot de Passe Admin

Pour permettre à la Direction de se connecter :
1. Accédez à votre tableau de bord officiel Supabase : `https://supabase.com/dashboard/project/gmtlaptsdffcprtpkdck/auth/users`.
2. Repérez l'utilisateur `biteckdebongethancade@gmail.com`.
3. Cliquez sur les actions (`...`) puis sélectionnez **« Send Password Reset »** (ou définissez directement un mot de passe fort via l'interface d'administration).
4. La Direction se rend ensuite sur l'application web de Convivium Home Hotel, clique sur l'icône de cadenas / « Espace Personnel », et saisit son adresse email et son mot de passe.

---

## 4. Procédure pour Créer un Nouvel Administrateur (Cas de Remplacement)

Si un nouvel administrateur doit être désigné :

### Étape A : Créer l'utilisateur dans Supabase Auth
Dans **Supabase Dashboard > Authentication > Users > Add User** :
- Saisir l'adresse email professionnelle du responsable.
- Définir un mot de passe temporaire fort.
- Cocher **« Auto Confirm User »**.
- Noter l'UUID généré (ex: `a1b2c3d4-e5f6-7890-...`).

### Étape B : Attribuer le Rôle Admin dans PostgreSQL
Exécutez dans le SQL Editor de Supabase la requête suivante :
```sql
INSERT INTO public.profiles (id, role, full_name, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-...', -- Remplacez par l'UUID Auth exact
  'admin',
  'Direction Convivium Home Hotel',
  true
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', is_active = true, updated_at = now();
```

Le compte dispose désormais des droits d'accès à la Direction Générale.
