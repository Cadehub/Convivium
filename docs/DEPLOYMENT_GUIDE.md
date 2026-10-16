# GUIDE DE DÉPLOIEMENT EN PRODUCTION
### Convivium Home Hotel

Ce guide détaille les étapes techniques pour déployer l'application web de **Convivium Home Hotel** sur un environnement de production fiable et haute performance.

---

## 1. Choix d'Hébergement Recommandés

L'application est une Single Page Application (SPA) optimisée avec Vite, React et TypeScript. Elle peut être déployée gratuitement ou à coût minimal sur :
- **Vercel** (Hautement recommandé pour la rapidité et la gestion native des SPA)
- **Netlify**
- **Cloudflare Pages** (Excellent CDN pour l'Afrique de l'Ouest et Centrale)

---

## 2. Variables d'Environnement en Production

Dans la console de votre hébergeur (ex: Vercel > Settings > Environment Variables), configurez :

| Variable | Description | Exemple de Valeur |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL de votre instance Supabase | `https://gmtlaptsdffcprtpkdck.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anonyme Supabase | `eyJhbGciOiJIUzI1NiIsIn...` |
| `VITE_IMGBB_API_KEY` | Clé API ImgBB pour les photos de menu | `votre_cle_api_imgbb` |

> **Règle absolue** : Ne placez JAMAIS la clé secrète `service_role` de Supabase dans les variables `VITE_*` ni dans le frontend.

---

## 3. Configuration des Redirections SPA (Routing)

Pour éviter les erreurs 404 lors du rafraîchissement d'une page sur un hébergeur statique :

### Sur Vercel : `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Sur Netlify : `public/_redirects`
```text
/*    /index.html   200
```

---

## 4. Configuration de Supabase Auth pour le Domaine de Production

1. Accédez à votre console Supabase : **[https://supabase.com/dashboard/project/gmtlaptsdffcprtpkdck/auth/url-configuration](https://supabase.com/dashboard/project/gmtlaptsdffcprtpkdck/auth/url-configuration)**.
2. Définissez l'**URL du site (Site URL)** avec le domaine officiel de l'hôtel (ex: `https://menu.convivium.cm` ou `https://convivium-home-hotel.vercel.app`).
3. Dans **Redirect URLs**, ajoutez :
   - `https://menu.convivium.cm/**`
   - `http://localhost:3000/**` (pour conserver le développement local opérationnel).

---

## 5. Vérification du Build et de la Sécurité

Avant toute mise en ligne :
```bash
# Vérifier la compilation TypeScript et générer les assets minifiés
npm run build

# Exécuter l'intégralité des tests de conformité
npm test
```

Tous les tests doivent obligatoirement être au vert avant la mise en production.
