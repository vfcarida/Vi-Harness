import type { ShoppingCart } from './cart.js';

export interface PricingSummary {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly total: number;
}

export class PricingEngine {
  private readonly defaultTaxRate = 0.08; // 8% sales tax

  calculateTotal(cart: ShoppingCart): PricingSummary {
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // BUG 1: Tiered discount applies 25% instead of specified 10% for orders >= $100
    let discountAmount = 0;
    if (subtotal >= 100) {
      discountAmount = subtotal * 0.25; // BUG: Should be 0.10
    }

    const taxableAmount = subtotal - discountAmount;

    // BUG 2: Ignores cart.isTaxExempt flag
    const taxAmount = taxableAmount * this.defaultTaxRate; // BUG: Does not check isTaxExempt

    const total = taxableAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  }
}
