import React, { useState } from 'react';
import {
  ChefHat,
  ShieldCheck,
  Clock,
  Utensils,
  Search,
  Bell,
  BookOpen,
  Check,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const KitchenUserGuide: React.FC = () => {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const isFr = language === 'fr';

  const sections = [
    {
      id: 'flow',
      title: isFr ? '1. Règle d’or du flux opérationnel' : '1. Golden Operational Workflow Rule',
      icon: ChefHat,
      badge: isFr ? 'Obligatoire' : 'Mandatory',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      items: [
        {
          heading: isFr ? 'Principe strict' : 'Strict Principle',
          desc: isFr
            ? 'Ne JAMAIS commencer à cuisiner un plat tant que son paiement n’a pas été formellement vérifié et validé sur le compte marchand officiel de l’hôtel.'
            : 'NEVER start cooking a dish until payment has been formally verified and confirmed on the official hotel merchant account.',
        },
        {
          heading: isFr ? 'Les 2 étapes distinctes' : 'The 2 Distinct Steps',
          desc: isFr
            ? 'Étape A : Contrôle du paiement (espace « Nouvelles commandes »). Étape B : Préparation en cuisine puis remise au client (espace « Commandes en cuisine »).'
            : 'Step A: Payment verification (in "New Orders"). Step B: Kitchen cooking then handover to customer (in "Kitchen Orders").',
        },
        {
          heading: isFr ? 'Disparition automatique après service' : 'Automatic Move to History',
          desc: isFr
            ? 'Dès qu’une commande est marquée « Servie », elle quitte immédiatement l’écran actif et est archivée dans l’onglet « Historique des commandes ».'
            : 'As soon as an order is marked "Served", it immediately leaves the active screen and is archived into the "Order History" tab.',
        },
      ],
    },
    {
      id: 'payment-step',
      title: isFr ? '2. Étape A — Vérification des paiements (Bouton par bouton)' : '2. Step A — Payment Verification (Button by Button)',
      icon: ShieldCheck,
      badge: isFr ? 'Finances' : 'Finance',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      items: [
        {
          heading: isFr ? 'Bouton « Vérifier le paiement »' : '"Verify Payment" Button',
          desc: isFr
            ? 'Situé sur chaque carte de nouvelle commande. Clique pour ouvrir le modal de contrôle. Ne valide rien à lui seul : il sert uniquement à inspecter les informations.'
            : 'Located on each new order card. Click to open the verification modal. Does not confirm anything by itself: it is purely for inspecting information.',
        },
        {
          heading: isFr ? 'Montant attendu (en gros caractères)' : 'Expected Amount (Large Text)',
          desc: isFr
            ? 'Le montant exact en FCFA que vous DEVEZ constater sur le téléphone de la réception ou sur le compte marchand MTN MoMo / Orange Money de Convivium.'
            : 'The exact amount in XAF that you MUST confirm on the official hotel reception phone or merchant account.',
        },
        {
          heading: isFr ? 'SMS de confirmation transmis par le client' : 'Customer Confirmation SMS',
          desc: isFr
            ? 'Affiche le texte exact du SMS de débit. Le système analyse automatiquement l’ID de transaction et le montant déclaré par le client.'
            : 'Displays the raw text of the debit SMS. The system automatically parses transaction ID and customer-declared amount.',
        },
        {
          heading: isFr ? 'Bouton « Confirmer le paiement » (Bouton vert / or)' : '"Confirm Payment" Button (Green / Gold)',
          desc: isFr
            ? 'Action : Valide définitivement la transaction et bascule la commande en Étape B (Cuisine). À cliquer UNIQUEMENT après avoir vérifié la présence de l’argent sur le compte marchand officiel.'
            : 'Action: Formally confirms transaction and moves order to Step B (Kitchen). Click ONLY after verifying funds received in merchant statement.',
        },
        {
          heading: isFr ? 'Bouton « Rejeter la déclaration » (Bouton rouge)' : '"Reject Declaration" Button (Red)',
          desc: isFr
            ? 'Action : Rejette une fausse tentative, un SMS invalide ou un montant insuffisant. Ouvre une boîte où vous devez saisir le motif (ex: "Aucune transaction reçue"). Le client est notifié instantanément.'
            : 'Action: Rejects a fake attempt, invalid SMS or insufficient amount. Prompts for mandatory reason (e.g. "No transaction found"). Client is notified immediately.',
        },
        {
          heading: isFr ? 'Bouton « Marquer à vérifier » (Bouton orange)' : '"Flag for Review" Button (Orange)',
          desc: isFr
            ? 'Action : En cas de doute ou de retard réseau sur l’opérateur, conserve la commande en attente et enregistre une note interne pour vos collègues.'
            : 'Action: If in doubt or experiencing carrier delays, keeps order pending and logs an internal note for your teammates.',
        },
      ],
    },
    {
      id: 'kitchen-step',
      title: isFr ? '3. Étape B — Préparation et Service des commandes' : '3. Step B — Preparation & Order Service',
      icon: Clock,
      badge: isFr ? 'Opérationnel' : 'Operations',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
      items: [
        {
          heading: isFr ? 'Carte compacte opérationnelle' : 'Compact Operational Card',
          desc: isFr
            ? 'Affiche la référence (ex: CVH-2610-A1B2), l’heure de réception, le mode de service (Table n°, Chambre n° ou Adresse de livraison) et le statut actuel.'
            : 'Shows public reference (e.g. CVH-2610-A1B2), receipt time, service location (Table #, Room #, or Delivery Address), and current preparation state.',
        },
        {
          heading: isFr ? 'Bouton « Voir la commande »' : '"View Order" Button',
          desc: isFr
            ? 'Ouvre la fiche de préparation complète : liste de tous les plats, variantes (portions/formats), sauces et compléments sélectionnés, et instructions spéciales.'
            : 'Opens full prep sheet: complete dish list, selected variants, sides/sauces, and special dish notes.',
        },
        {
          heading: isFr ? 'Instructions particulières sous chaque plat' : 'Special Notes Under Each Dish',
          desc: isFr
            ? 'Les demandes spéciales des clients (ex: "sans piment", "cuisson bien cuit") apparaissent en surbrillance sous le plat concerné avec une icône dédiée.'
            : 'Special client requests (e.g. "no pepper", "well done") appear highlighted under the respective dish with a dedicated icon.',
        },
        {
          heading: isFr ? 'Bouton « En préparation »' : '"In Preparation" Button',
          desc: isFr
            ? 'Action : Notifie le système et le client que la cuisson a débuté en cuisine.'
            : 'Action: Flags system and client tracking that cooking is actively underway.',
        },
        {
          heading: isFr ? 'Bouton « Prête pour le service »' : '"Ready for Service" Button',
          desc: isFr
            ? 'Action : La commande est dressée et prête à être emportée par le serveur ou le livreur.'
            : 'Action: Food is plated and ready for server pickup or delivery driver.',
        },
        {
          heading: isFr ? 'Bouton « Marquer comme Servie » (Clôture)' : '"Mark as Served" Button (Close)',
          desc: isFr
            ? 'Action : Le client a reçu ses plats. Cette action retire définitivement la commande du tableau de bord actif et la transfère immédiatement dans l’onglet « Historique des commandes ».'
            : 'Action: Customer received their order. This action definitively removes the order from the active board and transfers it to the "Order History" tab.',
        },
      ],
    },
    {
      id: 'history-tab',
      title: isFr ? '4. Onglet « Historique des commandes »' : '4. "Order History" Tab',
      icon: BookOpen,
      badge: isFr ? 'Nouveau' : 'New',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      items: [
        {
          heading: isFr ? 'Pourquoi cet onglet ?' : 'Why this tab?',
          desc: isFr
            ? 'Pour éviter d’encombrer votre vue de travail avec des plats déjà livrés. Les commandes terminées ne polluent plus l’écran actif de la cuisine.'
            : 'Prevents cluttering your active workflow with already fulfilled dishes. Completed orders no longer crowd the active kitchen screen.',
        },
        {
          heading: isFr ? 'Recherche par référence, table, chambre' : 'Search by Ref, Table, Room',
          desc: isFr
            ? 'Permet de retrouver instantanément une ancienne commande en cas de réclamation ou pour vérifier l’historique d’un client.'
            : 'Instantly locate any past order for verification, customer questions, or review.',
        },
        {
          heading: isFr ? 'Bouton « Voir les détails »' : '"View Details" Button',
          desc: isFr
            ? 'Permet de réouvrir la fiche complète d’une commande servie : articles préparés, compléments, montant réglé, référence Mobile Money et date/heure de clôture.'
            : 'Re-opens the complete summary of any served order: items prepared, complements, paid total, transaction reference, and completion time.',
        },
      ],
    },
    {
      id: 'menu-tab',
      title: isFr ? '5. Onglets Menu & Catégories (Compléments et Sauces)' : '5. Menu & Categories Tabs (Sides & Sauces)',
      icon: Utensils,
      badge: isFr ? 'Gestion du stock' : 'Stock Control',
      badgeColor: 'bg-stone-100 text-stone-900 border-stone-300',
      items: [
        {
          heading: isFr ? 'Bouton « Disponible / Masquer » (Icône Œil)' : '"Available / Hidden" Toggle (Eye Icon)',
          desc: isFr
            ? 'Action : En 1 clic, active ou désactive un plat sur le menu public des clients. Si un ingrédient manque en cuisine, cliquez sur l’œil pour masquer le plat immédiatement.'
            : 'Action: 1-click toggles a dish on/off the public menu. If an ingredient runs out, click the eye to hide it from customers instantly.',
        },
        {
          heading: isFr ? 'Bouton « Ajouter un plat »' : '"Add Dish" Button',
          desc: isFr
            ? 'Ouvre le formulaire pour créer un nouvel article avec intitulé en français et en anglais, prix en FCFA, temps de cuisson moyen, catégorie et photo facultative.'
            : 'Opens form to create a new item with French and English titles, price in XAF, cooking time, category, and optional photo.',
        },
        {
          heading: isFr ? 'Compléments & Sauces en catégories simples' : 'Sides & Sauces as Simple Categories',
          desc: isFr
            ? 'Les compléments (frites, plantains, riz, miondo...) et sauces (piment, mayonnaise...) sont désormais des catégories normales du menu. Les clients les commandent directement comme n’importe quel plat, sans options complexes imbriquées.'
            : 'Sides (fries, plantains, rice...) and sauces (pepper, mayo...) are now normal menu categories. Customers order them directly from the catalog with zero complicated nested add-ons.',
        },
      ],
    },
    {
      id: 'tools',
      title: isFr ? '6. Outils d’en-tête & Cloche sonore' : '6. Header Tools & Sound Alerts',
      icon: Bell,
      badge: isFr ? 'Outils' : 'Tools',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      items: [
        {
          heading: isFr ? 'Cloche de notification sonore' : 'Sound Notification Bell',
          desc: isFr
            ? 'Active un carillon sonore d’alerte automatique dès qu’un client passe une commande ou soumet une déclaration de paiement Mobile Money.'
            : 'Enables an audible chime as soon as a customer places an order or declares a Mobile Money transfer.',
        },
        {
          heading: isFr ? 'Bouton « Actualiser »' : '"Refresh" Button',
          desc: isFr
            ? 'Force la re-synchronisation manuelle immédiate de toutes les commandes avec le serveur central en cas de réseau instable.'
            : 'Forces an immediate full refresh of all orders with the server if internet connection is unstable.',
        },
        {
          heading: isFr ? 'Sélecteur FR / EN' : 'FR / EN Switcher',
          desc: isFr
            ? 'Bascule l’intégralité de l’interface Cuisine instantanément entre le français et l’anglais.'
            : 'Switches the entire Kitchen dashboard instantly between French and English.',
        },
      ],
    },
  ];

  const filteredSections = sections
    .map((sec) => {
      if (!searchTerm.trim()) return sec;
      const q = searchTerm.toLowerCase();
      const matchSection = sec.title.toLowerCase().includes(q);
      const filteredItems = sec.items.filter(
        (it) => it.heading.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)
      );
      if (matchSection) return sec;
      if (filteredItems.length > 0) return { ...sec, items: filteredItems };
      return null;
    })
    .filter(Boolean) as typeof sections;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-hotel-border shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9A721C]/15 text-[#9A721C] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
                {isFr ? 'Mode d’emploi — Espace Cuisine' : 'Kitchen Workspace User Guide'}
              </h2>
              <p className="text-xs text-hotel-secondary">
                {isFr
                  ? 'Guide direct et exhaustif de chaque bouton, étape et fonctionnement du poste cuisine.'
                  : 'Direct and comprehensive guide for every button, step, and kitchen operation.'}
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isFr ? 'Rechercher un bouton, une action...' : 'Search button, action...'}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-hotel-border focus:border-[#9A721C] focus:ring-1 focus:ring-[#9A721C] bg-white outline-hidden"
            />
          </div>
        </div>

        {/* Quick jump pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-stone-100">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider shrink-0 mr-1">
            {isFr ? 'Accès rapide :' : 'Quick jump:'}
          </span>
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              {sec.title.split('—')[0].trim()}
            </a>
          ))}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-5">
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div
              key={sec.id}
              id={sec.id}
              className="bg-white rounded-2xl border border-hotel-border p-5 sm:p-6 shadow-subtle space-y-4 scroll-mt-20"
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-hotel-subtle flex items-center justify-center text-[#9A721C] shrink-0 border border-hotel-border">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-hotel-text">
                    {sec.title}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${sec.badgeColor}`}
                >
                  {sec.badge}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sec.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200/80 space-y-1 hover:border-[#D8C79A] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#9A721C] shrink-0 mt-0.5" />
                      <h4 className="text-xs font-bold text-hotel-text leading-snug">
                        {item.heading}
                      </h4>
                    </div>
                    <p className="text-xs text-hotel-secondary pl-5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
