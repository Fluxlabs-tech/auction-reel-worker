import fs from 'fs';
import path from 'path';
import { ThemePin } from '../../interfaces/job.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';
import { ReelThemeModel } from '../../models/reelTheme.model';
import { DEFAULT_THEME_VERSION } from '../../config/defaults';
import { env } from '../../config/env';

export const loadThemeService = async (
  pin: ThemePin,
): Promise<{ theme: ReelThemeVersion; fallback: boolean }> => {
  let themeVersion: ReelThemeVersion | null;
  let targetDir: string;

  try {
    targetDir = path.join(env.THEME_CACHE_DIR, `${pin.id}@${pin.version}`);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    themeVersion = await ReelThemeModel.getThemeVersion(pin.id, pin.version);

    if (!themeVersion) {
      console.warn(
        `[loadThemeService] Theme ${pin.id}@${pin.version} not found. Falling back to default.`,
      );
      return {
        theme: {
          ...DEFAULT_THEME_VERSION,
          basePath: targetDir,
        },
        fallback: true,
      };
    }

    return {
      theme: {
        ...themeVersion,
        basePath: targetDir,
      },
      fallback: false,
    };
  } catch (error: any) {
    console.error('[loadThemeService] Error loading theme:', error?.message || error, { pin });
    return {
      theme: {
        ...DEFAULT_THEME_VERSION,
        basePath: path.join(env.THEME_CACHE_DIR, 'default@1'),
      },
      fallback: true,
    };
  }
};
