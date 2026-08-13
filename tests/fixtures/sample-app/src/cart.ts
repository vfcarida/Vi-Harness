export interface CartItem {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

export interface ShoppingCart {
  readonly items: ReadonlyArray<CartItem>;
  readonly isTaxExempt?: boolean;
}
