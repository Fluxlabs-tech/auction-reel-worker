// \an4/\an5/\an6 centre the libass line box (winAscent..winDescent). For Poppins that box centre sits
// ~0.1em below the visual centre of capitals and digits, so text drifts upward inside pills.
// Returns the \pos y that puts the cap-height centre of the text on `cy`.
export const assTextCenterY = (cy: number, emPx: number): number => {
  let y: number;

  try {
    y = Math.round(cy + emPx * 0.1);
    return y;
  } catch (error: any) {
    console.error('[assTextCenterY] Error:', error?.response?.data || error?.message || error);
    return Math.round(cy);
  }
};
