import { addRecentSearch } from './searchSuggestions';

describe('addRecentSearch', () => {
  it('الأحدث أولاً وبلا تكرار', () => {
    expect(addRecentSearch(['حليب', 'هاتف'], 'هاتف')).toEqual(['هاتف', 'حليب']);
  });
  it('يقصّ المسافات ويتجاهل الفارغ', () => {
    expect(addRecentSearch(['حليب'], '  قهوة  ')).toEqual(['قهوة', 'حليب']);
    expect(addRecentSearch(['حليب'], '   ')).toEqual(['حليب']);
  });
  it('لا يتجاوز الحد الأقصى', () => {
    expect(addRecentSearch(['1', '2', '3', '4', '5'], '6')).toEqual(['6', '1', '2', '3', '4']);
  });
});
