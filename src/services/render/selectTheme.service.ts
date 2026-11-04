import { ThemePin } from '../../interfaces/job.interface';
import { ReelThemeModel } from '../../models/reelTheme.model';

export const selectThemeService = async (
  storeId?: string | number,
  category?: string,
): Promise<ThemePin> => {
  let activeThemes: Array<{ id: string; doc: any }>;
  let matchingStore: any;
  let matchingCategory: any;
  let weightedThemes: any[];
  let totalWeight: number;
  let rand: number;
  let cumulative: number;

  try {
    activeThemes = await ReelThemeModel.getActiveThemes();

    if (activeThemes.length === 0) {
      return { id: 'default', version: 1 };
    }

    // 1. Check store_ids match
    if (storeId) {
      matchingStore = activeThemes.find((t) =>
        (t.doc.applies_to?.store_ids || []).map(String).includes(String(storeId)),
      );
      if (matchingStore) {
        return {
          id: matchingStore.id,
          version: matchingStore.doc.current_version || 1,
        };
      }
    }

    // 2. Check category match
    if (category) {
      matchingCategory = activeThemes.find((t) =>
        (t.doc.applies_to?.categories || []).includes(category),
      );
      if (matchingCategory) {
        return {
          id: matchingCategory.id,
          version: matchingCategory.doc.current_version || 1,
        };
      }
    }

    // 3. Weighted random selection among themes with weight > 0
    weightedThemes = activeThemes.filter((t) => (t.doc.weight || 0) > 0);
    if (weightedThemes.length > 0) {
      totalWeight = weightedThemes.reduce((sum, t) => sum + t.doc.weight, 0);
      rand = Math.random() * totalWeight;
      cumulative = 0;

      for (const t of weightedThemes) {
        cumulative += t.doc.weight;
        if (rand <= cumulative) {
          return {
            id: t.id,
            version: t.doc.current_version || 1,
          };
        }
      }
    }

    return { id: 'default', version: 1 };
  } catch (error: any) {
    console.error('[selectThemeService] Error selecting theme:', error?.message || error, {
      storeId,
      category,
    });
    return { id: 'default', version: 1 };
  }
};
