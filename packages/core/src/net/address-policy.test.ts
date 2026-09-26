import { describe, expect, it } from 'vitest';
import { BLOCKED_IPV4_RANGES, BLOCKED_IPV6_RANGES, isPublicIpAddress } from './address-policy.js';

describe('address-policy', () => {
  it('attachment rule: private IPv4 ranges are not public', () => {
    const rows = [
      '0.0.0.0',
      '0.255.255.255',
      '10.0.0.0',
      '10.255.255.255',
      '100.64.0.0',
      '100.127.255.255',
      '127.0.0.1',
      '127.255.255.255',
      '169.254.169.254',
      '172.16.0.0',
      '172.31.255.255',
      '192.0.0.1',
      '192.168.1.1',
      '198.18.0.0',
      '198.19.255.255',
      '224.0.0.1',
      '239.255.255.255',
      '240.0.0.1',
      '255.255.255.254',
      '255.255.255.255',
    ];
    for (const row of rows) {
      expect(isPublicIpAddress(row), row).toBe(false);
    }
  });

  it('attachment rule: private IPv6 ranges are not public', () => {
    const rows = [
      '::',
      '::1',
      '0:0:0:0:0:0:0:1',
      'fc00::1',
      'fdff::1',
      'fe80::1',
      'febf:ffff::1',
      'ff02::1',
      'FF02::1',
      '::ffff:10.0.0.1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '::127.0.0.1',
      '::a00:1',
      '::2',
    ];
    for (const row of rows) {
      expect(isPublicIpAddress(row), row).toBe(false);
    }
  });

  it('public addresses are accepted', () => {
    const rows = [
      '1.0.0.0',
      '8.8.8.8',
      '9.255.255.255',
      '11.0.0.0',
      '100.63.255.255',
      '100.128.0.0',
      '126.255.255.255',
      '128.0.0.0',
      '140.82.112.3',
      '169.253.255.255',
      '169.255.0.0',
      '172.15.255.255',
      '172.32.0.0',
      '192.0.1.0',
      '192.167.255.255',
      '192.169.0.0',
      '198.17.255.255',
      '198.20.0.0',
      '223.255.255.255',
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
      '2606:50c0:8000::153',
      'fbff:ffff::1',
      'fec0::1',
      '::ffff:8.8.8.8',
      '::ffff:808:808',
      '::8.8.8.8',
    ];
    for (const row of rows) {
      expect(isPublicIpAddress(row), row).toBe(true);
    }
  });

  it('malformed addresses are not public', () => {
    const rows = [
      '',
      'localhost',
      'github.com',
      '1.2.3',
      '1.2.3.4.5',
      '256.1.1.1',
      '01.2.3.4',
      '1.2.3.-4',
      ' 1.2.3.4',
      '1.2.3.4 ',
      ':::1',
      '1::2::3',
      'g::1',
      '[::1]',
      'fe80::1%eth0',
      '::ffff:1.2.3',
      '1:2:3:4:5:6:7:8:9',
      '12345::1',
      '1:2:3:4:5:6:7',
    ];
    for (const row of rows) {
      expect(isPublicIpAddress(row), row).toBe(false);
    }
  });

  it('blocked range lists are the approved lists', () => {
    expect(BLOCKED_IPV4_RANGES).toHaveLength(12);
    expect(BLOCKED_IPV6_RANGES).toHaveLength(5);
    expect(BLOCKED_IPV4_RANGES).toEqual([
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
    ]);
    expect(BLOCKED_IPV6_RANGES).toEqual(['::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8']);
  });
});
