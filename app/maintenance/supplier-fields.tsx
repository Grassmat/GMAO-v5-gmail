'use client';
import type { SupplierOffer } from '../../lib/maintenance/types';
import { priceCents, priceInput, money } from '../../lib/maintenance/pricing';
export function SupplierFields({draft,onChange}:{draft:any;onChange:(patch:any)=>void}) {
 const offers:SupplierOffer[]=draft.suppliers??(draft.supplier?[{id:'primary',name:draft.supplier,reference:draft.reference||'',unitCostCents:draft.unitCostCents??null}]:[]);
 const change=(id:string,patch:Partial<SupplierOffer>)=>onChange({suppliers:offers.map(o=>o.id===id?{...o,...patch}:o)});
 return <>
 <label>Prix unitaire de référence (€ HT, facultatif)<input type="number" min={0} max={1000000} step="0.01" value={priceInput(draft.unitCostCents)} onChange={e=>onChange({unitCostCents:priceCents(e.target.value)})}/><small>Utilisé pour chiffrer les prochaines pièces consommées. Les rapports déjà enregistrés conservent leur prix.</small></label>
 <details className="supplier-offers" open={offers.length>1||undefined}><summary>Fournisseurs de cette pièce ({offers.length})</summary><p className="muted">Même pièce et même stock ; chaque fournisseur peut avoir sa référence et son prix.</p>
 {offers.map(offer=><fieldset key={offer.id}><legend>Fournisseur</legend><label>Nom *<input required maxLength={200} value={offer.name} onChange={e=>change(offer.id,{name:e.target.value})}/></label><label>Référence chez ce fournisseur<input maxLength={200} value={offer.reference} onChange={e=>change(offer.id,{reference:e.target.value})}/></label><label>Prix unitaire (€ HT)<input type="number" min={0} max={1000000} step="0.01" value={priceInput(offer.unitCostCents)} onChange={e=>change(offer.id,{unitCostCents:priceCents(e.target.value)})}/></label>{offer.unitCostCents!=null&&<button type="button" onClick={()=>onChange({unitCostCents:offer.unitCostCents})}>Utiliser ce prix comme référence</button>}<button type="button" onClick={()=>onChange({suppliers:offers.filter(o=>o.id!==offer.id)})}>Retirer ce fournisseur</button></fieldset>)}
 <button type="button" onClick={()=>onChange({suppliers:[...offers,{id:crypto.randomUUID(),name:'',reference:'',unitCostCents:null}]})}>Ajouter un fournisseur</button></details></>;
}
export function SupplierChoice({part,onSelect}:{part:any;onSelect:(offer:SupplierOffer)=>void}) {
 const offers:SupplierOffer[]=part?.suppliers??(part?.supplier?[{id:'primary',name:part.supplier,reference:part.reference||'',unitCostCents:part.unitCostCents??null}]:[]);
 if(!offers.length)return null;
 return <label>Fournisseur enregistré (facultatif)<select defaultValue="" onChange={e=>{const offer=offers.find(o=>o.id===e.target.value);if(offer)onSelect(offer);}}><option value="">Choisir ou saisir librement ci-dessous…</option>{offers.map(o=><option key={o.id} value={o.id}>{o.name} · {o.reference||'Sans référence fournisseur'} · {money(o.unitCostCents)}</option>)}</select></label>;
}
