import { describe, expect, it } from 'vitest';
import { buildIssueUrl, buildErrorReportBody } from './report-issue';

describe('buildIssueUrl', () => {
  it('encodes title, body, labels into a GH new-issue URL', () => {
    const url = buildIssueUrl({
      title: 'Hello',
      body: 'world',
      labels: ['bug', 'type:feat'],
    });
    expect(url).toContain('github.com/');
    expect(url).toContain('issues/new?');
    expect(url).toContain('title=Hello');
    expect(url).toContain('body=world');
    expect(url).toMatch(/labels=bug.*type%3Afeat|labels=bug%2Ctype%3Afeat/);
  });

  it('omits body param when empty', () => {
    const url = buildIssueUrl({ title: 'Test', body: '' });
    expect(url).not.toContain('body=');
  });

  it('omits labels param when array is empty', () => {
    const url = buildIssueUrl({ title: 'Test', labels: [] });
    expect(url).not.toContain('labels=');
  });

  it('has the correct URL shape (owner/repo agnostic for forks)', () => {
    // Assert the URL structure rather than a hardcoded repo slug so that forks
    // that set PUBLIC_REPO_SLUG still pass CI. The slug is validated separately.
    const url = buildIssueUrl({ title: 'x' });
    expect(url).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/new/);
  });
});

describe('buildErrorReportBody', () => {
  it('includes the error name + message + stack', () => {
    const e = new Error('Boom');
    const body = buildErrorReportBody({ error: e, componentPath: 'IssuesList › ul' });
    expect(body).toMatch(/Boom/);
    expect(body).toMatch(/Component path/);
    expect(body).toMatch(/IssuesList/);
  });

  it('marks hydration mismatches explicitly', () => {
    const body = buildErrorReportBody({ error: new Error('x'), hydrationMismatch: true });
    expect(body).toMatch(/Hydration mismatch/);
  });

  it('marks non-hydration errors as Runtime error', () => {
    const body = buildErrorReportBody({ error: new Error('x'), hydrationMismatch: false });
    expect(body).toMatch(/Runtime error/);
  });

  it('omits componentPath line when not provided', () => {
    const body = buildErrorReportBody({ error: new Error('x') });
    expect(body).not.toMatch(/Component path/);
  });

  it('includes the Stack section', () => {
    const body = buildErrorReportBody({ error: new Error('x') });
    expect(body).toMatch(/## Stack/);
    expect(body).toMatch(/```/);
  });
});
