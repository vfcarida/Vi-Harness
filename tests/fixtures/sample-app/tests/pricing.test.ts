import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../src/pricing.js';

describe('Pricing Engine Verification', () => {
  const engine = new PricingEngine();

  it('should apply 10% discount for orders >= $100', () => {
    const summary = engine.calculateTotal({
      items: [{ id: '1', name: 'Widget', price: 100, quantity: 1 }],
    });

    expect(summary.subtotal).toBe(100);
    expect(summary.discountAmount).toBe(10); // 10% of 100
    expect(summary.taxAmount).toBe(7.2); // (100 - 10) * 0.08
    expect(summary.total).toBe(97.2);
  });

  it('should support tax exemption', () => {
    const summary = engine.calculateTotal({
      items: [{ id: '2', name: 'Book', price: 50, quantity: 1 }],
      isTaxExempt: true,
    });

    expect(summary.subtotal).toBe(50);
    expect(summary.discountAmount).toBe(0);
    expect(summary.taxAmount).toBe(0); // Tax exempt!
    expect(summary.total).toBe(50);
  });
});
