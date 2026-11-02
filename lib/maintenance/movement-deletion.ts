import { AppError, type User } from '../auth';
import { database } from '../store';
import { orderLines } from './order-lines';
export async function deleteMovement(user:User,id:string) {
  if(user.role!=='admin')throw new AppError('Seul l’admin peut supprimer un mouvement de stock.',403);
  if(typeof id!=='string'||!id)throw new AppError('Identifiant de mouvement obligatoire.');
  const db=database(),row=await db.prepare('SELECT * FROM movements WHERE id=?').bind(id).first<any>();
  if(!row)return;
  const savedCost=row.intervention?await db.prepare('SELECT unit_cost_cents FROM intervention_parts WHERE intervention=? AND part=?').bind(row.intervention,row.part).first<{unit_cost_cents:number|null}>():null;
  const created=new Date().toISOString(),ops=[];
  const receipt=id.startsWith('receipt-line:')?await db.prepare('SELECT order_id,line_id FROM purchase_line_receipts WHERE id=?').bind(id.slice('receipt-line:'.length)).first<any>()
    :id.startsWith('receipt:')?await db.prepare("SELECT p.order_id FROM purchase_receipts p JOIN records r ON r.id=p.order_id WHERE p.order_id=? OR json_extract(r.data,'$.receiptMovement')=?").bind(id.slice('receipt:'.length),id).first<any>():null;
  if(receipt) {
    const order=await db.prepare("SELECT data FROM records WHERE id=? AND kind='order'").bind(receipt.order_id).first<{data:string}>();
    if(order) {
      const previous=JSON.parse(order.data),lineId=receipt.line_id||'legacy';
      const lines=orderLines(previous).map(line=>line.id===lineId?{...line,received:false,receivedAt:'',receivedPart:'',part:row.part,receiptGeneration:(line.receiptGeneration||0)+1}:line);
      const received=lines.filter(line=>line.received).length;
      const next=previous.lines?{...previous,lines,status:received?'Partiellement reçu':'Commandé',receivedAt:'',receivedPart:'',revision:(previous.revision||0)+1}
        :{...previous,part:row.part,status:'Commandé',receivedAt:'',receivedPart:'',receiptMovement:'',receiptGeneration:(previous.receiptGeneration||0)+1,revision:(previous.revision||0)+1};
      ops.push(db.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=? AND kind='order'").bind(order.data,JSON.stringify(next),receipt.order_id));
    }
    ops.push(receipt.line_id?db.prepare('DELETE FROM purchase_line_receipts WHERE id=?').bind(id.slice('receipt-line:'.length))
      :db.prepare('DELETE FROM purchase_receipts WHERE order_id=?').bind(receipt.order_id));
  }
  if(row.intervention) {
    const report=await db.prepare('SELECT revision FROM interventions WHERE id=?').bind(row.intervention).first<{revision:number}>();
    if(report)ops.push(db.prepare('UPDATE interventions SET revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END,updated_at=?,updated_by=? WHERE id=?').bind(report.revision,created,user.id,row.intervention));
  }
  // The stock check and source updates share one transaction; a concurrent edit rolls everything back.
  ops.push(db.prepare(`INSERT INTO removed_movements(id,part,site,quantity,deleted_by,deleted_at)
    SELECT id,part,site,CASE WHEN COALESCE((SELECT SUM(quantity) FROM movements WHERE part=m.part AND id<>m.id),0)>=0 THEN quantity ELSE NULL END,?,?
    FROM movements m WHERE id=? ON CONFLICT(id) DO NOTHING`).bind(user.id,created,id));
  ops.push(db.prepare('DELETE FROM movements WHERE id=? AND EXISTS(SELECT 1 FROM removed_movements WHERE id=?)').bind(id,id));
  if(row.intervention) {
    // Reports follow actual remaining stock usage, so later edits/deletions cannot refund twice.
    ops.push(db.prepare('DELETE FROM intervention_parts WHERE intervention=? AND part=?').bind(row.intervention,row.part));
    ops.push(db.prepare(`INSERT INTO intervention_parts(id,intervention,part,name,reference,quantity,unit_cost_cents)
      SELECT ?,?,?,json_extract(r.data,'$.name'),COALESCE(json_extract(r.data,'$.reference'),''),-SUM(m.quantity),?
      FROM movements m JOIN records r ON r.id=m.part WHERE m.intervention=? AND m.part=? GROUP BY m.part HAVING SUM(m.quantity)<0`).bind(crypto.randomUUID(),row.intervention,row.part,savedCost?.unit_cost_cents??null,row.intervention,row.part));
  }
  try {await db.batch(ops);} catch(error) {
    if(String(error).includes('removed_movements.quantity'))throw new AppError('Cette suppression rendrait le stock négatif. Supprimez d’abord les sorties liées à cette entrée.',409);
    if(String(error).includes('records.data')||String(error).includes('interventions.revision'))throw new AppError('Le document lié a changé. Actualisez les mouvements avant de réessayer.',409);
    throw error;
  }
}
