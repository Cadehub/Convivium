import React from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onOpenStaffLogin?: () => void;
}

export const Footer: React.FC<FooterProps> = () => {
  const { t, language } = useLanguage();

  return (
    <footer className="bg-white border-t border-hotel-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b border-hotel-border">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.jpg"
              alt="Convivium Home Hotel"
              className="w-11 h-11 rounded-full object-cover border border-stone-200 shrink-0"
            />
            <div>
              <h3 className="font-serif text-lg font-semibold text-hotel-text leading-tight">
                Convivium Home Hotel
              </h3>
              <p className="text-xs text-hotel-muted flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#9A721C]" />
                <span>Douala, Cameroun — {t.tagline}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-hotel-secondary">
            <span className="px-2.5 py-1 rounded-md bg-hotel-subtle border border-hotel-border font-medium">
              Orange Money
            </span>
            <span className="px-2.5 py-1 rounded-md bg-hotel-subtle border border-hotel-border font-medium">
              MTN Mobile Money
            </span>
            <span className="px-2.5 py-1 rounded-md bg-hotel-subtle border border-hotel-border font-medium">
              {language === 'fr' ? 'Service en salle, chambre & livraison' : 'Dine-in, Room Service & Delivery'}
            </span>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-hotel-muted">
          <p>
            © {new Date().getFullYear()} Convivium Home Hotel.{' '}
            {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}
          </p>

          <p className="text-[11px] text-hotel-muted">
            {language === 'fr' ? 'Hospitalité & Restauration de Prestige' : 'Hospitality & Prestige Dining'}
          </p>
        </div>
      </div>
    </footer>
  );
};
