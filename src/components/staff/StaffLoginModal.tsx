import React, { useState } from 'react';
import { X, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: 'admin' | 'cuisine') => void;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { signIn, role } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error);
        return;
      }
      onClose();
      if (role) {
        onSuccess(role);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-hotel-surface border border-hotel-cardBorder rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        <div className="flex items-center justify-between pb-4 border-b border-hotel-cardBorder">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-hotel-card border border-hotel-cardBorder text-hotel-gold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-hotel-text">
                {t.staffLoginTitle}
              </h2>
              <p className="text-[11px] text-hotel-muted">Direction & Cuisine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-hotel-muted hover:text-hotel-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-hotel-text mb-1">
              {t.email}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-hotel-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-hotel-text mb-1">
              {t.password}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-hotel-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-hotel-card border border-hotel-cardBorder text-hotel-text text-sm focus:outline-none focus:border-hotel-gold"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-gold py-2.5 text-sm font-bold flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.loading}</span>
                </>
              ) : (
                <span>{t.loginButton}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
