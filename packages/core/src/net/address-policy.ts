export const BLOCKED_IPV4_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
] as const;

export const BLOCKED_IPV6_RANGES = ['::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8'] as const;

function parseIpv4(address: string): number | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  let value = 0;
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return undefined;
    if (part.length > 1 && part[0] === '0') return undefined;
    const octet = Number(part);
    if (octet > 255) return undefined;
    value = ((value << 8) | octet) >>> 0;
  }
  return value;
}

function parseIpv4Prefix(cidr: string): { network: number; mask: number } {
  const parts = cidr.split('/');
  const base = parts[0];
  const prefixStr = parts[1];
  if (base === undefined || prefixStr === undefined) throw new Error('invalid range');
  const value = parseIpv4(base);
  const prefix = Number(prefixStr);
  if (value === undefined) throw new Error('invalid range');
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (value & mask) >>> 0, mask };
}

const IPV4_RANGE_TABLE = BLOCKED_IPV4_RANGES.map(parseIpv4Prefix);

function isPublicIpv4Value(value: number): boolean {
  for (const range of IPV4_RANGE_TABLE) {
    if ((value & range.mask) >>> 0 === range.network) return false;
  }
  return true;
}

function isPublicIpv4(address: string): boolean {
  const value = parseIpv4(address);
  if (value === undefined) return false;
  return isPublicIpv4Value(value);
}

function expandIpv6Groups(address: string): string[] | undefined {
  if (address.includes('%') || address.includes('[') || address.includes(']')) return undefined;
  if (address.trim() !== address) return undefined;
  if (address.length === 0) return undefined;

  let head = address;
  let tail = '';
  let hasDoubleColon = false;

  const doubleColonIndex = address.indexOf('::');
  if (doubleColonIndex !== -1) {
    if (address.indexOf('::', doubleColonIndex + 1) !== -1) return undefined;
    hasDoubleColon = true;
    head = address.slice(0, doubleColonIndex);
    tail = address.slice(doubleColonIndex + 2);
  }

  const headParts = head.length === 0 ? [] : head.split(':');
  const tailParts = tail.length === 0 ? [] : tail.split(':');

  // handle a possible IPv4 tail in the last part
  function expandLastIpv4(parts: string[]): string[] | undefined {
    if (parts.length === 0) return parts;
    const last = parts[parts.length - 1];
    if (last !== undefined && last.includes('.')) {
      const value = parseIpv4(last);
      if (value === undefined) return undefined;
      const high = (value >>> 16) & 0xffff;
      const low = value & 0xffff;
      return [...parts.slice(0, -1), high.toString(16), low.toString(16)];
    }
    return parts;
  }

  const expandedHead = expandLastIpv4(headParts);
  const expandedTail = expandLastIpv4(tailParts);
  if (expandedHead === undefined || expandedTail === undefined) return undefined;

  for (const p of [...expandedHead, ...expandedTail]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(p)) return undefined;
  }

  if (!hasDoubleColon) {
    if (expandedHead.length !== 8) return undefined;
    return expandedHead;
  }

  const missing = 8 - expandedHead.length - expandedTail.length;
  if (missing < 1) return undefined;
  return [...expandedHead, ...Array(missing).fill('0'), ...expandedTail];
}

function parseIpv6Prefix(cidr: string): { network: bigint; mask: bigint } {
  const parts = cidr.split('/');
  const base = parts[0];
  const prefixStr = parts[1];
  if (base === undefined || prefixStr === undefined) throw new Error('invalid range');
  const groups = expandIpv6Groups(base);
  if (groups === undefined) throw new Error('invalid range');
  const prefix = Number(prefixStr);
  let value = 0n;
  for (const g of groups) {
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  const mask =
    prefix === 0 ? 0n : (0xffffffffffffffffffffffffffffffffn << BigInt(128 - prefix)) & 0xffffffffffffffffffffffffffffffffn;
  return { network: value & mask, mask };
}

const IPV6_RANGE_TABLE = BLOCKED_IPV6_RANGES.map(parseIpv6Prefix);

function isPublicIpv6(address: string): boolean {
  const groups = expandIpv6Groups(address);
  if (groups === undefined || groups.length !== 8) return false;

  const values = groups.map((g) => parseInt(g, 16));
  const v0 = values[0] ?? 0;
  const v1 = values[1] ?? 0;
  const v2 = values[2] ?? 0;
  const v3 = values[3] ?? 0;
  const v4 = values[4] ?? 0;
  const v5 = values[5] ?? 0;
  const g6 = values[6] ?? 0;
  const g7 = values[7] ?? 0;

  // IPv4-mapped: groups 0-4 zero, group 5 === 0xffff
  const isMapped = v0 === 0 && v1 === 0 && v2 === 0 && v3 === 0 && v4 === 0 && v5 === 0xffff;
  // IPv4-compatible: groups 0-5 zero, not :: and not ::1
  const isCompatible =
    v0 === 0 && v1 === 0 && v2 === 0 && v3 === 0 && v4 === 0 && v5 === 0 && !(g6 === 0 && g7 === 0) && !(g6 === 0 && g7 === 1);

  if (isMapped || isCompatible) {
    const embedded = (((g6 << 16) | g7) >>> 0) >>> 0;
    return isPublicIpv4Value(embedded);
  }

  let full = 0n;
  for (const v of values) {
    full = (full << 16n) | BigInt(v);
  }

  for (const range of IPV6_RANGE_TABLE) {
    if ((full & range.mask) === range.network) return false;
  }
  return true;
}

export function isPublicIpAddress(address: string): boolean {
  if (address.length === 0) return false;
  if (address.includes(':')) return isPublicIpv6(address);
  return isPublicIpv4(address);
}
