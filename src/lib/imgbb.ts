/**
 * ImgBB Image Upload Service
 * Allows staff to upload dish/drink pictures directly to ImgBB and obtain a public URL.
 * Fails gracefully if the VITE_IMGBB_API_KEY is not configured.
 */

export interface ImgBBUploadResult {
  success: boolean;
  url?: string;
  displayUrl?: string;
  error?: string;
}

export async function uploadImageToImgBB(file: File): Promise<ImgBBUploadResult> {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your-imgbb-api-key')) {
    return {
      success: false,
      error:
        'Clé API ImgBB non configurée. Veuillez renseigner VITE_IMGBB_API_KEY dans votre fichier .env pour activer le téléversement d’images.',
    };
  }

  // Basic client validation
  if (!file.type.startsWith('image/')) {
    return {
      success: false,
      error: 'Le fichier sélectionné doit être une image (JPG, PNG, WebP).',
    };
  }

  // Max 10MB per ImgBB free tier
  if (file.size > 10 * 1024 * 1024) {
    return {
      success: false,
      error: 'La taille de l’image ne doit pas dépasser 10 Mo.',
    };
  }

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const msg = data?.error?.message || 'Erreur lors de l’envoi de l’image vers ImgBB.';
      return {
        success: false,
        error: msg,
      };
    }

    return {
      success: true,
      url: data.data.url,
      displayUrl: data.data.display_url,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur réseau inconnue.';
    return {
      success: false,
      error: `Échec de connexion au service d’images : ${errorMessage}`,
    };
  }
}
