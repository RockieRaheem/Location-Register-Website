import { plainTextFromHtml } from './safeText.ts';

describe('plainTextFromHtml', () => {
  it('preserves readable text without returning executable markup', () => {
    const result = plainTextFromHtml('<p>Hello &amp; welcome</p><script>alert(1)</script>');
    expect(result).toBe('Hello & welcome\nalert(1)');
    expect(result).not.toContain('<script>');
  });
});
