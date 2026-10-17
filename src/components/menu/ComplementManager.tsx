import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, CheckCircle2, XCircle, Loader2, Utensils, AlertCircle } from 'lucide-react';
import type { MenuCategory, MenuComplement } from '../../types';
import { menuService } from '../../services/menu.service';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatXAF } from '../../lib/formatters';
import { ConfirmationModal } from '../common/ConfirmationModal';

interface ComplementManagerProps {
  categories: MenuCategory[];
  onRefresh?: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const ComplementManager: React.FC<ComplementManagerProps> = ({
  categories,
  onRefresh,
  showToast,
}) => {
  const { language, t } = useLanguage();

  const [complements, setComplements] = useState<MenuComplement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingComp, setEditingComp] = useState<MenuComplement | null>(null);
  const [compToDelete, setCompToDelete] = useState<MenuComplement | null>(null);

  // Form State
  const [nameFr, setNameFr] = useState<string>('');
  const [nameEn, setNameEn] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [isAllCategories, setIsAllCategories] = useState<boolean>(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadComplements = async () => {
    try {
      setIsLoading(true);
      const data = await menuService.getAllComplements();
      setComplements(data);
    } catch (e) {
      console.error('Error loading complements', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplements();
  }, []);

  // Category name map
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => {
      map[c.id] = language === 'en' && c.name_en ? c.name_en : c.name_fr;
    });
    return map;
  }, [categories, language]);

  // Root and subcategories structure for checkboxes
  const { rootCategories, subcategoriesByParent } = useMemo(() => {
    const roots = categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const subs: Record<string, MenuCategory[]> = {};
    categories.filter((c) => !!c.parent_id).forEach((s) => {
      if (!subs[s.parent_id!]) subs[s.parent_id!] = [];
      subs[s.parent_id!].push(s);
    });
    return { rootCategories: roots, subcategoriesByParent: subs };
  }, [categories]);

  const handleOpenAdd = () => {
    setEditingComp(null);
    setNameFr('');
    setNameEn('');
    setPrice(0);
    setIsAllCategories(true);
    setSelectedCategoryIds([]);
    setSortOrder(complements.length);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: MenuComplement) => {
    setEditingComp(comp);
    setNameFr(comp.name_fr);
    setNameEn(comp.name_en || '');
    setPrice(comp.price);
    setIsAllCategories(comp.is_all_categories);
    setSelectedCategoryIds(comp.category_ids || []);
    setSortOrder(comp.sort_order ?? 0);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nameFr.trim()) {
      setFormError(language === 'fr' ? 'Le nom du complément est obligatoire.' : 'Complement name is required.');
      return;
    }

    if (price < 0) {
      setFormError(language === 'fr' ? 'Le prix ne peut pas être négatif.' : 'Price cannot be negative.');
      return;
    }

    if (!isAllCategories && selectedCategoryIds.length === 0) {
      setFormError(
        language === 'fr'
          ? 'Veuillez sélectionner au moins une catégorie ou choisir "Toutes les catégories".'
          : 'Please select at least one category or choose "All categories".'
      );
      return;
    }

    try {
      setIsSaving(true);
      if (editingComp) {
        await menuService.updateComplement(editingComp.id, {
          name_fr: nameFr.trim(),
          name_en: nameEn.trim() || undefined,
          price: Math.max(0, Math.round(Number(price) || 0)),
          is_all_categories: isAllCategories,
          category_ids: isAllCategories ? [] : selectedCategoryIds,
          sort_order: sortOrder,
        });
        showToast(language === 'fr' ? 'Complément mis à jour.' : 'Complement updated.');
      } else {
        await menuService.createComplement({
          name_fr: nameFr.trim(),
          name_en: nameEn.trim() || undefined,
          price: Math.max(0, Math.round(Number(price) || 0)),
          is_all_categories: isAllCategories,
          category_ids: isAllCategories ? [] : selectedCategoryIds,
          sort_order: sortOrder,
        });
        showToast(language === 'fr' ? 'Complément créé avec succès.' : 'Complement created successfully.');
      }

      setIsModalOpen(false);
      await loadComplements();
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (comp: MenuComplement) => {
    try {
      await menuService.toggleComplementActive(comp.id, !comp.is_active);
      await loadComplements();
      if (onRefresh) await onRefresh();
      showToast(
        !comp.is_active
          ? language === 'fr'
            ? 'Complément activé.'
            : 'Complement activated.'
          : language === 'fr'
          ? 'Complément désactivé.'
          : 'Complement deactivated.'
      );
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDelete = async () => {
    if (!compToDelete) return;
    try {
      await menuService.deleteComplement(compToDelete.id);
      showToast(language === 'fr' ? 'Complément supprimé.' : 'Complement deleted.');
      setCompToDelete(null);
      await loadComplements();
      if (onRefresh) await onRefresh();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Impossible de supprimer.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-hotel-border shadow-subtle">
        <div>
          <h3 className="font-serif text-lg font-semibold text-hotel-text">
            {t.complementsManagement}
          </h3>
          <p className="text-xs text-hotel-secondary mt-0.5">
            {language === 'fr'
              ? 'Gérez les sauces, garnitures et accompagnements supplémentaires réutilisables.'
              : 'Manage reusable sauces, garnishes, and side add-ons.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-gold text-xs py-2 px-3.5 font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addComplement}</span>
        </button>
      </div>

      {/* Complements Table */}
      {isLoading ? (
        <div className="py-12 text-center text-hotel-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#9A721C] mb-2" />
          <p className="text-xs">{t.loading}</p>
        </div>
      ) : complements.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-hotel-border p-6">
          <div className="w-12 h-12 rounded-full bg-[#FAF6EE] border border-[#D8C79A]/40 flex items-center justify-center mx-auto mb-2 text-[#9A721C]">
            <Utensils className="w-6 h-6 stroke-[1.5]" />
          </div>
          <p className="text-sm font-semibold text-hotel-text">
            {language === 'fr' ? 'Aucun complément configuré' : 'No complements configured'}
          </p>
          <p className="text-xs text-hotel-secondary mt-1">
            {language === 'fr'
              ? 'Créez des sauces ou accompagnements supplémentaires pour enrichir vos plats.'
              : 'Create additional sauces or sides to enhance your menu items.'}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-4 btn-outline-gold text-xs py-1.5 px-3"
          >
            {t.addComplement}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-hotel-border shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-hotel-subtle/70 text-hotel-secondary font-semibold border-b border-hotel-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{language === 'fr' ? 'Nom' : 'Name'}</th>
                  <th className="py-3 px-4">{language === 'fr' ? 'Prix' : 'Price'}</th>
                  <th className="py-3 px-4">{language === 'fr' ? 'Affectation' : 'Assignment'}</th>
                  <th className="py-3 px-4 text-center">{language === 'fr' ? 'Statut' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hotel-border/60">
                {complements.map((comp) => {
                  const compName = language === 'en' && comp.name_en ? comp.name_en : comp.name_fr;

                  return (
                    <tr key={comp.id} className="hover:bg-hotel-subtle/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-hotel-text">
                        {compName}
                        {comp.name_en && language === 'fr' && (
                          <span className="block text-[11px] font-normal text-hotel-muted">
                            EN: {comp.name_en}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#9A721C]">
                        {comp.price > 0 ? formatXAF(comp.price) : t.free}
                      </td>
                      <td className="py-3 px-4">
                        {comp.is_all_categories ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {t.allCategoriesMode}
                          </span>
                        ) : (comp.category_ids || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(comp.category_ids || []).map((cid) => (
                              <span
                                key={cid}
                                className="px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700 border border-stone-200 truncate max-w-[120px]"
                              >
                                {categoryMap[cid] || cid}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium">
                            {language === 'fr' ? 'Aucune catégorie' : 'No categories'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(comp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                            comp.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {comp.is_active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t.available}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-stone-400" />
                              <span>{t.unavailable}</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(comp)}
                            className="p-1.5 rounded-lg text-hotel-muted hover:text-hotel-text hover:bg-hotel-subtle transition-colors"
                            title={t.edit}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompToDelete(comp)}
                            className="p-1.5 rounded-lg text-hotel-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={t.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT COMPLEMENT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 flex items-center justify-center bg-stone-900/60"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl border border-hotel-border shadow-elevated p-5 sm:p-6 my-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg sm:text-xl font-semibold text-hotel-text pb-3 border-b border-hotel-border">
              {editingComp
                ? language === 'fr'
                  ? 'Modifier le complément'
                  : 'Edit Complement'
                : t.addComplement}
            </h3>

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.complementName} (FR) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  placeholder={language === 'fr' ? 'Ex: Sauce Piment Extra' : 'e.g. Extra Chili Sauce'}
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.complementName} (EN, {t.optional})
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Extra Chili Sauce"
                  className="input-hotel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-hotel-text mb-1.5">
                  {t.complementPrice} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={50}
                  value={price}
                  onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-hotel font-mono"
                />
                <p className="text-[11px] text-hotel-secondary mt-1">
                  {language === 'fr'
                    ? 'Saisissez 0 pour un complément gratuit inclus.'
                    : 'Enter 0 for a free optional add-on.'}
                </p>
              </div>

              {/* Category Assignment Mode */}
              <div className="pt-2 border-t border-hotel-border space-y-2.5">
                <label className="block text-xs font-semibold text-hotel-text">
                  {t.categoryAssignment}
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-hotel-text">
                    <input
                      type="radio"
                      name="assignmentMode"
                      checked={isAllCategories}
                      onChange={() => setIsAllCategories(true)}
                      className="text-[#9A721C] focus:ring-[#9A721C]"
                    />
                    <span>{t.allCategoriesMode} ({language === 'fr' ? 's’applique à toute la carte actuelle et future' : 'applies to all current & future categories'})</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-hotel-text">
                    <input
                      type="radio"
                      name="assignmentMode"
                      checked={!isAllCategories}
                      onChange={() => setIsAllCategories(false)}
                      className="text-[#9A721C] focus:ring-[#9A721C]"
                    />
                    <span>{t.selectedCategoriesMode}</span>
                  </label>
                </div>

                {/* Categories Checkbox Tree */}
                {!isAllCategories && (
                  <div className="mt-2.5 p-3 rounded-xl bg-hotel-subtle/50 border border-hotel-border max-h-48 overflow-y-auto space-y-2">
                    {rootCategories.map((root) => {
                      const rootName = language === 'en' && root.name_en ? root.name_en : root.name_fr;
                      const isRootChecked = selectedCategoryIds.includes(root.id);
                      const subs = subcategoriesByParent[root.id] || [];

                      return (
                        <div key={root.id} className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-hotel-text">
                            <input
                              type="checkbox"
                              checked={isRootChecked}
                              onChange={() => handleToggleCategory(root.id)}
                              className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C]"
                            />
                            <span>{rootName}</span>
                            <span className="text-[10px] text-hotel-muted font-normal">
                              ({language === 'fr' ? 'hérité par sous-catégories' : 'inherited by subcategories'})
                            </span>
                          </label>

                          {subs.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {subs.map((sub) => {
                                const subName = language === 'en' && sub.name_en ? sub.name_en : sub.name_fr;
                                const isSubChecked = selectedCategoryIds.includes(sub.id);

                                return (
                                  <label
                                    key={sub.id}
                                    className="flex items-center gap-2 cursor-pointer text-xs text-hotel-secondary hover:text-hotel-text"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSubChecked || isRootChecked}
                                      disabled={isRootChecked}
                                      onChange={() => handleToggleCategory(sub.id)}
                                      className="rounded border-hotel-borderStrong text-[#9A721C] focus:ring-[#9A721C] disabled:opacity-50"
                                    />
                                    <span>{subName}</span>
                                    {isRootChecked && (
                                      <span className="text-[10px] text-[#9A721C] italic">
                                        ({language === 'fr' ? 'inclus via parent' : 'included via parent'})
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-hotel-border flex gap-2.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="btn-outline-gold flex-1 text-xs py-2.5"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-gold py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={compToDelete !== null}
        title={language === 'fr' ? 'Supprimer le complément ?' : 'Delete complement?'}
        message={
          language === 'fr'
            ? `Êtes-vous sûr de vouloir supprimer définitivement le complément "${compToDelete?.name_fr}" ? Cette action est irréversible.`
            : `Are you sure you want to permanently delete complement "${compToDelete?.name_fr}"? This action cannot be undone.`
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setCompToDelete(null)}
      />
    </div>
  );
};
