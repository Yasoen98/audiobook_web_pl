import { describe, it, expect } from 'vitest';
import { segmentPdfText, normalizeNumber } from '../services/textProcessing.js';

describe('segmentPdfText', () => {
  it('dzieli tekst na zdania z pominięciem skrótów', () => {
    const segments = segmentPdfText('Dr. Kowalski poszedł na spacer. To było miłe.');
    expect(segments.length).toBe(2);
    expect(segments[0].text).toContain('Kowalski poszedł');
    expect(segments[1].text).toContain('To było miłe');
  });
});

describe('normalizeNumber', () => {
  it('konwertuje liczby', () => {
    expect(normalizeNumber(0)).toBe('zero');
    expect(normalizeNumber(2)).toBe('dwa');
  });
});
