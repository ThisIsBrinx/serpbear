import { filterKeywords } from '../../utils/client/sortFilter';
import { dummyKeywords } from '../../__mocks__/data';

describe('filterKeywords Interval Filtering', () => {
   const baseKeyword = dummyKeywords[0];
   const mockKeywords: KeywordType[] = [
      { ...baseKeyword, ID: 1, keyword: 'kw default explicit', interval: 'default' },
      { ...baseKeyword, ID: 2, keyword: 'kw default undefined', interval: undefined },
      { ...baseKeyword, ID: 3, keyword: 'kw daily', interval: 'daily' },
      { ...baseKeyword, ID: 4, keyword: 'kw other_day', interval: 'other_day' },
      { ...baseKeyword, ID: 5, keyword: 'kw weekly', interval: 'weekly' },
      { ...baseKeyword, ID: 6, keyword: 'kw monthly', interval: 'monthly' },
      { ...baseKeyword, ID: 7, keyword: 'kw never', interval: 'never' },
   ];

   const emptyFilter: KeywordFilters = { countries: [], tags: [], search: '' };

   it('returns all keywords when no interval filter is set', () => {
      const result = filterKeywords(mockKeywords, emptyFilter);
      expect(result).toHaveLength(7);
   });

   it('filters keywords inheriting Global Setting (default or undefined)', () => {
      const result = filterKeywords(mockKeywords, { ...emptyFilter, interval: 'default' });
      expect(result.map((k) => k.ID)).toEqual([1, 2]);
   });

   it('filters keywords by explicit interval (daily, other_day, weekly, monthly, never)', () => {
      expect(filterKeywords(mockKeywords, { ...emptyFilter, interval: 'daily' }).map((k) => k.ID)).toEqual([3]);
      expect(filterKeywords(mockKeywords, { ...emptyFilter, interval: 'other_day' }).map((k) => k.ID)).toEqual([4]);
      expect(filterKeywords(mockKeywords, { ...emptyFilter, interval: 'weekly' }).map((k) => k.ID)).toEqual([5]);
      expect(filterKeywords(mockKeywords, { ...emptyFilter, interval: 'monthly' }).map((k) => k.ID)).toEqual([6]);
      expect(filterKeywords(mockKeywords, { ...emptyFilter, interval: 'never' }).map((k) => k.ID)).toEqual([7]);
   });
});
