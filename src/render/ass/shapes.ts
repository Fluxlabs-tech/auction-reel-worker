export const buildRoundedRectPath = (
  w: number,
  h: number,
  r: number,
  x: number = 0,
  y: number = 0,
): string => {
  const radius = Math.min(r, w / 2, h / 2);
  const k = 0.5522847498 * radius; // bezier approximation for quarter circle

  const x0 = x;
  const x1 = x + radius;
  const x2 = x + w - radius;
  const x3 = x + w;

  const y0 = y;
  const y1 = y + radius;
  const y2 = y + h - radius;
  const y3 = y + h;

  // Path starting from top edge
  return [
    `m ${Math.round(x1)} ${Math.round(y0)}`,
    `l ${Math.round(x2)} ${Math.round(y0)}`,
    `b ${Math.round(x2 + k)} ${Math.round(y0)} ${Math.round(x3)} ${Math.round(y1 - k)} ${Math.round(x3)} ${Math.round(y1)}`,
    `l ${Math.round(x3)} ${Math.round(y2)}`,
    `b ${Math.round(x3)} ${Math.round(y2 + k)} ${Math.round(x2 + k)} ${Math.round(y3)} ${Math.round(x2)} ${Math.round(y3)}`,
    `l ${Math.round(x1)} ${Math.round(y3)}`,
    `b ${Math.round(x1 - k)} ${Math.round(y3)} ${Math.round(x0)} ${Math.round(y2 + k)} ${Math.round(x0)} ${Math.round(y2)}`,
    `l ${Math.round(x0)} ${Math.round(y1)}`,
    `b ${Math.round(x0)} ${Math.round(y1 - k)} ${Math.round(x1 - k)} ${Math.round(y0)} ${Math.round(x1)} ${Math.round(y0)}`,
  ].join(' ');
};

export const buildCirclePath = (cx: number, cy: number, r: number): string => {
  return buildRoundedRectPath(r * 2, r * 2, r, cx - r, cy - r);
};

export const buildArcPath = (
  cx: number,
  cy: number,
  radius: number,
  startAngleRad: number,
  endAngleRad: number,
  strokeWidth: number = 8,
): string => {
  // Approximate arc using line segments
  const steps = Math.max(6, Math.ceil(Math.abs(endAngleRad - startAngleRad) * 12));
  const innerR = radius - strokeWidth / 2;
  const outerR = radius + strokeWidth / 2;

  const outerPoints: Array<[number, number]> = [];
  const innerPoints: Array<[number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const angle = startAngleRad + (i / steps) * (endAngleRad - startAngleRad);
    outerPoints.push([
      Math.round(cx + Math.cos(angle) * outerR),
      Math.round(cy + Math.sin(angle) * outerR),
    ]);
    innerPoints.push([
      Math.round(cx + Math.cos(angle) * innerR),
      Math.round(cy + Math.sin(angle) * innerR),
    ]);
  }

  const pathParts: string[] = [];
  pathParts.push(`m ${outerPoints[0][0]} ${outerPoints[0][1]}`);
  for (let i = 1; i < outerPoints.length; i++) {
    pathParts.push(`l ${outerPoints[i][0]} ${outerPoints[i][1]}`);
  }
  for (let i = innerPoints.length - 1; i >= 0; i--) {
    pathParts.push(`l ${innerPoints[i][0]} ${innerPoints[i][1]}`);
  }

  return pathParts.join(' ');
};
