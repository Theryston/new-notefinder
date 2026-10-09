import { titleSimilarity } from './track-title-similarity.js';

describe('titleSimilarity', () => {
  it('scores the same title as 1', () => {
    expect(titleSimilarity('Under Pressure', 'Under Pressure', [])).toBe(1);
  });

  it('ignores the artist names YouTube puts in the title', () => {
    expect(
      titleSimilarity(
        'Under Pressure',
        'Queen - Under Pressure (Official Video)',
        ['Queen'],
      ),
    ).toBe(1);
  });

  it('ignores version words and release years on both sides', () => {
    expect(
      titleSimilarity(
        'Under Pressure (Single Version; 2017 Remaster)',
        'Queen - Under Pressure (2011 Remastered Version)',
        ['Queen'],
      ),
    ).toBe(1);
  });

  it('lowers the score when the video has words the Recording does not', () => {
    const score = titleSimilarity(
      'Under Pressure',
      'Under Pressure (Karaoke)',
      ['Queen'],
    );

    expect(score).toBeCloseTo(2 / 3);
  });

  it('keeps a live take apart from the studio one', () => {
    expect(
      titleSimilarity(
        'Bohemian Rhapsody',
        'Queen - Bohemian Rhapsody (Live at Wembley)',
        ['Queen'],
      ),
    ).toBeLessThan(0.8);
    expect(
      titleSimilarity(
        'Bohemian Rhapsody (Live at Wembley)',
        'Queen - Bohemian Rhapsody (Live at Wembley 1986)',
        ['Queen'],
      ),
    ).toBe(1);
  });

  it('compares without accents or case', () => {
    expect(titleSimilarity('Mãe', 'MAE', [])).toBe(1);
  });

  it('ignores featured guests in parentheses', () => {
    expect(
      titleSimilarity('Song (feat. Guest)', 'Artist - Song', ['Artist']),
    ).toBe(1);
  });

  it('keeps an artist word the Recording title itself uses', () => {
    expect(
      titleSimilarity('Queen', 'Queen - Queen (Official Video)', ['Queen']),
    ).toBe(1);
  });

  it('scores an unrelated title as 0, and an empty one too', () => {
    expect(titleSimilarity('Hey Jude', 'Yesterday', ['Beatles'])).toBe(0);
    expect(titleSimilarity('', 'Hey Jude', [])).toBe(0);
    expect(titleSimilarity('Hey Jude', '(Official Video)', [])).toBe(0);
  });
});
