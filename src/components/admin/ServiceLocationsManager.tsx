import React, { useState, useEffect, useMemo } from 'react';
import {
  QrCode,
  Plus,
  Search,
  CheckSquare,
  Square,
  Printer,
  Download,
  RotateCw,
  Edit2,
  Trash2,
  Utensils,
  BedDouble,
  Globe,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import type { ServiceLocation, ServiceLocationType, RestaurantSettings } from '../../types';
import { serviceLocationService } from '../../services/service-location.service';
import { generateQrDataUrl, generateQrSvg, buildLocationScanUrl, triggerFileDownload } from '../../lib/qr';
import { useLanguage } from '../../i18n/LanguageContext';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface ServiceLocationsManagerProps {
  restaurantSettings: RestaurantSettings | null;
  onUpdateSettings: (updates: Partial<RestaurantSettings>) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ServiceLocationsManager: React.FC<ServiceLocationsManagerProps> = ({
  restaurantSettings,
  onUpdateSettings,
  showToast,
}) => {
  const { language, t } = useLanguage();

  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'table' | 'room'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ServiceLocation | null>(null);
  const [rotateConfirmLocation, setRotateConfirmLocation] = useState<ServiceLocation | null>(null);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<ServiceLocation | null>(null);
  const [previewLocation, setPreviewLocation] = useState<ServiceLocation | null>(null);
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState(false);
  const [printTargets, setPrintTargets] = useState<ServiceLocation[]>([]);

  // Add/Edit Form state
  const [formType, setFormType] = useState<ServiceLocationType>('table');
  const [formLabel, setFormLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Production URL state
  const [publicUrlInput, setPublicUrlInput] = useState(restaurantSettings?.public_app_url || '');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);

  useEffect(() => {
    if (restaurantSettings?.public_app_url) {
      setPublicUrlInput(restaurantSettings.public_app_url);
    }
  }, [restaurantSettings?.public_app_url]);

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const data = await serviceLocationService.getAllLocations();
      setLocations(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement des emplacements';
      showToast(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Determine effective base URL for QR codes
  const configuredUrl = (restaurantSettings?.public_app_url || '').trim();
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://convivium.cm';
  const effectiveBaseUrl = configuredUrl || fallbackOrigin;
  const isUrlConfigured = Boolean(
    configuredUrl &&
      !configuredUrl.includes('localhost') &&
      !configuredUrl.includes('127.0.0.1')
  );

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      if (typeFilter !== 'all' && loc.location_type !== typeFilter) return false;
      if (statusFilter === 'active' && !loc.is_active) return false;
      if (statusFilter === 'inactive' && loc.is_active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesLabel = loc.label.toLowerCase().includes(q);
        const matchesCode = loc.code.toLowerCase().includes(q);
        return matchesLabel || matchesCode;
      }
      return true;
    });
  }, [locations, typeFilter, statusFilter, searchQuery]);

  const allFilteredSelected =
    filteredLocations.length > 0 &&
    filteredLocations.every((l) => selectedIds.has(l.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      filteredLocations.forEach((l) => next.add(l.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSavePublicUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = publicUrlInput.trim().replace(/\/+$/, '');
    if (!clean) {
      showToast(language === 'fr' ? 'Veuillez saisir une URL valide.' : 'Please enter a valid URL.');
      return;
    }
    setIsSavingUrl(true);
    try {
      await onUpdateSettings({ public_app_url: clean });
      setIsEditingUrl(false);
      showToast(language === 'fr' ? 'URL publique enregistrée avec succès.' : 'Public URL saved successfully.');
    } catch {
      showToast(language === 'fr' ? 'Erreur lors de l’enregistrement de l’URL.' : 'Failed to save public URL.');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleOpenAdd = (type: ServiceLocationType = 'table') => {
    setFormType(type);
    setFormLabel('');
    setFormError(null);
    setEditingLocation(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (loc: ServiceLocation) => {
    setEditingLocation(loc);
    setFormType(loc.location_type);
    setFormLabel(loc.label);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSubmitLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanLabel = formLabel.trim();
    if (!cleanLabel) {
      setFormError(language === 'fr' ? 'Le nom ou numéro est obligatoire.' : 'Name or number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLocation) {
        await serviceLocationService.updateLocation(editingLocation.id, {
          label: cleanLabel,
        });
        showToast(language === 'fr' ? 'Emplacement modifié.' : 'Location updated.');
      } else {
        await serviceLocationService.createLocation({
          location_type: formType,
          label: cleanLabel,
        });
        showToast(language === 'fr' ? 'Nouvel emplacement créé avec succès.' : 'Location created successfully.');
      }
      setIsAddModalOpen(false);
      await loadLocations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (loc: ServiceLocation) => {
    try {
      await serviceLocationService.updateLocation(loc.id, {
        is_active: !loc.is_active,
      });
      setLocations((prev) =>
        prev.map((l) => (l.id === loc.id ? { ...l, is_active: !l.is_active } : l))
      );
      showToast(
        loc.is_active
          ? language === 'fr'
            ? `« ${loc.label} » désactivé.`
            : `"${loc.label}" deactivated.`
          : language === 'fr'
          ? `« ${loc.label} » réactivé.`
          : `"${loc.label}" reactivated.`
      );
    } catch {
      showToast(language === 'fr' ? 'Erreur lors de la modification.' : 'Failed to update location.');
      loadLocations();
    }
  };

  const handleRotateConfirm = async () => {
    if (!rotateConfirmLocation) return;
    try {
      const newCode = await serviceLocationService.rotateLocationCode(
        rotateConfirmLocation.id,
        rotateConfirmLocation.location_type
      );
      setLocations((prev) =>
        prev.map((l) => (l.id === rotateConfirmLocation.id ? { ...l, code: newCode } : l))
      );
      showToast(language === 'fr' ? 'QR code régénéré avec succès.' : 'QR code rotated successfully.');
      setRotateConfirmLocation(null);
    } catch {
      showToast(language === 'fr' ? 'Erreur lors de la rotation du QR code.' : 'Failed to rotate QR code.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmLocation) return;
    try {
      await serviceLocationService.deleteLocation(deleteConfirmLocation.id);
      setLocations((prev) => prev.filter((l) => l.id !== deleteConfirmLocation.id));
      showToast(language === 'fr' ? 'Emplacement supprimé.' : 'Location deleted.');
      setDeleteConfirmLocation(null);
    } catch {
      showToast(language === 'fr' ? 'Impossible de supprimer cet emplacement.' : 'Cannot delete this location.');
    }
  };

  const handleBatchToggle = async (isActive: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await serviceLocationService.batchToggleActive(ids, isActive);
      setLocations((prev) =>
        prev.map((l) => (ids.includes(l.id) ? { ...l, is_active: isActive } : l))
      );
      setSelectedIds(new Set());
      showToast(
        isActive
          ? language === 'fr'
            ? `${ids.length} emplacements activés.`
            : `${ids.length} locations activated.`
          : language === 'fr'
          ? `${ids.length} emplacements désactivés.`
          : `${ids.length} locations deactivated.`
      );
    } catch {
      showToast(language === 'fr' ? 'Erreur lors de l’opération groupée.' : 'Failed batch operation.');
      loadLocations();
    }
  };

  const handleDownloadSinglePng = async (loc: ServiceLocation) => {
    const url = buildLocationScanUrl(effectiveBaseUrl, loc.code);
    const dataUrl = await generateQrDataUrl(url, { width: 600, margin: 2 });
    const safeName = loc.label.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    triggerFileDownload(`convivium_qr_${safeName}.png`, dataUrl);
    showToast(language === 'fr' ? 'QR code PNG téléchargé.' : 'PNG QR code downloaded.');
  };

  const handleDownloadSingleSvg = async (loc: ServiceLocation) => {
    const url = buildLocationScanUrl(effectiveBaseUrl, loc.code);
    const svgStr = await generateQrSvg(url, { margin: 2 });
    const safeName = loc.label.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    triggerFileDownload(`convivium_qr_${safeName}.svg`, svgStr, 'image/svg+xml');
    showToast(language === 'fr' ? 'QR code SVG vectoriel téléchargé.' : 'SVG QR code downloaded.');
  };

  const handleOpenPrintSheet = (targets: ServiceLocation[]) => {
    if (targets.length === 0) {
      showToast(language === 'fr' ? 'Aucun emplacement sélectionné pour l’impression.' : 'No locations selected for printing.');
      return;
    }
    setPrintTargets(targets);
    setIsPrintSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-hotel-text">
            {t.locationsTitle}
          </h2>
          <p className="text-xs text-hotel-secondary mt-1 max-w-2xl leading-relaxed">
            {t.locationsSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenPrintSheet(locations.filter((l) => l.is_active))}
            disabled={locations.filter((l) => l.is_active).length === 0}
            className="btn-outline-gold text-xs py-2 px-3 font-semibold disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5 text-[#9A721C]" />
            <span>{t.printPdf} ({locations.filter((l) => l.is_active).length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd('table')}
            className="btn-gold text-xs py-2 px-3.5 font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addLocation}</span>
          </button>
        </div>
      </div>

      {/* 2. Production URL Configuration Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isUrlConfigured
          ? 'bg-white border-hotel-border shadow-subtle'
          : 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/40 shadow-card'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isUrlConfigured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-800'
            }`}>
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-hotel-text">
                  {t.productionUrlLabel}
                </span>
                {isUrlConfigured ? (
                  <span className="badge-paid text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'fr' ? 'Configurée' : 'Configured'}</span>
                  </span>
                ) : (
                  <span className="badge-pending text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{language === 'fr' ? 'À configurer avant impression' : 'Configure before printing'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-hotel-secondary mt-0.5 font-mono">
                {configuredUrl || fallbackOrigin}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingUrl ? (
              <button
                type="button"
                onClick={() => setIsEditingUrl(true)}
                className="btn-outline-gold text-xs py-1.5 px-3"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{language === 'fr' ? 'Modifier l’URL' : 'Edit URL'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingUrl(false)}
                className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                {t.cancel}
              </button>
            )}
          </div>
        </div>

        {/* URL Edit Form */}
        {isEditingUrl && (
          <form onSubmit={handleSavePublicUrl} className="mt-4 pt-3.5 border-t border-hotel-border flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1">
              <input
                type="url"
                required
                value={publicUrlInput}
                onChange={(e) => setPublicUrlInput(e.target.value)}
                placeholder="https://convivium-home-hotel.vercel.app"
                className="input-hotel font-mono text-xs bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingUrl}
              className="btn-gold py-2 px-4 text-xs font-semibold shrink-0"
            >
              {isSavingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.save}
            </button>
          </form>
        )}
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="hotel-card p-3.5 sm:p-4 space-y-3 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-hotel-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'fr' ? 'Rechercher par nom (ex : Table 1, Chambre 102)...' : 'Search by name or code...'}
              className="input-hotel pl-9 py-1.5 text-xs bg-[#FAF8F5]/50"
            />
          </div>

          {/* Type & Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-hotel-border bg-[#FAF8F5] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                {t.all} ({locations.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('table')}
                className={`px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1 ${
                  typeFilter === 'table'
                    ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                <Utensils className="w-3 h-3" />
                <span>Tables ({locations.filter((l) => l.location_type === 'table').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('room')}
                className={`px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1 ${
                  typeFilter === 'room'
                    ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                <BedDouble className="w-3 h-3" />
                <span>Chambres ({locations.filter((l) => l.location_type === 'room').length})</span>
              </button>
            </div>

            <div className="inline-flex rounded-lg border border-hotel-border bg-[#FAF8F5] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-hotel-dark text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                {t.all}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-emerald-700 text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                Actifs
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'inactive'
                    ? 'bg-stone-700 text-white font-semibold shadow-2xs'
                    : 'text-hotel-secondary hover:text-hotel-text'
                }`}
              >
                Inactifs
              </button>
            </div>
          </div>
        </div>

        {/* Batch actions strip when items are selected */}
        {selectedIds.size > 0 && (
          <div className="pt-2 border-t border-hotel-border flex flex-wrap items-center justify-between gap-2.5 bg-amber-50/60 p-2.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-950">
              <CheckSquare className="w-4 h-4 text-[#9A721C]" />
              <span>
                {selectedIds.size} {language === 'fr' ? 'sélectionné(s)' : 'selected'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleOpenPrintSheet(locations.filter((l) => selectedIds.has(l.id)))
                }
                className="btn-gold text-[11px] py-1.5 px-3 font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'fr' ? 'Imprimer la sélection' : 'Print selection'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchToggle(true)}
                className="btn-outline-gold text-[11px] py-1.5 px-2.5"
              >
                {language === 'fr' ? 'Activer' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => handleBatchToggle(false)}
                className="py-1.5 px-2.5 rounded-lg border border-stone-300 text-stone-700 bg-white hover:bg-stone-100 text-[11px] font-medium"
              >
                {language === 'fr' ? 'Désactiver' : 'Deactivate'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-hotel-muted hover:text-hotel-text underline px-2"
              >
                {language === 'fr' ? 'Tout désélectionner' : 'Deselect all'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Service Locations List / Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-hotel-muted">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#9A721C] mb-2" />
          <p className="text-xs">{t.loading}</p>
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="py-16 text-center hotel-card p-8 bg-white max-w-lg mx-auto">
          <QrCode className="w-10 h-10 text-hotel-muted mx-auto mb-3" />
          <h3 className="font-serif text-lg font-semibold text-hotel-text mb-1">
            {language === 'fr' ? 'Aucun emplacement trouvé' : 'No locations found'}
          </h3>
          <p className="text-xs text-hotel-secondary max-w-sm mx-auto mb-4">
            {language === 'fr'
              ? 'Créez vos tables et chambres pour générer leurs QR codes de commande officielle.'
              : 'Add your tables and rooms to generate official QR codes for customer orders.'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenAdd('table')}
            className="btn-gold text-xs py-2 px-4 font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addLocation}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all header */}
          <div className="flex items-center justify-between px-2 text-xs text-hotel-secondary">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1.5 text-hotel-muted hover:text-hotel-text transition-colors"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-[#9A721C]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {allFilteredSelected
                  ? language === 'fr' ? 'Désélectionner tout' : 'Deselect all'
                  : language === 'fr' ? 'Tout sélectionner' : 'Select all'}
              </span>
            </button>
            <span>{filteredLocations.length} {language === 'fr' ? 'emplacements affichés' : 'locations shown'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredLocations.map((loc) => {
              const isSelected = selectedIds.has(loc.id);
              const isRoom = loc.location_type === 'room';

              return (
                <div
                  key={loc.id}
                  className={`hotel-card p-4 flex flex-col justify-between transition-all bg-white ${
                    !loc.is_active
                      ? 'border-dashed border-hotel-border opacity-70 bg-stone-50/50'
                      : isSelected
                      ? 'border-[#9A721C] ring-1 ring-[#9A721C]/30 shadow-card'
                      : 'hover:border-hotel-borderStrong'
                  }`}
                >
                  <div>
                    {/* Top strip: Checkbox, Type Badge & Active Status */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-hotel-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOne(loc.id)}
                          className="text-hotel-muted hover:text-[#9A721C] transition-colors p-0.5"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#9A721C]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          isRoom
                            ? 'bg-purple-50 text-purple-900 border border-purple-200'
                            : 'bg-[#FBF7EE] text-[#8A6214] border border-[#E5D099]'
                        }`}>
                          {isRoom ? <BedDouble className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                          <span>{isRoom ? t.locationRoom : t.locationTable}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(loc)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                          loc.is_active ? 'badge-paid' : 'badge-neutral'
                        }`}
                        title={loc.is_active ? 'Désactiver' : 'Activer'}
                      >
                        {loc.is_active
                          ? language === 'fr' ? 'Actif' : 'Active'
                          : language === 'fr' ? 'Désactivé' : 'Disabled'}
                      </button>
                    </div>

                    {/* Middle: Title, Code & QR Thumbnail */}
                    <div className="py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-serif font-bold text-base sm:text-lg text-hotel-text truncate">
                          {loc.label}
                        </h4>
                        <p className="text-[11px] text-hotel-muted font-mono truncate mt-0.5">
                          ID: {loc.code}
                        </p>
                        <p className="text-[10px] text-hotel-secondary mt-1">
                          {isRoom
                            ? language === 'fr' ? 'Service en chambre direct' : 'Direct room service'
                            : language === 'fr' ? 'Commande sur place' : 'Dine-in ordering'}
                        </p>
                      </div>

                      {/* Clickable QR Thumbnail for full Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewLocation(loc)}
                        className="w-14 h-14 rounded-xl border border-hotel-border bg-[#FAF8F5] p-1 flex items-center justify-center shrink-0 hover:scale-105 hover:border-[#9A721C] transition-all shadow-2xs group"
                        title={language === 'fr' ? 'Agrandir le QR code' : 'Preview QR code'}
                      >
                        <QrCode className="w-8 h-8 text-hotel-text group-hover:text-[#9A721C] transition-colors" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom: 4 Action Buttons */}
                  <div className="pt-3 border-t border-hotel-border grid grid-cols-4 gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPreviewLocation(loc)}
                      className="btn-outline-gold py-1.5 px-1 justify-center text-[10px] sm:text-[11px] min-w-0"
                      title={language === 'fr' ? 'Aperçu & Téléchargements' : 'Preview & Download'}
                    >
                      <QrCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate hidden sm:inline">{t.qrCode}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(loc)}
                      className="btn-outline-gold py-1.5 px-1 justify-center text-[10px] sm:text-[11px] min-w-0"
                      title={t.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5 shrink-0 text-[#9A721C]" />
                      <span className="truncate hidden sm:inline">{t.edit}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRotateConfirmLocation(loc)}
                      className="btn-outline-gold py-1.5 px-1 justify-center text-[10px] sm:text-[11px] min-w-0"
                      title={t.rotateCode}
                    >
                      <RotateCw className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate hidden sm:inline">{t.rotateCode}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmLocation(loc)}
                      className="py-1.5 px-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 font-medium inline-flex items-center justify-center gap-1 transition-colors min-w-0 text-[10px] sm:text-[11px]"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate hidden sm:inline">{t.delete}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT LOCATION */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-hotel-border">
              <h3 className="font-serif text-lg font-bold text-hotel-text">
                {editingLocation ? t.editLocation : t.addLocation}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.locationType}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(editingLocation)}
                    onClick={() => setFormType('table')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      formType === 'table'
                        ? 'border-[#9A721C] bg-[#FAF6EE] text-[#8A6214] shadow-2xs'
                        : 'border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>{t.locationTable}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(editingLocation)}
                    onClick={() => setFormType('room')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      formType === 'room'
                        ? 'border-[#9A721C] bg-[#FAF6EE] text-[#8A6214] shadow-2xs'
                        : 'border-hotel-border text-hotel-secondary hover:text-hotel-text'
                    }`}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    <span>{t.locationRoom}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.locationLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder={
                    formType === 'table' ? 'Ex: Table 1, Table Terrasse 4' : 'Ex: Chambre 104, Suite 2'
                  }
                  className="input-hotel"
                  autoFocus
                />
                <p className="text-[11px] text-hotel-muted mt-1">
                  {language === 'fr'
                    ? 'Ce libellé sera affiché sur le QR code et automatiquement associé aux commandes des clients.'
                    : 'This label will be shown on the QR code and automatically associated with customer orders.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-outline-gold py-2 px-3.5 text-xs"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold py-2 px-4 text-xs font-semibold"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : editingLocation ? (
                    t.save
                  ) : (
                    t.add
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SINGLE QR CODE PREVIEW & EXPORT */}
      {previewLocation && (
        <LocationQrPreviewModal
          location={previewLocation}
          baseUrl={effectiveBaseUrl}
          isUrlConfigured={isUrlConfigured}
          onClose={() => setPreviewLocation(null)}
          onDownloadPng={() => handleDownloadSinglePng(previewLocation)}
          onDownloadSvg={() => handleDownloadSingleSvg(previewLocation)}
          onPrintSingle={() => {
            setPrintTargets([previewLocation]);
            setPreviewLocation(null);
            setIsPrintSheetOpen(true);
          }}
        />
      )}

      {/* MODAL 3: A4 PRINTABLE SHEET VIEW (PLANCHE A4) */}
      {isPrintSheetOpen && (
        <PrintableA4SheetModal
          locations={printTargets}
          baseUrl={effectiveBaseUrl}
          isUrlConfigured={isUrlConfigured}
          onClose={() => setIsPrintSheetOpen(false)}
        />
      )}

      {/* CONFIRMATION: ROTATE QR TOKEN */}
      <ConfirmationModal
        isOpen={Boolean(rotateConfirmLocation)}
        onClose={() => setRotateConfirmLocation(null)}
        onConfirm={handleRotateConfirm}
        title={t.rotateCode}
        message={
          rotateConfirmLocation
            ? `${t.rotateCodeConfirm} (${rotateConfirmLocation.label})`
            : ''
        }
        confirmLabel={t.rotateCode}
        cancelLabel={t.cancel}
        variant="warning"
      />

      {/* CONFIRMATION: DELETE LOCATION */}
      <ConfirmationModal
        isOpen={Boolean(deleteConfirmLocation)}
        onClose={() => setDeleteConfirmLocation(null)}
        onConfirm={handleDeleteConfirm}
        title={language === 'fr' ? 'Supprimer cet emplacement ?' : 'Delete this location?'}
        message={
          deleteConfirmLocation
            ? language === 'fr'
              ? `Voulez-vous vraiment supprimer « ${deleteConfirmLocation.label} » ? S’il possède des commandes historiques, il sera simplement désactivé.`
              : `Are you sure you want to delete "${deleteConfirmLocation.label}"? If it has historical orders, it will be deactivated instead.`
            : ''
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        variant="danger"
      />
    </div>
  );
};

// ============================================================================
// COMPONENT: SINGLE LOCATION QR PREVIEW MODAL
// ============================================================================
interface LocationQrPreviewModalProps {
  location: ServiceLocation;
  baseUrl: string;
  isUrlConfigured: boolean;
  onClose: () => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
  onPrintSingle: () => void;
}

const LocationQrPreviewModal: React.FC<LocationQrPreviewModalProps> = ({
  location,
  baseUrl,
  isUrlConfigured,
  onClose,
  onDownloadPng,
  onDownloadSvg,
  onPrintSingle,
}) => {
  const { language, t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const scanUrl = buildLocationScanUrl(baseUrl, location.code);

  useEffect(() => {
    generateQrDataUrl(scanUrl, { width: 500, margin: 2 }).then(setQrDataUrl);
  }, [scanUrl]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-elevated p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-hotel-border">
          <div>
            <h3 className="font-serif text-lg font-bold text-hotel-text">
              {location.label}
            </h3>
            <span className="text-[11px] text-[#9A721C] font-semibold uppercase tracking-wider">
              {location.location_type === 'room' ? t.locationRoom : t.locationTable}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isUrlConfigured && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p>
              {language === 'fr'
                ? 'Attention : L’URL publique officielle n’est pas configurée. Ce QR pointe vers votre adresse locale de test.'
                : 'Warning: Official public URL is not set. This QR points to your local address.'}
            </p>
          </div>
        )}

        {/* QR Code Presentation Plate */}
        <div className="p-6 rounded-2xl border border-hotel-border bg-[#FAF8F5] text-center space-y-3">
          <div className="inline-block p-4 rounded-xl bg-white shadow-card border border-stone-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={location.label}
                className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
              />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-hotel-muted">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-serif font-bold text-hotel-text tracking-wide">
              Convivium Home Hotel
            </p>
            <p className="text-[11px] text-hotel-secondary mt-0.5 font-medium">
              {t.qrCodeScanInstruction}
            </p>
            <p className="text-[10px] text-hotel-muted font-mono truncate max-w-xs mx-auto mt-2">
              {scanUrl}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onDownloadPng}
            className="btn-outline-gold py-2 px-2 text-xs font-semibold justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={onDownloadSvg}
            className="btn-outline-gold py-2 px-2 text-xs font-semibold justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>

          <button
            type="button"
            onClick={onPrintSingle}
            className="btn-gold py-2 px-2 text-xs font-semibold justify-center"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printSingle}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: A4 PRINTABLE SHEET MODAL (PLANCHE D'IMPRESSION A4)
// ============================================================================
interface PrintableA4SheetModalProps {
  locations: ServiceLocation[];
  baseUrl: string;
  isUrlConfigured: boolean;
  onClose: () => void;
}

const PrintableA4SheetModal: React.FC<PrintableA4SheetModalProps> = ({
  locations,
  baseUrl,
  isUrlConfigured,
  onClose,
}) => {
  const { language, t } = useLanguage();
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    let mounted = true;
    const generateAll = async () => {
      setIsGenerating(true);
      const results: Record<string, string> = {};
      for (const loc of locations) {
        const url = buildLocationScanUrl(baseUrl, loc.code);
        const dataUrl = await generateQrDataUrl(url, { width: 400, margin: 1 });
        results[loc.id] = dataUrl;
      }
      if (mounted) {
        setQrMap(results);
        setIsGenerating(false);
      }
    };
    generateAll();
    return () => {
      mounted = false;
    };
  }, [locations, baseUrl]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 p-2 sm:p-4 flex flex-col items-center">
      {/* Non-printed Floating Controls */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-elevated p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h3 className="font-serif text-lg font-bold text-hotel-text">
            {language === 'fr' ? 'Planche d’étiquettes A4 prête à imprimer' : 'Printable A4 Labels Sheet'}
          </h3>
          <p className="text-xs text-hotel-secondary mt-0.5">
            {locations.length}{' '}
            {language === 'fr'
              ? 'emplacement(s) organisés en étiquettes de service de haute précision.'
              : 'location(s) laid out as high-precision service labels.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial btn-outline-gold py-2 px-3 text-xs"
          >
            {t.close}
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handlePrint}
            className="flex-1 sm:flex-initial btn-gold py-2 px-4 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>{language === 'fr' ? 'Lancer l’impression A4' : 'Print A4 Sheet'}</span>
          </button>
        </div>
      </div>

      {!isUrlConfigured && (
        <div className="w-full max-w-4xl p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs mb-4 print:hidden flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>{t.productionUrlMissing} :</strong>{' '}
            {t.productionUrlNotice}
          </div>
        </div>
      )}

      {/* Printable Sheet Canvas: 2 Columns Grid for A4 layout */}
      <div className="w-full max-w-4xl bg-white p-6 sm:p-10 shadow-elevated print:shadow-none print:p-0 print:m-0 rounded-2xl print:rounded-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          {locations.map((loc) => {
            const dataUrl = qrMap[loc.id];
            const isRoom = loc.location_type === 'room';

            return (
              <div
                key={loc.id}
                className="border-2 border-dashed border-stone-300 p-5 rounded-2xl flex flex-col items-center justify-between text-center bg-white break-inside-avoid print:break-inside-avoid"
              >
                {/* Official Branding Header */}
                <div className="w-full pb-3 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src="/logo.jpg"
                      alt="Convivium"
                      className="w-7 h-7 rounded-full object-cover border border-stone-300"
                    />
                    <span className="font-serif text-xs font-bold text-stone-900">
                      Convivium Home Hotel
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A721C] px-2 py-0.5 rounded bg-[#FAF6EE] border border-[#E5D099]">
                    {isRoom ? 'Chambre' : 'Table'}
                  </span>
                </div>

                {/* Canonical Spot Name */}
                <div className="my-3">
                  <h4 className="font-serif text-xl sm:text-2xl font-bold text-stone-950">
                    {loc.label}
                  </h4>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {isRoom
                      ? 'Service en chambre • Room Service'
                      : 'Commande sur place • Dine-in'}
                  </p>
                </div>

                {/* High Contrast QR Code with Quiet Zone */}
                <div className="p-3 bg-white border border-stone-300 rounded-xl shadow-2xs">
                  {dataUrl ? (
                    <img
                      src={dataUrl}
                      alt={loc.label}
                      className="w-40 h-40 sm:w-44 sm:h-44 object-contain"
                    />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                    </div>
                  )}
                </div>

                {/* Scan Instruction Footer */}
                <div className="mt-3 pt-2.5 border-t border-stone-200 w-full text-center">
                  <p className="text-[11px] font-semibold text-stone-900">
                    Scannez pour consulter le menu
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Scan to view the menu
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
