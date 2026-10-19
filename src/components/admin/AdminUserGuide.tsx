import React, { useState } from 'react';
import {
  CreditCard,
  Users,
  Sliders,
  QrCode,
  History,
  Utensils,
  Search,
  BookOpen,
  Check,
  ClipboardList,
  Archive,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export const AdminUserGuide: React.FC = () => {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const isFr = language === 'fr';

  const sections = [
    {
      id: 'orders',
      title: isFr ? '1. Supervision des commandes & Recettes' : '1. Orders Oversight & Revenue',
      icon: ClipboardList,
      badge: isFr ? 'Pilotage' : 'Management',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      items: [
        {
          heading: isFr ? 'Indicateurs clés du bandeau supérieur' : 'Top Dashboard KPI Strips',
          desc: isFr
            ? 'Affiche en direct les recettes confirmées par la Cuisine (uniquement argent réellement reçu), le nombre total de commandes et les déclarations en attente.'
            : 'Live indicators showing confirmed revenue (only actually validated cash), total orders, and pending customer declarations.',
        },
        {
          heading: isFr ? 'Bouton « Exporter CSV »' : '"Export CSV" Button',
          desc: isFr
            ? 'Génère et télécharge instantanément un fichier tableur (compatible Excel, Numbers, Google Sheets) avec toutes les commandes, montants, modes, dates et numéros de clients.'
            : 'Instantly exports a spreadsheet file (Excel, Numbers, Google Sheets) containing all orders, revenues, locations, timestamps, and customer phones.',
        },
        {
          heading: isFr ? 'Bouton « Rapport financier »' : '"Financial Report" Button',
          desc: isFr
            ? 'Ouvre une synthèse comptable détaillée : chiffre d’affaires total, panier moyen, répartition par mode (sur place, chambre, livraison) et taux de confirmation.'
            : 'Opens a complete financial breakdown: total revenue, average ticket, service mode distribution, and payment confirmation rate.',
        },
        {
          heading: isFr ? 'Bouton « Imprimer le rapport »' : '"Print Report" Button',
          desc: isFr
            ? 'Formate le rapport pour impression papier officielle ou sauvegarde en PDF comptable propre sans menus ni éléments de navigation.'
            : 'Prepares the summary report for clean paper printing or official PDF archiving without navigation clutter.',
        },
        {
          heading: isFr ? 'Bouton « Vider l’historique »' : '"Clear History" Button',
          desc: isFr
            ? 'Action sécurisée : permet de purger les anciennes commandes déjà servies ou la totalité des commandes archivées. Exige une confirmation explicite.'
            : 'Secured purge: clears served/completed orders or full archives with explicit modal confirmation to prevent accidental loss.',
        },
      ],
    },
    {
      id: 'history',
      title: isFr ? '2. Onglet « Historique des commandes »' : '2. "Order History" Tab',
      icon: Archive,
      badge: isFr ? 'Archivage' : 'Archive',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      items: [
        {
          heading: isFr ? 'Séparation stricte des commandes servies' : 'Strict Separation of Served Orders',
          desc: isFr
            ? 'Les commandes terminées et livrées ne polluent pas l’écran actif. Elles sont regroupées dans cet onglet d’archives.'
            : 'Completed and served orders no longer clutter the active board. They are consolidated in this archive tab.',
        },
        {
          heading: isFr ? 'Recherche et inspection rétroactive' : 'Search & Order Audit',
          desc: isFr
            ? 'Permet de retrouver toute commande passée par référence (ex: CVH-2610-A1B2), par numéro de table ou de chambre, et d’en inspecter la facture détaillée.'
            : 'Enables looking up any historical order by reference, table, room, or phone number, and viewing full itemized records.',
        },
      ],
    },
    {
      id: 'payments',
      title: isFr ? '3. Moyens de paiement & Comptes marchands' : '3. Payment Methods & Merchant Accounts',
      icon: CreditCard,
      badge: isFr ? 'Trésorerie' : 'Treasury',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      items: [
        {
          heading: isFr ? 'Comptes Orange Money et MTN MoMo' : 'Orange Money & MTN MoMo Accounts',
          desc: isFr
            ? 'Configure les numéros et codes marchands officiels sur lesquels les clients effectuent leurs règlements Mobile Money.'
            : 'Configures official merchant phone numbers and merchant codes where customers send their Mobile Money payments.',
        },
        {
          heading: isFr ? 'Bouton « Modifier le compte »' : '"Edit Account" Button',
          desc: isFr
            ? 'Permet d’actualiser le numéro de téléphone destinataire, le nom du compte marchand, le code marchand et la syntaxe du code USSD.'
            : 'Updates destination phone number, account name, merchant code, and USSD dial syntax.',
        },
        {
          heading: isFr ? 'Interrupteur « Actif / Inactif »' : '"Active / Inactive" Switch',
          desc: isFr
            ? 'Active ou masque en temps réel l’option de paiement correspondante sur le site client (ex: si le compte MTN est en maintenance).'
            : 'Instantly enables or hides the payment operator on the public client application.',
        },
      ],
    },
    {
      id: 'modes',
      title: isFr ? '4. Modes de commande & Frais de livraison' : '4. Service Modes & Delivery Fees',
      icon: Sliders,
      badge: isFr ? 'Configuration' : 'Settings',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
      items: [
        {
          heading: isFr ? 'Interrupteurs des modes (Sur place, Chambre, Livraison)' : 'Service Mode Toggles',
          desc: isFr
            ? 'Activez ou désactivez les canaux de service autorisés. Si vous désactivez « Livraison », l’option disparaît immédiatement du panier client.'
            : 'Toggle allowed service channels. Disabling "Delivery" immediately removes it from the customer checkout.',
        },
        {
          heading: isFr ? 'Champ « Frais de livraison forfaitaires (FCFA) »' : '"Delivery Fee (XAF)" Field',
          desc: isFr
            ? 'Définissez le coût fixe de livraison. Si la valeur est 0, la livraison est gratuite. Si elle est > 0, elle s’ajoute automatiquement au panier pour toute commande en livraison.'
            : 'Defines flat delivery fee. If 0, delivery is free. If > 0, it is automatically billed on any delivery checkout.',
        },
        {
          heading: isFr ? 'Bouton « Enregistrer les modes »' : '"Save Modes" Button',
          desc: isFr
            ? 'Applique immédiatement les nouveaux réglages sur l’ensemble de l’application sans redémarrage.'
            : 'Instantly applies new service rules across the whole application without reboot.',
        },
      ],
    },
    {
      id: 'locations',
      title: isFr ? '5. Tables, Chambres et QR Codes' : '5. Tables, Rooms & QR Codes',
      icon: QrCode,
      badge: isFr ? 'QR Local' : 'Local QR',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      items: [
        {
          heading: isFr ? 'Génération 100% locale et autonome' : '100% Local Autonomous Generation',
          desc: isFr
            ? 'Tous les QR codes sont générés directement dans l’application, sans aucune API externe payante, sans abonnement tiers et sans dépendance.'
            : 'All QR codes are generated directly in the app without third-party paid APIs or recurring subscriptions.',
        },
        {
          heading: isFr ? 'Bouton « Nouvel emplacement »' : '"New Location" Button',
          desc: isFr
            ? 'Crée une table (ex: "Table 1") ou une chambre (ex: "Chambre 204"). Le système empêche automatiquement les doublons pour le même type.'
            : 'Creates a Table or Room location. The system strictly prevents duplicate labels of the same type.',
        },
        {
          heading: isFr ? 'Bouton « Télécharger PNG / SVG »' : '"Download PNG / SVG" Button',
          desc: isFr
            ? 'Exporte le fichier image haute résolution du QR Code pour vos créations graphiques, menus plastifiés ou affiches.'
            : 'Exports crisp high-resolution QR image files for your printed menus, flyers, or signs.',
        },
        {
          heading: isFr ? 'Bouton « Planche A4 (PDF) »' : '"A4 Printable Sheet (PDF)" Button',
          desc: isFr
            ? 'Génère une grille au format A4 prête à imprimer contenant les étiquettes QR avec repères de découpe.'
            : 'Generates a ready-to-print A4 sheet with QR labels and cutting lines.',
        },
        {
          heading: isFr ? 'Bouton « Régénérer le QR »' : '"Regenerate QR" Button',
          desc: isFr
            ? 'Invalide immédiatement l’ancien QR code physique en cas de compromission et produit un nouveau jeton d’accès sécurisé.'
            : 'Immediately revokes the previous physical QR code in case of tampering and issues a brand-new token.',
        },
      ],
    },
    {
      id: 'menu',
      title: isFr ? '6. Carte, Catégories & Compléments' : '6. Menu, Categories & Complements',
      icon: Utensils,
      badge: isFr ? 'Catalogue' : 'Catalog',
      badgeColor: 'bg-stone-100 text-stone-900 border-stone-300',
      items: [
        {
          heading: isFr ? 'Bouton « Ajouter un plat »' : '"Add Item" Button',
          desc: isFr
            ? 'Formulaire complet : titre (FR/EN), description facultative, prix en FCFA, upload photo (via ImgBB), et gestion des variantes de portions.'
            : 'Complete form: title (FR/EN), optional description, price in XAF, photo upload (via ImgBB), and variant portions.',
        },
        {
          heading: isFr ? 'Bouton « Nouvelle catégorie »' : '"New Category" Button',
          desc: isFr
            ? 'Organise le menu en familles (Entrées, Plats camerounais, Grillades, Desserts, Boissons) et supporte les sous-catégories parentes.'
            : 'Structures the menu into sections with parent/child subcategory support.',
        },
        {
          heading: isFr ? 'Sécurité de suppression' : 'Deletion Safeguard',
          desc: isFr
            ? 'Le système bloque formellement la suppression d’une catégorie si elle contient encore des plats, évitant les erreurs de manipulation.'
            : 'The database strictly blocks deleting any category that still has attached dishes to prevent accidental data loss.',
        },
        {
          heading: isFr ? 'Compléments & Sauces en catégories simples' : 'Sides & Sauces as Dedicated Categories',
          desc: isFr
            ? 'Les compléments et sauces sont désormais gérés directement sous forme de catégories et plats ordinaires dans « Plats » et « Catégories », sans logique d’imbrication superflue.'
            : 'Sides and sauces are now managed directly as standard categories and catalog items in "Dishes" and "Categories", avoiding complex nested logic.',
        },
      ],
    },
    {
      id: 'staff',
      title: isFr ? '7. Personnel Cuisine' : '7. Kitchen Staff Management',
      icon: Users,
      badge: isFr ? 'Sécurité RH' : 'Staff Security',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      items: [
        {
          heading: isFr ? 'Bouton « Créer un compte Cuisine »' : '"Create Kitchen Account" Button',
          desc: isFr
            ? 'Crée un identifiant réservé au personnel cuisine. Ce compte donne accès exclusivement à l’Espace Cuisine, sans aucun droit d’administration.'
            : 'Creates a dedicated kitchen login. Grants access strictly to the Kitchen Workspace, without administrative privileges.',
        },
        {
          heading: isFr ? 'Interrupteur « Actif / Désactivé »' : '"Active / Deactivated" Switch',
          desc: isFr
            ? 'Bloque instantanément l’accès d’un employé lors de son départ sans supprimer l’historique des commandes qu’il a traitées.'
            : 'Immediately revokes an employee’s login when they leave, while strictly preserving their past audit trail.',
        },
      ],
    },
    {
      id: 'audit',
      title: isFr ? '8. Journal d’audit & Traçabilité' : '8. Audit Trail & Traceability',
      icon: History,
      badge: isFr ? 'Conformité' : 'Compliance',
      badgeColor: 'bg-red-100 text-red-900 border-red-300',
      items: [
        {
          heading: isFr ? 'Journal infalsifiable' : 'Tamper-Proof Audit Log',
          desc: isFr
            ? 'Chaque confirmation de paiement, rejet, modification de prix ou changement de statut est horodaté et consigné avec l’identifiant de l’auteur.'
            : 'Every payment confirmation, rejection, price adjustment, or status update is immutably timestamped with user ID.',
        },
        {
          heading: isFr ? 'Filtres par catégorie (Paiements, Commandes, Catalogue)' : 'Category Filters (Payments, Orders, Catalog)',
          desc: isFr
            ? 'Isolez instantanément les événements financiers ou les actions du personnel pour un contrôle interne rigoureux.'
            : 'Quickly filter financial operations or staff actions for rigorous internal control.',
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
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-hotel-border shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9A721C]/15 text-[#9A721C] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-hotel-text">
                {isFr ? 'Mode d’emploi — Administration' : 'Management Workspace User Guide'}
              </h2>
              <p className="text-xs text-hotel-secondary">
                {isFr
                  ? 'Guide direct et exhaustif de chaque bouton, paramètre et fonction de supervision de la Direction.'
                  : 'Direct and comprehensive guide for every button, setting, and supervisory tool for Management.'}
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
              placeholder={isFr ? 'Rechercher un bouton, un réglage...' : 'Search button, setting...'}
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
