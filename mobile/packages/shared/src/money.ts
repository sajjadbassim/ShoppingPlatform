// البيع بالوزن: وحدة البيع = weightStepKg كغم (0.1 / 0.25 / 0.5 / 1)، والسعر والكمية والمخزون كلها بالوحدة.
// منقولة من ShoppingPlatformFrontend/src/utils/weight.js. كل مبلغ يأتي محسوباً من الخادم والتطبيق يعرض فقط.

export const isByWeight = (item?: { weightStepKg?: number | null } | null): boolean =>
  Number(item?.weightStepKg) > 0;

// سعر الكيلو من سعر الوحدة
export const pricePerKg = (unitPrice: number, weightStepKg?: number | null): number => {
  const step = Number(weightStepKg);
  return step > 0 ? unitPrice / step : unitPrice;
};

// نص السعر: «3,000 د.ع / كغم» للبيع بالوزن، وإلا «3,000 د.ع» (الدينار بلا كسور)
export const formatPrice = (unitPrice: number, weightStepKg?: number | null): string => {
  const value = Math.round(pricePerKg(Number(unitPrice) || 0, weightStepKg)).toLocaleString('en-US');
  return isByWeight({ weightStepKg }) ? `${value} د.ع / كغم` : `${value} د.ع`;
};

const trim = (n: number) => Number(n.toFixed(3)).toString();

// الكمية للعرض: 3 وحدات × 0.5 = «1.5 كغم» (أقل من كيلو بالغرام: «500 غ»)
export const formatQuantity = (quantity: number, weightStepKg?: number | null): string => {
  const step = Number(weightStepKg);
  if (!(step > 0)) return String(quantity);
  const kg = quantity * step;
  return kg < 1 ? `${Math.round(kg * 1000)} غ` : `${trim(kg)} كغم`;
};

// وصف الوحدة: «كل وحدة 500 غ»
export const stepLabel = (weightStepKg?: number | null): string => formatQuantity(1, weightStepKg);

// عدد القطع للعرض (شارة السلة): منتج الوزن قطعة واحدة مهما كان وزنه
export const countPieces = (items: { quantity: number; weightStepKg?: number | null }[] = []): number =>
  items.reduce((sum, i) => sum + (isByWeight(i) ? 1 : Number(i.quantity) || 0), 0);
