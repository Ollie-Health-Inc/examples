// The store's products. Use the names the brand's catalogue uses, since the agent looks them up by name.
export const PRODUCTS = [
  "Magnesium Glycinate",
  "BPC-157",
  "Ashwagandha",
  "Vitamin D3",
  "Omega-3 Fish Oil",
  "Collagen Peptides",
];

export function newOrderId() {
  return `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
}
