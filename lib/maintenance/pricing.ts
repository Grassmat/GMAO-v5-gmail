export const money = (cents:number|null|undefined) => cents==null?'Prix non renseigné':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
export const priceInput = (cents:number|null|undefined) => cents==null?'':cents/100;
export const priceCents = (value:string) => value===''?null:Math.round(Number(value)*100);
export function stockValuation(parts:{id:string;unitCostCents?:number|null}[],quantity:(id:string)=>number) {
 let cents=0,missing=0;
 for(const part of parts){const count=quantity(part.id);if(count===0)continue;if(part.unitCostCents==null)missing++;else cents+=part.unitCostCents*count;}
 return {cents,missing};
}
export function orderTotal(order:{unitCostCents?:number|null;quantity?:number;lines?:{unitCostCents?:number|null;quantity?:number}[]}) {
 const lines=order.lines||[order];let cents=0,missing=0;
 for(const line of lines){if(line.unitCostCents==null||line.quantity==null)missing++;else cents+=line.unitCostCents*line.quantity;}
 return {cents,missing};
}
