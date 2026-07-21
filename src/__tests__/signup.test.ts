import { describe, it, expect, vi } from 'vitest';
import { generateTeamTag } from '../signup';

describe('generateTeamTag', () => {
  it('should generate a 3-letter tag from a 3-word team name', async () => {
    const isTagTaken = vi.fn().mockResolvedValue(false);
    const tag = await generateTeamTag('The Bestest Team', isTagTaken);
    expect(tag).toBe('TBT');
    expect(isTagTaken).toHaveBeenCalledWith('TBT');
  });

  it('should generate a 3-letter tag from a 2-word team name', async () => {
    const isTagTaken = vi.fn().mockResolvedValue(false);
    const tag = await generateTeamTag('Best Team', isTagTaken);
    expect(tag).toBe('BET');
    expect(isTagTaken).toHaveBeenCalledWith('BET');
  });

  it('should generate a 3-letter tag from a 1-word team name', async () => {
    const isTagTaken = vi.fn().mockResolvedValue(false);
    const tag = await generateTeamTag('Rocket', isTagTaken);
    expect(tag).toBe('ROC');
    expect(isTagTaken).toHaveBeenCalledWith('ROC');
  });

  it('should ignore non-alphabetical characters and normalize casing', async () => {
    const isTagTaken = vi.fn().mockResolvedValue(false);
    const tag = await generateTeamTag('team 1!', isTagTaken);
    expect(tag).toBe('TEA');
  });

  it('should fallback to single digit suffix if base tag is taken', async () => {
    const isTagTaken = vi.fn().mockImplementation(async (tag) => tag === 'TBT');
    const tag = await generateTeamTag('The Bestest Team', isTagTaken);
    expect(tag).toBe('TB0');
  });

  it('should fallback to next digit suffix if multiple tags are taken', async () => {
    const takenTags = ['TBT', 'TB0', 'TB1', 'TB2'];
    const isTagTaken = vi.fn().mockImplementation(async (tag) => takenTags.includes(tag));
    const tag = await generateTeamTag('The Bestest Team', isTagTaken);
    expect(tag).toBe('TB3');
  });

  it('should fallback to double digit suffix if all single digits are taken', async () => {
    const isTagTaken = vi.fn().mockImplementation(async (tag) => {
      if (tag === 'TBT') return true;
      if (tag.startsWith('TB') && tag.length === 3 && !isNaN(Number(tag[2]))) return true;
      return false;
    });
    const tag = await generateTeamTag('The Bestest Team', isTagTaken);
    expect(tag).toBe('T10');
  });

  it('should throw an error if all 99 combinations are exhausted', async () => {
    const isTagTaken = vi.fn().mockResolvedValue(true);
    await expect(generateTeamTag('The Bestest Team', isTagTaken)).rejects.toThrow('All tag combinations are exhausted.');
  });
});
