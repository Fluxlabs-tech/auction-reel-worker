import path from 'path';
import fs from 'fs';
import { ReelTimeline } from '../../interfaces/timeline.interface';
import { ReelThemeVersion } from '../../interfaces/theme.interface';

export interface FilterGraphResult {
  inputs: string[];
  graph: string;
}

export const buildFilterGraphService = (
  tl: ReelTimeline,
  theme: ReelThemeVersion,
  hudAssPath: string,
  captionsAssPath: string,
): FilterGraphResult => {
  let inputs: string[] = [];
  let filterNodes: string[] = [];
  let currentStream: string = '0:v';
  let inputIndex: number = 1;
  let fontsDirArg: string = '';
  let themeBasePath: string = '';
  let fontsDir: string = '';
  let fallbackFontsDir: string = '';
  let nodeCount: number = 0;
  let cueConfig: any;
  let iconRelPath: string;
  let iconFullPath: string;
  let nextStream: string;
  let x: number;
  let y: number;
  let confettiRelPath: string;
  let confettiFullPath: string;
  let impactTime: number;
  let confettiDuration: number;
  let cfStream: string;

  try {
    themeBasePath = theme.basePath || '';
    fontsDir = path.join(themeBasePath, 'fonts');
    if (!fs.existsSync(fontsDir)) {
      fallbackFontsDir = path.resolve(process.cwd(), 'fonts');
      if (fs.existsSync(fallbackFontsDir)) {
        fontsDir = fallbackFontsDir;
      }
    }
    fontsDirArg = fs.existsSync(fontsDir) ? `:fontsdir='${fontsDir}'` : '';

    // 1. Layer HUD ASS subtitle onto base video
    filterNodes.push(`[${currentStream}]ass='${hudAssPath}'${fontsDirArg}[a0]`);
    currentStream = 'a0';

    // 2. Overlay theme PNG icons for cues if assets exist locally
    nodeCount = 0;
    for (const cue of tl.cues || []) {
      cueConfig = theme.cue_texts[cue.id];
      if (cueConfig && cueConfig.icon && theme.assets?.icons?.[cueConfig.icon]) {
        iconRelPath = theme.assets.icons[cueConfig.icon];
        iconFullPath = path.join(themeBasePath, iconRelPath);

        if (fs.existsSync(iconFullPath)) {
          inputs.push('-loop', '1', '-i', iconFullPath);
          nextStream = `a${nodeCount + 1}`;
          x = 32;
          y = 300;
          filterNodes.push(
            `[${currentStream}][${inputIndex}:v]overlay=x=${x}:y=${y}:enable='between(t,${cue.t0},${cue.t1})'[${nextStream}]`,
          );
          currentStream = nextStream;
          nodeCount++;
          inputIndex++;
        }
      }
    }

    // 3. Alpha video animation overlay (Confetti on SOLD finale)
    if (tl.result.kind === 'sold' && theme.assets?.anim?.confetti) {
      confettiRelPath = theme.assets.anim.confetti;
      confettiFullPath = path.join(themeBasePath, confettiRelPath);

      if (fs.existsSync(confettiFullPath)) {
        inputs.push('-c:v', 'libvpx-vp9', '-i', confettiFullPath);
        impactTime = tl.result.t;
        confettiDuration = 6.0;
        cfStream = 'cf';
        filterNodes.push(`[${inputIndex}:v]setpts=PTS-STARTPTS+${impactTime}/TB[${cfStream}]`);

        nextStream = `a${nodeCount + 1}`;
        filterNodes.push(
          `[${currentStream}][${cfStream}]overlay=0:0:eof_action=pass:enable='between(t,${impactTime},${impactTime + confettiDuration})'[${nextStream}]`,
        );
        currentStream = nextStream;
        nodeCount++;
        inputIndex++;
      }
    }

    // 4. Burn karaoke captions on top
    filterNodes.push(`[${currentStream}]ass='${captionsAssPath}'${fontsDirArg}[vout]`);

    return {
      inputs,
      graph: filterNodes.join(';'),
    };
  } catch (error: any) {
    console.error(
      '[buildFilterGraphService] Error constructing filter complex graph:',
      error?.message || error,
    );
    throw error;
  }
};
