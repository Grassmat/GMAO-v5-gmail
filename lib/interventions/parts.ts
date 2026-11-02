import { stockMovementStatement } from '../maintenance/stock';
import type { User } from '../auth';
import { validPrice } from '../maintenance/suppliers';
import { database } from '../store';
import { AppError } from '../auth';
import type { PartUsage } from './types';

export type PreparedPartUsage = PartUsage & {supplier?:string;stockQuantity?:number};

// Stock references are resolved on the server. User-provided names never identify a stock item.
export async function validatePartUsage(site: string, input: unknown, previous: PartUsage[] = []): Promise<PreparedPartUsage[]> {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100) throw new AppError('Cent lignes de pièces maximum.');
  const seen = new Set<string>(),newReferences=new Set<string>();
  const result: PreparedPartUsage[] = [];
  for (const line of input) {
    if (!line || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000)
      throw new AppError('Chaque pièce doit avoir une quantité entière positive.');
    if (line.part === null) {
      if (typeof line.name !== 'string' || !line.name.trim() || line.name.length > 150 ||
          (line.reference !== undefined && (typeof line.reference !== 'string' || line.reference.length > 200)))
        throw new AppError('Indiquez le nom de la pièce non référencée (150 caractères maximum).');
      if(line.supplier!==undefined&&(typeof line.supplier!=='string'||line.supplier.length>200))throw new AppError('Le fournisseur est limité à 200 caractères.');
      if(line.stockQuantity!==undefined){
        if(!Number.isSafeInteger(line.stockQuantity)||line.stockQuantity<line.quantity||line.stockQuantity>1000000)throw new AppError('La quantité en magasin avant utilisation doit être un entier au moins égal à la quantité utilisée (1 000 000 maximum).');
        const identity=(line.reference||'').trim()?('ref:'+(line.reference||'').trim().toLowerCase()):('name:'+line.name.trim().toLowerCase());
        if(newReferences.has(identity))throw new AppError('Ajoutez cette nouvelle référence une seule fois et regroupez ses quantités.');
        newReferences.add(identity);
        if(await existingUnlistedPart(site,line.name.trim(),(line.reference||'').trim()))throw new AppError('Cette pièce existe déjà dans le magasin. Sélectionnez sa référence dans le stock au lieu de la recréer.',409);
      }
      result.push({ supplier:(line.supplier||'').trim(),...(line.stockQuantity!==undefined?{stockQuantity:line.stockQuantity}:{}),unitCostCents:validPrice(line.unitCostCents), part: null, name: line.name.trim(), reference: (line.reference || '').trim(), quantity: line.quantity });
      continue;
    }
    if (typeof line.part !== 'string' || !line.part || seen.has(line.part))
      throw new AppError('Sélectionnez chaque référence du stock une seule fois et ajustez sa quantité.');
    seen.add(line.part);
    const row = await database().prepare("SELECT site,data FROM records WHERE id=? AND kind='part'")
      .bind(line.part).first<{ site: string; data: string }>();
    if (!row || row.site !== site || (JSON.parse(row.data).deleted && !previous.some(p => p.part === line.part && p.quantity >= line.quantity))) throw new AppError('Cette pièce est absente ou supprimée du stock du site.', 403);
    const data = JSON.parse(row.data);
    result.push({ unitCostCents:previous.some(p=>p.part===line.part)?previous.find(p=>p.part===line.part)!.unitCostCents??null:validPrice(data.unitCostCents), part: line.part, name: data.name, reference: data.reference || '', quantity: line.quantity });
  }
  return result;
}

// Reference matching is scoped to the site and active catalogue. Empty references use the name.
export async function existingUnlistedPart(site:string,name:string,reference:string){
 return database().prepare(`SELECT id FROM records WHERE kind='part' AND site=? AND COALESCE(json_extract(data,'$.deleted'),0)=0
   AND CASE WHEN ?<>'' THEN lower(trim(COALESCE(json_extract(data,'$.reference'),'')))=lower(?)
     ELSE trim(COALESCE(json_extract(data,'$.reference'),''))='' AND lower(trim(json_extract(data,'$.name')))=lower(?) END LIMIT 1`)
  .bind(site,reference,reference,name).first<{id:string}>();
}
export function unlistedPartStatements(user:User,site:string,part:PreparedPartUsage,machines:string[],created:string){
 const id=crypto.randomUUID(),quantity=part.stockQuantity!;
 const data={name:part.name,reference:part.reference,machines,unitCostCents:part.unitCostCents??null,location:'',supplier:part.supplier||'',minimum:0,deleted:false};
 // The duplicate check and initial stock share the report's transaction. Failure leaves no orphan reference.
 const write=database().prepare(`INSERT INTO records(id,kind,site,data) VALUES(?,'part',?,CASE WHEN NOT EXISTS(
   SELECT 1 FROM records WHERE kind='part' AND site=? AND COALESCE(json_extract(data,'$.deleted'),0)=0
   AND CASE WHEN ?<>'' THEN lower(trim(COALESCE(json_extract(data,'$.reference'),'')))=lower(?)
     ELSE trim(COALESCE(json_extract(data,'$.reference'),''))='' AND lower(trim(json_extract(data,'$.name')))=lower(?) END
 ) THEN ? ELSE NULL END)`).bind(id,site,site,part.reference,part.reference,part.name,JSON.stringify(data));
 // Initial inventory is independent of consumption: deleting the report restores the used quantity only.
 const initial=stockMovementStatement({id:'initial:'+id,part:id,site,quantity,machine:null,reason:'Stock initial · pièce créée depuis un rapport',actor:user.name,created});
 return {id,ops:[write,initial]};
}
