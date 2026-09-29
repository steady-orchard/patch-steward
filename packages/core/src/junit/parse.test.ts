import { describe, it, expect } from 'vitest';
import { parseJunitXml } from './parse.js';

function bytesOf(xml: string): Uint8Array {
  return Buffer.from(xml, 'utf8');
}

const DEFAULT = { maxCases: 1000 };

describe('parseJunitXml', () => {
  it('reads statuses with error over failure over skipped', () => {
    const errorXml = '<testsuites><testcase name="a"><error/><failure/><skipped/></testcase></testsuites>';
    const r1 = parseJunitXml(bytesOf(errorXml), DEFAULT);
    if (r1.status !== 'parsed') throw new Error('expected parsed');
    expect(r1.junit.cases[0]!.status).toBe('error');
    expect(r1.junit.errored).toBe(1);

    const failXml = '<testsuites><testcase name="a"><failure/><skipped/></testcase></testsuites>';
    const r2 = parseJunitXml(bytesOf(failXml), DEFAULT);
    if (r2.status !== 'parsed') throw new Error('expected parsed');
    expect(r2.junit.cases[0]!.status).toBe('fail');
    expect(r2.junit.failed).toBe(1);

    const skipXml = '<testsuites><testcase name="a"><skipped/></testcase></testsuites>';
    const r3 = parseJunitXml(bytesOf(skipXml), DEFAULT);
    if (r3.status !== 'parsed') throw new Error('expected parsed');
    expect(r3.junit.cases[0]!.status).toBe('skip');
    expect(r3.junit.skipped).toBe(1);

    const passXml = '<testsuites><testcase name="a"/></testsuites>';
    const r4 = parseJunitXml(bytesOf(passXml), DEFAULT);
    if (r4.status !== 'parsed') throw new Error('expected parsed');
    expect(r4.junit.cases[0]!.status).toBe('pass');
    expect(r4.junit.passed).toBe(1);
  });

  it('computes counts from cases, not suite attributes', () => {
    const xml = '<testsuite tests="99" failures="50"><testcase name="a"/><testcase name="b"/></testsuite>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.tests).toBe(2);
  });

  it('builds identities from classname and name', () => {
    const xml = '<testsuites><testcase classname="a.b" name="c"/><testcase name="c"/></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.cases[0]!.identity).toBe('a.b::c');
    expect(r.junit.cases[1]!.identity).toBe('::c');
  });

  it('counts testcase elements outside a testsuite', () => {
    const xml = '<testsuites><testcase name="a"/><testcase name="b"/></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.tests).toBe(2);
  });

  it('truncates identities on a code point boundary', () => {
    const longName = 'a'.repeat(4093) + String.fromCodePoint(0x1f600) + 'b';
    expect(longName.length).toBe(4096);
    const xml = `<testsuites><testcase name="${longName}"/></testsuites>`;
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.cases[0]!.identity.length).toBe(4095);
    expect(r.junit.cases[0]!.identity_truncated).toBe(true);

    const shortXml = '<testsuites><testcase name="abcdefgh"/></testsuites>';
    const rs = parseJunitXml(bytesOf(shortXml), DEFAULT);
    if (rs.status !== 'parsed') throw new Error('expected parsed');
    expect(rs.junit.cases[0]!.identity_truncated).toBe(false);
  });

  it('converts times to milliseconds', () => {
    const xml =
      '<testsuites>' +
      '<testcase name="a" time="0.0125"/>' +
      '<testcase name="b" time="1"/>' +
      '<testcase name="c" time="2.5"/>' +
      '<testcase name="d" time="-1"/>' +
      '<testcase name="e" time="abc"/>' +
      '<testcase name="f" time=""/>' +
      '<testcase name="g"/>' +
      '</testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    const durations = r.junit.cases.map((c) => c.duration_ms);
    expect(durations).toEqual([13, 1000, 2500, null, null, null, null]);
    expect(r.junit.duration_ms).toBe(13 + 1000 + 2500);

    const allNullXml = '<testsuites><testcase name="a" time="abc"/></testsuites>';
    const rn = parseJunitXml(bytesOf(allNullXml), DEFAULT);
    if (rn.status !== 'parsed') throw new Error('expected parsed');
    expect(rn.junit.duration_ms).toBe(null);
  });

  it('keeps the first N cases', () => {
    const xml = '<testsuites><testcase name="a"/><testcase name="b"/><testcase name="c"/></testsuites>';
    const r = parseJunitXml(bytesOf(xml), { maxCases: 2 });
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.cases.length).toBe(2);
    expect(r.junit.tests).toBe(3);
    expect(r.junit.cases_truncated).toBe(true);
  });

  it('strips one byte order mark', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const body = Buffer.from('<testsuites/>', 'utf8');
    const bytes = Buffer.concat([bom, body]);
    const r = parseJunitXml(bytes, DEFAULT);
    expect(r.status).toBe('parsed');
  });

  it('skips comments, CDATA, and processing instructions', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<!-- a comment --><testsuites><!-- inner --><testcase name="a"><![CDATA[ignored <data> ]]></testcase><?pi data?></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.tests).toBe(1);
  });

  it('decodes predefined and numeric references', () => {
    const xml = '<testsuites><testcase name="&lt;&gt;&amp;&quot;&apos;&#65;&#x42;"/></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.cases[0]!.identity.endsWith('<>&"\'AB')).toBe(true);
  });

  it('keeps injection text as data', () => {
    const name = '$(rm -rf /) ' + '$' + '{{ secrets.X }} @octocat';
    const xml = `<testsuites><testcase name="${name}"/></testsuites>`;
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    if (r.status !== 'parsed') throw new Error('expected parsed');
    expect(r.junit.cases[0]!.identity.includes(name)).toBe(true);
  });

  it('rejects a DOCTYPE', () => {
    const xml = '<!DOCTYPE testsuites><testsuites/>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.doctype-forbidden' });
  });

  it('rejects an internal entity declaration', () => {
    const xml = '<!DOCTYPE t [<!ENTITY e "v">]><testsuites>&e;</testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.doctype-forbidden' });
  });

  it('rejects an external entity', () => {
    const xml = '<!DOCTYPE t SYSTEM "file:///etc/passwd"><testsuites/>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.doctype-forbidden' });
  });

  it('rejects billion laughs without expansion', () => {
    const xml =
      '<!DOCTYPE lolz [' +
      '<!ENTITY lol "lol">' +
      '<!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">' +
      '<!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">' +
      ']><testsuites>&lol2;</testsuites>';
    const start = Date.now();
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    const elapsed = Date.now() - start;
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.doctype-forbidden' });
    expect(elapsed).toBeLessThan(1000);
  });

  it('rejects an unknown entity', () => {
    const xml = '<testsuites><testcase name="&foo;"/></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.entity-unknown' });
  });

  it('rejects an invalid numeric reference', () => {
    const xml1 = '<testsuites><testcase name="&#0;"/></testsuites>';
    const r1 = parseJunitXml(bytesOf(xml1), DEFAULT);
    expect(r1).toEqual({ status: 'malformed', error_code: 'junit.entity-unknown' });

    const xml2 = '<testsuites><testcase name="&#xD800;"/></testsuites>';
    const r2 = parseJunitXml(bytesOf(xml2), DEFAULT);
    expect(r2).toEqual({ status: 'malformed', error_code: 'junit.entity-unknown' });
  });

  it('rejects nesting deeper than the bound', () => {
    const deep = '<testsuite>'.repeat(64) + '</testsuite>'.repeat(64);
    const tooDeep = `<testsuites>${deep}</testsuites>`;
    const r = parseJunitXml(bytesOf(tooDeep), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.too-deep' });

    const ok = '<testsuite>'.repeat(63) + '</testsuite>'.repeat(63);
    const fits = `<testsuites>${ok}</testsuites>`;
    const rOk = parseJunitXml(bytesOf(fits), DEFAULT);
    expect(rOk.status).toBe('parsed');
  });

  it('rejects more attributes than the bound', () => {
    const attrs65 = Array.from({ length: 65 }, (_, i) => `a${i}="v"`).join(' ');
    const tooMany = `<testsuites ${attrs65}/>`;
    const r = parseJunitXml(bytesOf(tooMany), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.too-many-attributes' });

    const attrs64 = Array.from({ length: 64 }, (_, i) => `a${i}="v"`).join(' ');
    const fits = `<testsuites ${attrs64}/>`;
    const rOk = parseJunitXml(bytesOf(fits), DEFAULT);
    expect(rOk.status).toBe('parsed');
  });

  it('rejects an overlong attribute value', () => {
    const tooLong = `<testsuites x="${'x'.repeat(65537)}"/>`;
    const r = parseJunitXml(bytesOf(tooLong), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.attribute-too-long' });

    const fits = `<testsuites x="${'x'.repeat(65536)}"/>`;
    const rOk = parseJunitXml(bytesOf(fits), DEFAULT);
    expect(rOk.status).toBe('parsed');
  });

  it('rejects more elements than the bound', () => {
    const tooMany = '<testsuites>' + '<x/>'.repeat(200000) + '</testsuites>';
    const r = parseJunitXml(bytesOf(tooMany), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.too-many-elements' });

    const fits = '<testsuites>' + '<x/>'.repeat(199999) + '</testsuites>';
    const rOk = parseJunitXml(bytesOf(fits), DEFAULT);
    expect(rOk.status).toBe('parsed');
  });

  it('rejects invalid UTF-8', () => {
    const bytes = Buffer.from([0x3c, 0xff, 0x3e]);
    const r = parseJunitXml(bytes, DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.encoding' });
  });

  it('rejects a UTF-16 byte order mark', () => {
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<testsuites/>', 'utf16le')]);
    const r = parseJunitXml(bytes, DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.encoding' });
  });

  it('rejects a non-UTF-8 encoding declaration', () => {
    const xml = "<?xml version='1.0' encoding='ISO-8859-1'?><testsuites/>";
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.encoding' });
  });

  it('rejects a raw control character', () => {
    const xml = `<testsuites>${String.fromCharCode(1)}</testsuites>`;
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.syntax' });
  });

  it('rejects mismatched tags', () => {
    const xml = '<testsuites><testcase name="a"></testsuite></testsuites>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.syntax' });
  });

  it('rejects an unknown root element', () => {
    const xml = '<report/>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.root-invalid' });
  });

  it('rejects a second root', () => {
    const xml = '<testsuites/><testsuites/>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.syntax' });
  });

  it('rejects text outside the root', () => {
    const xml = 'hello<testsuites/>';
    const r = parseJunitXml(bytesOf(xml), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.syntax' });
  });

  it('rejects empty input', () => {
    const r = parseJunitXml(bytesOf(''), DEFAULT);
    expect(r).toEqual({ status: 'malformed', error_code: 'junit.syntax' });
  });

  it('rejects an invalid case limit', () => {
    expect(() => parseJunitXml(bytesOf('<testsuites/>'), { maxCases: 0 })).toThrow(RangeError);
    expect(() => parseJunitXml(bytesOf('<testsuites/>'), { maxCases: 1001 })).toThrow(RangeError);
  });
});
