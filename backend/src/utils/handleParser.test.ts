import { extractSocialHandle } from './handleParser';

describe('extractSocialHandle', () => {
  it('extracts handles from Instagram URLs', () => {
    expect(extractSocialHandle('https://instagram.com/pulse_kicks?igshid=123')).toBe('pulse_kicks');
    expect(extractSocialHandle('www.instagram.com/sneakerhead/')).toBe('sneakerhead');
  });

  it('extracts handles from TikTok URLs', () => {
    expect(extractSocialHandle('https://www.tiktok.com/@my_shop_ke')).toBe('my_shop_ke');
  });

  it('cleans raw handles with @ symbols', () => {
    expect(extractSocialHandle('@nairobi.fits!')).toBe('nairobifits');
  });

  it('returns empty string for invalid inputs', () => {
    expect(extractSocialHandle('')).toBe('');
    expect(extractSocialHandle('!!!')).toBe('');
  });
});