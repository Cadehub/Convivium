# CONFIGURATION DU SERVICE D'IMAGES IMGBB

Ce document décrit l'intégration du service d'hébergement d'images **ImgBB** pour la carte des plats et boissons de **Convivium Home Hotel**.

---

## 1. Rôle de l'Intégration ImgBB

ImgBB permet au personnel autorisé (Direction et Cuisine) d'ajouter ou de remplacer des photos de haute qualité pour les plats et les boissons directement depuis un smartphone, une tablette ou un ordinateur de service.

L'image est transmise directement aux serveurs ImgBB, et l'URL publique générée est automatiquement enregistrée dans le champ `image_url` de la table `public.menu_items` dans Supabase.

---

## 2. Obtention de la Clé API Gratuite

1. Rendez-vous sur le site officiel : **[https://api.imgbb.com/](https://api.imgbb.com/)**.
2. Créez un compte ou connectez-vous.
3. Cliquez sur **« Get API Key »** (Obtenir une clé API).
4. Copiez la clé alphanumérique fournie (ex: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`).

---

## 3. Configuration dans l'Application

Dans votre fichier local `.env` (ou dans les variables d'environnement de votre hébergeur de production) :

```env
VITE_IMGBB_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

> **Note de sécurité** : Cette clé est utilisée côté client dans le navigateur du personnel pour effectuer le téléversement direct en multipart FormData. Elle est visible dans les requêtes réseau du navigateur et ne doit donc pas être considérée comme un secret serveur.

---

## 4. Fonctionnement Sans Clé API (Dégradation Gracieuse)

Si la variable `VITE_IMGBB_API_KEY` n'est pas renseignée ou laissée vide :
- L'application **continue de fonctionner à 100% sans aucun blocage**.
- La création de plats, de boissons et de catégories reste pleinement fonctionnelle.
- Les articles sans photo affichent un visuel raffiné avec le monogramme officiel de l'hôtel (`Convivium Home`) et l'icône de type (assiette gastronomique pour les plats, verre élégant pour les boissons).
- Le formulaire d'ajout d'image affiche un message informatif rappelant de renseigner la clé pour activer le téléversement automatique.
