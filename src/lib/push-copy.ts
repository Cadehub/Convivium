/** Bilingual UI copy for push notifications (FR / EN stay in strict key parity — see tests). */
export const PUSH_COPY = {
  fr: {
    notifications: 'Notifications',
    enable: 'Activer les notifications',
    disable: 'Désactiver',
    enabling: 'Activation…',
    active: 'Actives sur cet appareil',
    inactive: 'Désactivées sur cet appareil',
    unsupported: 'Ce navigateur ne prend pas en charge les notifications.',
    unconfigured: 'Les notifications ne sont pas encore configurées sur cette plateforme.',
    denied:
      'Les notifications sont bloquées. Autorisez-les dans les réglages de votre navigateur pour les activer.',
    dismissed: 'Autorisation non accordée. Vous pouvez réessayer à tout moment.',
    error: 'Impossible d’activer les notifications pour le moment. Réessayez plus tard.',
    staffHint:
      'Recevez une alerte sur cet appareil pour les événements qui nécessitent votre attention.',
    clientTitle: 'Être prévenu de l’avancement',
    clientHint:
      'Recevez une alerte quand votre paiement est validé et quand votre commande est prête. Facultatif : le suivi reste disponible sans notification.',
    later: 'Plus tard',
    clientActive: 'Vous serez prévenu des changements de statut de cette commande.',
    clientTurnOn: 'Activer les notifications pour cette commande',
    close: 'Fermer',
    clearHistory: 'Vider l’historique',
    clearHistoryTitle: 'Vider l’historique de suivi ?',
    clearHistoryMessage:
      'Les commandes enregistrées sur cet appareil seront retirées de la liste de suivi et leurs notifications désactivées. Vos commandes ne sont pas annulées et restent connues de l’hôtel.',
    clearHistoryConfirm: 'Vider',
    cancel: 'Annuler',
  },
  en: {
    notifications: 'Notifications',
    enable: 'Enable notifications',
    disable: 'Turn off',
    enabling: 'Enabling…',
    active: 'Active on this device',
    inactive: 'Turned off on this device',
    unsupported: 'This browser does not support notifications.',
    unconfigured: 'Notifications are not configured on this platform yet.',
    denied:
      'Notifications are blocked. Allow them in your browser settings to enable them.',
    dismissed: 'Permission was not granted. You can try again at any time.',
    error: 'Notifications could not be enabled right now. Please try again later.',
    staffHint: 'Get an alert on this device for events that need your attention.',
    clientTitle: 'Get notified of progress',
    clientHint:
      'Get an alert when your payment is validated and when your order is ready. Optional: tracking stays available without notifications.',
    later: 'Not now',
    clientActive: 'You will be notified when this order’s status changes.',
    clientTurnOn: 'Enable notifications for this order',
    close: 'Close',
    clearHistory: 'Clear history',
    clearHistoryTitle: 'Clear tracking history?',
    clearHistoryMessage:
      'Orders saved on this device will be removed from the tracking list and their notifications turned off. Your orders are not cancelled and remain known to the hotel.',
    clearHistoryConfirm: 'Clear',
    cancel: 'Cancel',
  },
} as const;

export type PushCopyKey = keyof typeof PUSH_COPY.fr;
