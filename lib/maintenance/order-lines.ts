import type { OrderLine, Row } from './types';
// Legacy quotes remain readable without a data rewrite or retroactive stock receipt.
export function orderLines(order: Partial<Row>): OrderLine[] {
  if (Array.isArray(order.lines)) return order.lines;
  return [{id:'legacy',name:order.name||'',reference:order.reference||'',location:order.location||'',part:order.part||'',
    unitCostCents:order.unitCostCents??null,supplierReference:order.supplierReference||'',quantity:order.quantity,machine:order.machine||'',received:order.status==='Reçu'||!!order.receivedAt,
    receivedAt:order.receivedAt||'',receivedPart:order.receivedPart||''}];
}
export function orderLineLabel(order: Partial<Row>, lineId?: string | null) {
  const lines=orderLines(order),line=lineId?lines.find(l=>l.id===lineId):lines.length===1?lines[0]:undefined;
  return line ? [line.name,line.reference].filter(Boolean).join(' · ') : order.name||'Devis';
}

export function linkedOrderLine(order: Partial<Row>,id?:string|null) {
  const lines=orderLines(order);
  return id?lines.find(l=>l.id===id):lines.length===1?lines[0]:lines.find(l=>l.id==='legacy');
}
