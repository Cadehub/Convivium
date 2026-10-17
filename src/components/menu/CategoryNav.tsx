import React, { useMemo } from 'react';
import type { MenuCategory } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface CategoryNavProps {
  categories: MenuCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  categoryItemCounts?: Record<string, number>;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryItemCounts = {},
}) => {
  const { language, t } = useLanguage();

  // Root categories: no parent
  const rootCategories = useMemo(() => {
    return categories
      .filter((c) => !c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categories]);

  // Subcategories map by parent_id
  const subcategoriesByParent = useMemo(() => {
    const map: Record<string, MenuCategory[]> = {};
    categories
      .filter((c) => !!c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((sub) => {
        if (!map[sub.parent_id!]) map[sub.parent_id!] = [];
        map[sub.parent_id!].push(sub);
      });
    return map;
  }, [categories]);

  // Active root category
  const activeRootCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    const directRoot = rootCategories.find((c) => c.id === selectedCategoryId);
    if (directRoot) return directRoot;
    const currentSub = categories.find((c) => c.id === selectedCategoryId);
    if (currentSub?.parent_id) {
      return rootCategories.find((c) => c.id === currentSub.parent_id) || null;
    }
    return null;
  }, [selectedCategoryId, rootCategories, categories]);

  // Subcategories for current active root
  const currentSubcategories = useMemo(() => {
    if (!activeRootCategory) return [];
    return subcategoriesByParent[activeRootCategory.id] || [];
  }, [activeRootCategory, subcategoriesByParent]);

  // Aggregated count for each root category (direct items + items in subcategories)
  const rootCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rootCategories.forEach((root) => {
      let sum = categoryItemCounts[root.id] || 0;
      const subs = subcategoriesByParent[root.id] || [];
      subs.forEach((sub) => {
        sum += categoryItemCounts[sub.id] || 0;
      });
      counts[root.id] = sum;
    });
    return counts;
  }, [rootCategories, subcategoriesByParent, categoryItemCounts]);

  const totalCount = useMemo(() => {
    return Object.values(categoryItemCounts).reduce((sum, n) => sum + n, 0);
  }, [categoryItemCounts]);

  return (
    <div className="py-2.5 space-y-2">
      {/* 1. Primary Root Categories Row */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label={language === 'fr' ? 'Catégories principales' : 'Main categories'}
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategoryId === null}
          onClick={() => onSelectCategory(null)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            selectedCategoryId === null
              ? 'bg-hotel-dark text-white shadow-subtle'
              : 'bg-white text-hotel-secondary border border-hotel-border hover:border-hotel-borderStrong hover:text-hotel-text'
          }`}
        >
          <span>{t.allCategories}</span>
          {typeof totalCount === 'number' && totalCount > 0 && (
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                selectedCategoryId === null
                  ? 'bg-white/20 text-white'
                  : 'bg-hotel-subtle text-hotel-muted'
              }`}
            >
              {totalCount}
            </span>
          )}
        </button>

        {rootCategories.map((cat) => {
          const name = language === 'en' && cat.name_en ? cat.name_en : cat.name_fr;
          const isSelected = activeRootCategory?.id === cat.id;
          const count = rootCategoryCounts[cat.id];

          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                isSelected
                  ? 'bg-hotel-dark text-white shadow-subtle'
                  : 'bg-white text-hotel-secondary border border-hotel-border hover:border-hotel-borderStrong hover:text-hotel-text'
              }`}
            >
              <span>{name}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-hotel-subtle text-hotel-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Secondary Subcategories Row (Displayed when active root has subcategories) */}
      {currentSubcategories.length > 0 && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-hotel-border/50"
          role="tablist"
          aria-label={language === 'fr' ? 'Sous-catégories' : 'Subcategories'}
        >
          {/* Option: View all in this root category */}
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategoryId === activeRootCategory?.id}
            onClick={() => onSelectCategory(activeRootCategory?.id || null)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedCategoryId === activeRootCategory?.id
                ? 'bg-[#9A721C] text-white shadow-xs'
                : 'bg-hotel-subtle/80 text-hotel-secondary hover:bg-hotel-subtle hover:text-hotel-text border border-hotel-border/60'
            }`}
          >
            <span>{t.allSubcategories}</span>
            {rootCategoryCounts[activeRootCategory?.id || ''] > 0 && (
              <span className="text-[10px] opacity-80">
                ({rootCategoryCounts[activeRootCategory?.id || '']})
              </span>
            )}
          </button>

          {/* Individual subcategory pills */}
          {currentSubcategories.map((sub) => {
            const subName = language === 'en' && sub.name_en ? sub.name_en : sub.name_fr;
            const isSubSelected = selectedCategoryId === sub.id;
            const subCount = categoryItemCounts[sub.id] || 0;

            return (
              <button
                key={sub.id}
                type="button"
                role="tab"
                aria-selected={isSubSelected}
                onClick={() => onSelectCategory(sub.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isSubSelected
                    ? 'bg-[#9A721C] text-white shadow-xs'
                    : 'bg-white text-hotel-secondary hover:text-hotel-text border border-hotel-border hover:border-hotel-borderStrong'
                }`}
              >
                <span>{subName}</span>
                {subCount > 0 && (
                  <span className="text-[10px] opacity-75">
                    ({subCount})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
