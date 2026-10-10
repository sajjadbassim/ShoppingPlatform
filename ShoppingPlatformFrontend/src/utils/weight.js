// البيع بالوزن: وحدة البيع = weightStepKg كغم (0.1 / 0.25 / 0.5 / 1)، والسعر والكمية والمخزون كلها بالوحدة.
// العرض للزبون: «1.5 كغم» بدل «3»، و«3,000 د.ع / كغم» بدل سعر الوحدة

const trim = (n) => Number(n.toFixed(3)).toString()

export const isByWeight = (item) => Number(item?.weightStepKg) > 0

// الكمية للعرض: 3 وحدات × 0.5 = «1.5 كغم» (أقل من كيلو بالغرام: «500 غ»)
export const formatQuantity = (quantity, weightStepKg) => {
  const step = Number(weightStepKg)
  if (!(step > 0)) return String(quantity)
  const kg = quantity * step
  return kg < 1 ? `${Math.round(kg * 1000)} غ` : `${trim(kg)} كغم`
}

// سعر الكيلو من سعر الوحدة
export const pricePerKg = (unitPrice, weightStepKg) => {
  const step = Number(weightStepKg)
  return step > 0 ? unitPrice / step : unitPrice
}

// نص السعر: «3,000 د.ع / كغم» للبيع بالوزن، وإلا «3,000 د.ع»
export const formatPrice = (unitPrice, weightStepKg) => {
  const value = Math.round(pricePerKg(Number(unitPrice) || 0, weightStepKg)).toLocaleString('en-US')
  return isByWeight({ weightStepKg }) ? `${value} د.ع / كغم` : `${value} د.ع`
}

// عدد القطع للعرض (شارة السلة، "N قطعة"): منتج الوزن قطعة واحدة مهما كان وزنه
// (كميته بالوحدات: 1 كغم بوحدة 100 غ = 10، فكان يُعدّ 10 قطع)
export const countPieces = (items = []) =>
  items.reduce((sum, i) => sum + (isByWeight(i) ? 1 : (Number(i.quantity) || 0)), 0)

// وصف الوحدة للبائع والزبون: «كل وحدة 500 غ»
export const stepLabel = (weightStepKg) => formatQuantity(1, weightStepKg)
