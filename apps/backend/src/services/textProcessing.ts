const polishAbbreviations = ['dr', 'prof', 'itp', 'itd', 'ul', 'nr', 'godz', 'm.in'];

interface Segment {
  text: string;
  page: number;
  startChar: number;
  endChar: number;
}

export const segmentPdfText = (text: string): Segment[] => {
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences: Segment[] = [];
  let cursor = 0;
  let page = 1;
  const regex = /(.*?)([\.!?]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    const sentence = match[0].trim();
    if (!sentence) continue;
    const lower = sentence.toLowerCase();
    const isAbbrev = polishAbbreviations.some((abbr) => lower.endsWith(`${abbr}.`));
    if (isAbbrev && sentence.length < 10) {
      continue;
    }
    const start = cursor;
    const end = cursor + sentence.length;
    sentences.push({ text: sentence, page, startChar: start, endChar: end });
    cursor = end + 1;
    if (sentence.includes('\f')) {
      page += 1;
    }
  }
  return sentences;
};

export const normalizeNumber = (value: number): string => {
  if (value === 0) return 'zero';
  const ones = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
  if (value < ones.length) return ones[value];
  return value.toString();
};
