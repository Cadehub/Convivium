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
    <div className="fixed inset-0 z-50 overflow-y-auto p-0 sm:p-4 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white border-t sm:border border-hotel-border rounded-t-2xl sm:rounded-2xl shadow-elevated p-5 sm:p-7 z-10 pb-safe">
        <div className="flex items-start justify-between pb-4 border-b border-hotel-border">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Convivium Home Hotel"
              className="w-10 h-10 rounded-full object-cover border border-stone-200 shrink-0"
            />
            <div>
              <h2 className="font-serif text-xl font-semibold text-hotel-text leading-tight">
                {t.staffLoginTitle}
              </h2>
              <p className="text-xs text-hotel-secondary mt-0.5">{t.staffLoginSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {t.email}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-hotel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="input-hotel pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-hotel-text mb-1.5">
              {t.password}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-hotel-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="input-hotel pl-10"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-outline-gold py-2.5 px-4 text-xs"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-gold py-2.5 text-sm font-semibold"
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
