import React from 'react';
import { Lock, Phone, MapPin } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onOpenStaffLogin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenStaffLogin }) => {
  const { t } = useLanguage();

  return (
    <footer className="bg-hotel-black border-t border-hotel-cardBorder mt-20">
      {/* Decorative Greek Meander line */}
      <div className="border-greek-pattern opacity-60 w-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif text-lg font-bold text-hotel-text">
                CONVIVIUM HOME HOTEL
              </span>
              <span className="text-xs font-serif text-hotel-gold font-bold">★★★</span>
            </div>
            <p className="text-xs text-hotel-muted leading-relaxed max-w-sm">
              {t.tagline}
            </p>
          </div>

          {/* Contact & Location in Cameroon */}
          <div className="space-y-2 text-xs text-hotel-muted">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-hotel-gold flex-shrink-0" />
              <span>Cameroun — Douala / Yaoundé</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-hotel-gold flex-shrink-0" />
              <span>Service Réception & Commandes</span>
            </div>
          </div>

          {/* Discreet Staff Portal & Copyright */}
          <div className="flex flex-col md:items-end justify-between space-y-4">
            <button
              onClick={onOpenStaffLogin}
              className="inline-flex items-center gap-1.5 text-xs text-hotel-muted/70 hover:text-hotel-gold transition-colors py-1 px-2.5 rounded border border-hotel-cardBorder/50 hover:border-hotel-gold/40"
            >
              <Lock className="w-3 h-3 text-hotel-gold" />
              <span>{t.navStaff}</span>
            </button>
            <p className="text-[11px] text-hotel-muted/60">
              © {new Date().getFullYear()} Convivium Home Hotel. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
