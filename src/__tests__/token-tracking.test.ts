import { describe, it, expect } from 'vitest';
import { calculateCost } from '@/app/api/chat/route';

describe('calculateCost()', () => {
  it('returns zero for zero tokens', () => {
    expect(calculateCost(0, 0)).toBe(0);
  });

  it('calculates cost for input-only tokens', () => {
    // 1M input tokens: $3 * 1.30 = $3.90
    const cost = calculateCost(1_000_000, 0);
    expect(cost).toBeCloseTo(3.9, 5);
  });

  it('calculates cost for output-only tokens', () => {
    // 1M output tokens: $15 * 1.30 = $19.50
    const cost = calculateCost(0, 1_000_000);
    expect(cost).toBeCloseTo(19.5, 5);
  });

  it('calculates combined cost correctly', () => {
    // 1000 input + 500 output
    // input cost: (1000 * 3 / 1_000_000) = 0.003
    // output cost: (500 * 15 / 1_000_000) = 0.0075
    // total before markup: 0.0105
    // with 1.30x markup: 0.01365
    const cost = calculateCost(1000, 500);
    expect(cost).toBeCloseTo(0.01365, 5);
  });

  it('applies 1.30x markup', () => {
    const costWithoutMarkup = (1_000_000 * 3) / 1_000_000 + (1_000_000 * 15) / 1_000_000;
    const expected = costWithoutMarkup * 1.3;
    expect(calculateCost(1_000_000, 1_000_000)).toBeCloseTo(expected, 5);
  });

  it('handles typical conversation sizes', () => {
    // Typical: 800 input + 400 output
    const cost = calculateCost(800, 400);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.05); // sanity check: under 5 cents per message
  });

  it('is monotonically increasing', () => {
    const c1 = calculateCost(100, 100);
    const c2 = calculateCost(200, 200);
    const c3 = calculateCost(1000, 1000);
    expect(c2).toBeGreaterThan(c1);
    expect(c3).toBeGreaterThan(c2);
  });
});
