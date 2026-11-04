// libass sizes a face so that (usWinAscent + usWinDescent) equals the \fs value, not the em box.
// Poppins spans 1135 + 627 = 1762 units per 1000-unit em, so a design font size in em-px
// (what CSS / Figma call font-size) must be scaled by 1.762 to get the matching \fs value.
// Without this, every label renders at ~57% of its intended size.
export const POPPINS_FS_PER_EM = 1.762;

export const assFontSize = (emPx: number): number => {
  let fs: number;

  try {
    fs = Math.round(emPx * POPPINS_FS_PER_EM);
    return fs;
  } catch (error: any) {
    console.error('[assFontSize] Error:', error?.response?.data || error?.message || error);
    return Math.round(emPx);
  }
};
