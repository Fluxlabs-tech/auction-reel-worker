export const assFade = (fadeInMs: number, fadeOutMs: number = 0): string => {
  return `\\fad(${fadeInMs},${fadeOutMs})`;
};

export const assMove = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t1Ms?: number,
  t2Ms?: number,
): string => {
  if (t1Ms !== undefined && t2Ms !== undefined) {
    return `\\move(${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)},${t1Ms},${t2Ms})`;
  }
  return `\\move(${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)})`;
};

export const assPop = (
  fromScale: number,
  toScale: number,
  t1Ms: number = 0,
  t2Ms: number = 200,
): string => {
  return `\\fscx${fromScale}\\fscy${fromScale}\\t(${t1Ms},${t2Ms},\\fscx${toScale}\\fscy${toScale})`;
};

export const assWobble = (): string => {
  return `\\frz-4\\t(0,100,\\frz4)\\t(100,200,\\frz-2)\\t(200,300,\\frz2)\\t(300,400,\\frz0)`;
};
