import React from 'react';
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

  return (
    <div className="w-full overflow-x-auto py-2 no-scrollbar">
      <div className="flex items-center gap-2 min-w-max">
        {/* All Categories Button */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
            selectedCategoryId === null
              ? 'bg-hotel-gold text-hotel-black shadow-gold-glow font-semibold'
              : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text hover:border-hotel-gold/40'
          }`}
        >
          {t.allCategories}
        </button>

        {/* Dynamic Categories */}
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          const count = categoryItemCounts[category.id] ?? 0;
          const name = language === 'en' && category.name_en ? category.name_en : category.name_fr;

          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-hotel-gold text-hotel-black shadow-gold-glow font-semibold'
                  : 'bg-hotel-surface border border-hotel-cardBorder text-hotel-muted hover:text-hotel-text hover:border-hotel-gold/40'
              }`}
            >
              <span>{name}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected
                      ? 'bg-hotel-black/20 text-hotel-black'
                      : 'bg-hotel-card border border-hotel-cardBorder text-hotel-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
