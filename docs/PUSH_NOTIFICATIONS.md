# Intégration des Notifications Push Firebase (FCM) — Convivium Home Hotel

Ce document détaille l'architecture mise en place, les migrations de base de données, la configuration des secrets côté Supabase, ainsi que les étapes à finaliser dans la console Firebase.

---

## 1. Architecture & Principes de Sécurité

1. **Supabase reste l'autorité absolue** :
   - Les commandes, paiements, statuts et autorisations sont gérés dans Supabase.
   - Firebase Cloud Messaging (FCM) sert **uniquement** de canal de livraison de messages aux navigateurs.
2. **Aucun secret dans le frontend** :
   - Les variables publiques (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_VAPID_KEY`, etc.) sont conçues pour être publiques côté client.
   - La **clé privée du compte de service Google (Service Account JSON)** est hébergée exclusivement comme secret dans l'environnement de l'Edge Function Supabase (`FIREBASE_SERVICE_ACCOUNT`).
3. **Outbox transactionnelle et idempotente** :
   - Les événements métier (`orders`, `payment_declarations`) alimentent une table `public.notification_outbox` avec une clé unique d'idempotence (`dedupe_key`).
   - L'envoi vers FCM se fait de manière asynchrone sans bloquer l'écriture de commande ni annuler une transaction en cas d'erreur réseau.
   - Les jetons invalides (ex: désinstallation ou expiration) signalés par FCM sont automatiquement nettoyés via `prune_push_subscriptions`.
4. **Cloisonnement strict des rôles & isolation des clients** :
   - Les clients ne s'abonnent qu'à leur propre commande grâce au jeton d'accès sécurisé de la commande (`order_token_hash`).
   - Le personnel Cuisine et Admin doit posséder une session authentifiée et un rôle actif vérifié côté serveur.
   - Les notifications ne divulguent **aucune donnée sensible** : uniquement la référence publique (`CVH-XXXX-XXXX`) et l'événement opérationnel.

---

## 2. Configuration des Variables Côté Client (`.env`)

Dans votre fichier `.env` local et sur votre plateforme d'hébergement frontend (Vercel, Netlify, Cloudflare Pages, etc.) :

```ini
# Informations Web publiques Firebase (Firebase Console > Paramètres du projet > Général > Vos applications > Web)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=convivium-hotel.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=convivium-hotel
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef...

# Clé publique VAPID Web Push (Firebase Console > Paramètres du projet > Cloud Messaging > Certificats Web Push)
VITE_FIREBASE_VAPID_KEY=BN...
```

*Remarque : si ces variables sont absentes, l'application fonctionne parfaitement sans notification et sans aucune erreur bloquante.*

---

## 3. Configuration Côté Supabase (Edge Function & Secrets)

### Étape 3.1 : Déployer l'Edge Function `send-push`
À l'aide du Supabase CLI (ou de votre pipeline CI/CD) :

```bash
supabase functions deploy send-push --no-verify-jwt
```
*(Le paramètre `--no-verify-jwt` est requis car l'appel est authentifié par le secret d'orchestration de base de données `x-dispatch-secret` stocké dans Supabase Vault).*

### Étape 3.2 : Configurer les Secrets de l'Edge Function
Dans votre projet Supabase (**Settings > Edge Functions > Secrets** ou via CLI) :

1. `FIREBASE_SERVICE_ACCOUNT` : Le contenu JSON minifié de votre clé de compte de service Google Firebase (Firebase Console > Paramètres du projet > Comptes de service > *Générer une nouvelle clé privée*).
   Exemple de structure :
   ```json
   {"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@....iam.gserviceaccount.com"}
   ```
2. `SUPABASE_URL` : L'URL de votre projet Supabase (`https://gmtlaptsdffcprtpkdck.supabase.co`).
3. `SUPABASE_SERVICE_ROLE_KEY` : La clé de service Supabase (`service_role`).

---

## 4. Migration Base de Données

Le fichier de migration SQL complet est prêt à être exécuté dans Supabase SQL Editor :
- [`supabase/migrations/20261018_push_notifications.sql`](file:///c:/Users/UltraBook%203.1/Desktop/Convivium/supabase/migrations/20261018_push_notifications.sql)

Il crée :
- `public.push_subscriptions` : Enregistrement sécurisé des jetons FCM (RLS strict, aucun accès direct anon/authenticated).
- `public.notification_outbox` : File d'attente observable et idempotente.
- Les fonctions RPC de souscription : `register_staff_push_subscription`, `unregister_staff_push_token`, `register_client_push_subscription`, `unregister_client_push_subscription`.
- Les déclencheurs d'événements (`trg_orders_notify`, `trg_declarations_notify`).
- La purge planifiée (`pg_cron`) des abonnements inactifs et anciennes notifications.

---

## 5. Fonctionnalités Implémentées

### A. Vider l'historique de suivi de commande client
- Les clients disposent désormais d'un bouton **"Vider l'historique"** au niveau de la section "Mes commandes sur cet appareil".
- Une **modale de confirmation bilingue** s'ouvre pour avertir que les commandes enregistrées sur l'appareil seront retirées du suivi local et que leurs notifications seront révoquées sans annuler les commandes auprès de l'hôtel.
- Fonction [`clearClientOrderHistory()`](file:///c:/Users/UltraBook%203.1/Desktop/Convivium/src/lib/security.ts) intégrée avec désinscription propre des abonnements push associés.

### B. Notifications du Personnel (Admin et Cuisine)
- Bouton cloche discret dans le header Cuisine et dans la barre de navigation Admin (desktop + mobile).
- Panneau d'activation/désactivation avec état de permission et messages d'assistance bilingues.
- Déconnexion propre : la déconnexion d'un membre du personnel révoque immédiatement l'abonnement push de l'appareil (sécurité pour tablettes partagées).

### C. Notifications Clients
- Carte élégante et optionnelle dans la vue de suivi de commande ([`OrderTrackingView.tsx`](file:///c:/Users/UltraBook%203.1/Desktop/Convivium/src/components/tracking/OrderTrackingView.tsx)).
- Aucune demande intempestive au chargement initial : uniquement sur clic volontaire du client.
- Possibilité de reporter avec "Plus tard" ou de désactiver à tout moment.

### D. Service Worker & Runtime en Premier Plan
- [`public/firebase-messaging-sw.js`](file:///c:/Users/UltraBook%203.1/Desktop/Convivium/public/firebase-messaging-sw.js) : dédié exclusivement aux notifications en arrière-plan, sans interférence avec le cache, le réseau ou l'installation de l'application.
- Clic sur notification : ouvre l'onglet ou ramène l'onglet ouvert au premier plan vers le suivi de commande (`?n=track&ref=...`) ou l'espace personnel.
- [`PushRuntime.tsx`](file:///c:/Users/UltraBook%203.1/Desktop/Convivium/src/components/common/PushRuntime.tsx) : notification toast visuelle lorsque l'application est ouverte au premier plan.
