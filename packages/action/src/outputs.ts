export const OUTPUT_VALUE_MAX_LENGTH = 1024;

const NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function isValidValue(value: string): boolean {
  if (value.length > OUTPUT_VALUE_MAX_LENGTH) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return true;
}

export function formatOutputs(outputs: Readonly<Record<string, string>>): string | null {
  let result = '';
  for (const [name, value] of Object.entries(outputs)) {
    if (!NAME_PATTERN.test(name) || !isValidValue(value)) return null;
    result += `${name}=${value}\n`;
  }
  return result;
}

export function maskCommands(secret: string): string {
  let result = '';
  for (const line of secret.split(/\r?\n/)) {
    if (line.length > 0) result += `::add-mask::${line}\n`;
  }
  return result;
}

export function boundedSummaryText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const suffix = '- Summary truncated.\n';
  const limit = maxLength - suffix.length;
  let cut = -1;
  for (let i = 0; i < text.length && i < limit; i++) {
    if (text[i] === '\n') cut = i;
  }
  const prefix = cut >= 0 ? text.slice(0, cut + 1) : '';
  return prefix + suffix;
}
