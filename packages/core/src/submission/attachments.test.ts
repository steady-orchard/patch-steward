import { describe, expect, it } from 'vitest';
import { extractAttachmentUrls, isAttachmentUrl, attachmentFormatFromUrl, assessAttachmentsStatically } from './attachments.js';
import { parseIssueBody, parsePullRequestBody } from './parse.js';
import { DEFAULT_CHECKLIST_POLICY } from './default-checklist.js';
import type { ResolvedPolicy } from '../policy/schema.js';

const DEFAULT_DESTINATIONS = DEFAULT_CHECKLIST_POLICY.submission.attachments.destinations;

function issueBody(): string {
  return [
    '### Expected behavior',
    '',
    'It works.',
    '',
    '### Authoritative basis',
    '',
    'docs/format.md',
    '',
    '### Actual behavior',
    '',
    'It fails.',
    '',
    '### Affected version',
    '',
    '1.0.0',
    '',
    '### Reproduction command',
    '',
    'run it',
    '',
    '### Expected result',
    '',
    'success',
    '',
    '### Proposed scope',
    '',
    'parser only',
    '',
    '### References',
    '',
    '_No response_',
    '',
    '### Security claim',
    '',
    '- [ ] This report claims a security problem',
  ].join('\n');
}

function issueBodyWithField(heading: string, value: string): string {
  const base = issueBody();
  const marker = `### ${heading}\n\n`;
  const start = base.indexOf(marker) + marker.length;
  const end = base.indexOf('\n\n###', start);
  return base.slice(0, start) + value + base.slice(end);
}

function prBody(): string {
  return [
    '<!-- patch-steward:pr-template v1 -->',
    '',
    '## Category',
    '',
    'bugfix',
    '',
    '## Problem',
    '',
    'It fails.',
    '',
    '## Benefit',
    '',
    'It works.',
    '',
    '## Intended behavior',
    '',
    'success',
    '',
    '## Acceptance criteria',
    '',
    '- passes',
    '',
    '## Linked issue',
    '',
    'Fixes #1',
    '',
    '## Regression test',
    '',
    'test.ts',
    '',
    '## Test scaffolding',
    '',
    '',
    '## Reproduction command',
    '',
    'run it',
    '',
    '## Expected result',
    '',
    'success',
    '',
    '## References',
    '',
    'docs/format.md',
  ].join('\n');
}

describe('attachment urls are found in links, images, autolinks, and bare text', () => {
  it('attachment urls are found in links, images, autolinks, and bare text', () => {
    const text = [
      '[log](https://github.com/user-attachments/files/123/log.txt)',
      '![screenshot](https://user-images.githubusercontent.com/1/abc.png)',
      '<https://github.com/user-attachments/files/456/a.txt>',
      'plain https://github.com/user-attachments/files/789/b.txt end',
    ].join('\n');
    const urls = extractAttachmentUrls(text, DEFAULT_DESTINATIONS);
    expect(urls).toEqual([
      'https://github.com/user-attachments/files/123/log.txt',
      'https://user-images.githubusercontent.com/1/abc.png',
      'https://github.com/user-attachments/files/456/a.txt',
      'https://github.com/user-attachments/files/789/b.txt',
    ]);
  });
});

describe('attachment urls drop trailing punctuation', () => {
  it('attachment urls drop trailing punctuation', () => {
    const text = 'see https://github.com/user-attachments/files/1/a.txt.';
    const urls = extractAttachmentUrls(text, DEFAULT_DESTINATIONS);
    expect(urls).toEqual(['https://github.com/user-attachments/files/1/a.txt']);
  });
});

describe('attachment url shapes follow the built-in list', () => {
  it('attachment url shapes follow the built-in list', () => {
    const files = new URL('https://github.com/user-attachments/files/1/a.txt');
    const assets = new URL('https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012');
    const legacy = new URL('https://github.com/owner/repo/files/1/a.txt');
    const image1 = new URL('https://user-images.githubusercontent.com/anything');
    const image2 = new URL('https://private-user-images.githubusercontent.com/anything');
    const httpFiles = new URL('http://github.com/user-attachments/files/1/a.txt');
    const issue = new URL('https://github.com/o/r/issues/1');
    const other = new URL('https://example.com/a.txt');

    expect(isAttachmentUrl(files, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(assets, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(legacy, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(image1, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(image2, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(httpFiles, DEFAULT_DESTINATIONS)).toBe(true);
    expect(isAttachmentUrl(issue, DEFAULT_DESTINATIONS)).toBe(false);
    expect(isAttachmentUrl(other, DEFAULT_DESTINATIONS)).toBe(false);
  });
});

describe('project-added destinations make https urls attachments', () => {
  it('project-added destinations make https urls attachments', () => {
    const destinations = [...DEFAULT_DESTINATIONS, 'files.example.org'];
    const https = new URL('https://files.example.org/a.txt');
    const http = new URL('http://files.example.org/a.txt');
    expect(isAttachmentUrl(https, destinations)).toBe(true);
    expect(isAttachmentUrl(http, destinations)).toBe(false);
  });
});

describe('attachment format comes from the last path segment', () => {
  it('attachment format comes from the last path segment', () => {
    expect(attachmentFormatFromUrl('https://github.com/user-attachments/files/1/a.txt')).toBe('txt');
    expect(attachmentFormatFromUrl('https://github.com/user-attachments/files/1/a.tar.gz')).toBe('gz');
    expect(attachmentFormatFromUrl('https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012')).toBe(null);
    expect(attachmentFormatFromUrl('https://github.com/user-attachments/files/1/x.')).toBe(null);
  });
});

describe('attachments inside html comments are ignored', () => {
  it('attachments inside html comments are ignored', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField('References', '<!-- https://github.com/user-attachments/files/1/a.txt -->\n_No response_');
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items).toEqual([]);
  });
});

describe('duplicate attachment urls are one attachment', () => {
  it('duplicate attachment urls are one attachment', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField('Authoritative basis', 'https://github.com/user-attachments/files/1/a.txt').replace(
      '### Expected result\n\nsuccess',
      '### Expected result\n\nhttps://github.com/user-attachments/files/1/a.txt',
    );
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.fields).toEqual(['authoritative-basis', 'expected-result']);
  });
});

describe('attachments in policy-required fields are required', () => {
  it('attachments in policy-required fields are required', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField('Authoritative basis', 'https://github.com/user-attachments/files/1/a.txt').replace(
      '### References\n\n_No response_',
      '### References\n\nhttps://github.com/user-attachments/files/2/b.txt',
    );
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: ['authoritative-basis'],
      policy,
    });
    const required = result.items.find((item) => item.url.endsWith('/1/a.txt'));
    const notRequired = result.items.find((item) => item.url.endsWith('/2/b.txt'));
    expect(required?.required).toBe(true);
    expect(notRequired?.required).toBe(false);
  });
});

describe('free-form bodies make every attachment required', () => {
  it('free-form bodies make every attachment required', () => {
    const policy: ResolvedPolicy = {
      ...structuredClone(DEFAULT_CHECKLIST_POLICY),
      submission: { ...DEFAULT_CHECKLIST_POLICY.submission, free_form: true },
    };
    const body = 'here is a file https://github.com/user-attachments/files/1/a.txt';
    const parsed = parseIssueBody(body);
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.value.structured).toBe(false);
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.required).toBe(true);
    expect(result.items[0]?.fields).toEqual([]);
  });
});

describe('unstructured bodies without free form have no attachments', () => {
  it('unstructured bodies without free form have no attachments', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = 'random text https://github.com/user-attachments/files/1/a.txt';
    const parsed = parseIssueBody(body);
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.value.structured).toBe(false);
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items).toEqual([]);
  });
});

describe('attachment rule: count over the limit is a violation', () => {
  it('attachment rule: count over the limit is a violation', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const urls = Array.from({ length: 6 }, (_, i) => `https://github.com/user-attachments/files/${i + 1}/a.txt`).join('\n');
    const body = issueBodyWithField('References', urls);
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items.length).toBe(6);
    expect(result.limit).toBe(5);
    expect(result.countExceeded).toBe(true);
  });
});

describe('attachment rule: a format that is not allowed is a violation', () => {
  it('attachment rule: a format that is not allowed is a violation', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField('References', 'https://github.com/user-attachments/files/1/tool.exe');
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items[0]?.status).toBe('violation');
    expect(result.items[0]?.rule).toBe('format');
  });
});

describe('attachment rule: destination, scheme, userinfo, and port are checked before fetching', () => {
  it('attachment rule: destination, scheme, userinfo, and port are checked before fetching', () => {
    const policyBase = structuredClone(DEFAULT_CHECKLIST_POLICY);

    const httpBody = issueBodyWithField('References', 'http://user-images.githubusercontent.com/1/a.txt');
    const httpParsed = parseIssueBody(httpBody);
    if (!httpParsed.ok || !httpParsed.value.structured) throw new Error('expected structured body');
    const httpResult = assessAttachmentsStatically({
      body: httpParsed.value,
      bodyText: httpBody,
      requiredFields: [],
      policy: policyBase,
    });
    expect(httpResult.items[0]?.rule).toBe('scheme');

    const userinfoBody = issueBodyWithField('References', 'https://u:p@github.com/user-attachments/files/1/a.txt');
    const userinfoParsed = parseIssueBody(userinfoBody);
    if (!userinfoParsed.ok || !userinfoParsed.value.structured) throw new Error('expected structured body');
    const userinfoResult = assessAttachmentsStatically({
      body: userinfoParsed.value,
      bodyText: userinfoBody,
      requiredFields: [],
      policy: policyBase,
    });
    expect(userinfoResult.items[0]?.rule).toBe('userinfo');

    const portBody = issueBodyWithField('References', 'https://github.com:8443/user-attachments/files/1/a.txt');
    const portParsed = parseIssueBody(portBody);
    if (!portParsed.ok || !portParsed.value.structured) throw new Error('expected structured body');
    const portResult = assessAttachmentsStatically({
      body: portParsed.value,
      bodyText: portBody,
      requiredFields: [],
      policy: policyBase,
    });
    expect(portResult.items[0]?.rule).toBe('destination');

    const noImageHostPolicy: ResolvedPolicy = {
      ...policyBase,
      submission: {
        ...policyBase.submission,
        attachments: {
          ...policyBase.submission.attachments,
          destinations: policyBase.submission.attachments.destinations.filter((d) => d !== 'user-images.githubusercontent.com'),
        },
      },
    };
    const imageBody = issueBodyWithField('References', 'https://user-images.githubusercontent.com/1/a.txt');
    const imageParsed = parseIssueBody(imageBody);
    if (!imageParsed.ok || !imageParsed.value.structured) throw new Error('expected structured body');
    const imageResult = assessAttachmentsStatically({
      body: imageParsed.value,
      bodyText: imageBody,
      requiredFields: [],
      policy: noImageHostPolicy,
    });
    expect(imageResult.items[0]?.rule).toBe('destination');
  });
});

describe('attachment rule: an over-long url is a destination violation', () => {
  it('attachment rule: an over-long url is a destination violation', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const longName = 'a'.repeat(2100);
    const url = `https://github.com/user-attachments/files/1/${longName}.txt`;
    const body = issueBodyWithField('References', url);
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items[0]?.rule).toBe('destination');
  });
});

describe('extensionless attachments stay pending with an unknown format', () => {
  it('extensionless attachments stay pending with an unknown format', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField(
      'References',
      'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789012',
    );
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items[0]?.status).toBe('pending');
    expect(result.items[0]?.format).toBe(null);
  });
});

describe('attachment items are sorted by url', () => {
  it('attachment items are sorted by url', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = issueBodyWithField(
      'References',
      'https://github.com/user-attachments/files/2/b.txt\nhttps://github.com/user-attachments/files/1/a.txt',
    );
    const parsed = parseIssueBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    const urls = result.items.map((item) => item.url);
    const sorted = [...urls].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(urls).toEqual(sorted);
  });
});

describe('pull request bodies are scanned the same way', () => {
  it('finds attachments in a pull request field', () => {
    const policy = structuredClone(DEFAULT_CHECKLIST_POLICY);
    const body = prBody().replace(
      '## References\n\ndocs/format.md',
      '## References\n\nhttps://github.com/user-attachments/files/1/a.txt',
    );
    const parsed = parsePullRequestBody(body);
    if (!parsed.ok || !parsed.value.structured) throw new Error('expected structured body');
    const result = assessAttachmentsStatically({
      body: parsed.value,
      bodyText: body,
      requiredFields: [],
      policy,
    });
    expect(result.items.length).toBe(1);
  });
});
