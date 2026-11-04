// Splits a theme template such as 'FOR {amount}' around one placeholder so the substituted value
// can be styled differently from the surrounding copy. Missing placeholder => value is empty.
export const splitTemplate = (
  template: string,
  placeholder: string,
  value: string,
): { before: string; value: string; after: string } => {
  let token: string;
  let idx: number;

  try {
    token = `{${placeholder}}`;
    idx = template.indexOf(token);
    if (idx < 0) {
      return { before: template, value: '', after: '' };
    }
    return {
      before: template.slice(0, idx),
      value,
      after: template.slice(idx + token.length),
    };
  } catch (error: any) {
    console.error('[splitTemplate] Error:', error?.response?.data || error?.message || error);
    return { before: template || '', value: '', after: '' };
  }
};
