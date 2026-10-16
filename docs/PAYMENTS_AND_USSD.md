# GUIDE DES PAIEMENTS MOBILE MONEY & PROTOCOLE USSD
### Orange Money & MTN MoMo au Cameroun

Ce document détaille le fonctionnement, la configuration et les protocoles de sécurité pour les paiements Mobile Money de **Convivium Home Hotel**.

---

## 1. Philosophie & Absence d'API Payante

- **Aucun recours à une API payante, aucun intermédiaire ni commission d'agrégateur tiers.**
- Les fonds sont versés directement par le client sur les **comptes marchands officiels** de l'hôtel (Orange Money Cameroun et MTN Mobile Money Cameroun).
- L'autorité de validation est exclusivement humaine et opérationnelle : **la Cuisine** vérifie le crédit effectif sur le relevé ou le terminal marchand avant d'engager la préparation du repas.

---

## 2. Configuration des Comptes Marchands (Espace Direction)

Dans le tableau de bord Admin > onglet **« MoMo & Orange Money »** :

### Paramètres Orange Money :
- **Code Marchand Réel** : Renseignez le code attribué par Orange Cameroun (ex: `123456`).
- **Nom du Compte Marchand** : Doit correspondre exactement au nom affiché sur le prompt USSD (ex: `CONVIVIUM HOME`).
- **Statut Actif** : Active ou désactive le moyen de paiement pour les clients sur le menu public.
- **Validation sur Appareil Réel (`is_tested_on_device`)** : Doit être coché **uniquement après un test physique concluant** avec une carte SIM Orange Cameroun.

### Paramètres MTN Mobile Money :
- **Code Marchand Réel** : Renseignez le code marchand MTN MoMo (ex: `654321`).
- **Nom du Compte Marchand** : Nom officiel du compte marchand MTN.
- **Statut Actif** : Active ou désactive la méthode pour les clients.
- **Validation sur Appareil Réel (`is_tested_on_device`)** : Doit être coché **uniquement après un test physique concluant** avec une carte SIM MTN Cameroun.

---

## 3. Règle Critique de Sécurité USSD (`is_tested_on_device`)

Les chaînes USSD peuvent réagir différemment selon le modèle de smartphone Android et la version du modem réseau. 

Pour protéger les clients contre les erreurs de composition :
1. **Tant que le format n'a pas été testé physiquement**, le commutateur `is_tested_on_device` reste à `false`.
2. **Conséquence dans l'interface** : Le bouton de composition automatique (`tel:*150*...#`) est **désactivé**. L'interface affiche clairement le montant exact officiel calculé par le serveur, le code marchand et les instructions manuelles à composer sur le téléphone, avec un bouton de copie rapide.
3. **Dès qu'un test concluant est validé par la Direction**, activez `is_tested_on_device`. L'application proposera alors l'ouverture directe du composeur téléphonique aux clients.

---

## 4. Syntaxe USSD de Référence au Cameroun

### MTN MoMo (Cameroun)
- **Parcours Direct (si marchand validé)** : `*126*14*CODE_MARCHAND*MONTANT#`
- **Parcours Guidé** : `*126#` > Paiement Marchand > Saisir le Code Marchand > Saisir le Montant > Valider avec le PIN.

### Orange Money (Cameroun)
- **Parcours Direct (si marchand validé)** : `#150*47*CODE_MARCHAND*MONTANT#`
- **Parcours Guidé** : `#150*47#` > Saisir le Code Marchand > Saisir le Montant > Valider avec le Code Secret.

> **Rappel de sécurité** : L'application ne demande, ne stocke et ne traite **jamais** le code PIN Mobile Money du client. Le PIN est saisi exclusivement dans l'environnement sécurisé de l'opérateur sur le combiné téléphonique du client.

---

## 5. Déroulement du Contrôle par la Cuisine

1. Le client passe sa commande sur le site.
2. Il compose le code USSD et valide le transfert sur son téléphone.
3. Il clique sur « J'ai payé » et renseigne facultativement la référence de transaction ou le texte du SMS reçu.
4. La commande passe à l'état `payment_declared`.
5. **Sur le terminal de la Cuisine** : La commande s'affiche en surbrillance avec l'opérateur et les informations déclarées.
6. Le personnel Cuisine consulte le téléphone de caisse de l'hôtel ou le relevé marchand officiel.
7. Si le montant exact est constaté : la Cuisine clique sur **« Confirmer »** et saisit la référence officielle constatée sur le relevé.
8. La commande passe au statut `paid`, et la Cuisine peut dès lors engager la préparation.
