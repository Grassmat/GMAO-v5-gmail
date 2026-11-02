'use client';
import { money,priceInput,priceCents } from '../../lib/maintenance/pricing';
import { ReferenceSelect } from '../shared/reference-select';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { PartUsageInput, StockPart } from '../../lib/interventions/types';

export const normalizePartSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matchingParts(parts: StockPart[], query: string, machines: string[], filters:{category?:string;compatibleOnly?:boolean}={}) {
  const words = normalizePartSearch(query).trim().split(/\s+/).filter(Boolean);
  const compatible = (part: StockPart) => part.machines.some(id => machines.includes(id));
  return parts.filter(part => (!filters.compatibleOnly||compatible(part))&&(!filters.category||(filters.category==='none'?!part.category:part.category===filters.category))&&words.every(word => normalizePartSearch(`${part.name} ${part.reference} ${part.supplier} ${part.location} ${part.categoryName||''}`).includes(word)))
    .sort((a, b) => Number(compatible(b)) - Number(compatible(a)) || a.name.localeCompare(b.name, 'fr'));
}

export function PartsPicker({ site, machines, value, onChange, onSessionChanged, disabled, baseline = [] }: {
  baseline?: PartUsageInput[]; site: string; machines: string[]; value: PartUsageInput[]; onChange: (value: PartUsageInput[]) => void;
  onSessionChanged: () => void; disabled: boolean;
}) {
  const [stock, setStock] = useState<StockPart[]>([]);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [category,setCategory]=useState(''),[compatibleOnly,setCompatibleOnly]=useState(false),[checked,setChecked]=useState<string[]>([]);
  const requestNumber = useRef(0);
  const load = useCallback(async () => {
    const number = ++requestNumber.current;
    try {
      const response = await fetch('/api/interventions/stock?site=' + encodeURIComponent(site));
      const data = await response.json() as { parts: StockPart[]; error?: string };
      if (number !== requestNumber.current) return;
      if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
      if (!response.ok) throw new Error(data.error || 'Stock indisponible.');
      setStock(data.parts); setError('');
    } catch (cause) { if (number === requestNumber.current) setError(cause instanceof Error ? cause.message : 'Stock indisponible.'); }
    finally { if (number === requestNumber.current) setLoading(false); }
  }, [site, onSessionChanged]);
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => { clearInterval(interval); requestNumber.current++; };
  }, [load]);
  const available = stock.map(part => ({ ...part,quantity:part.quantity + (baseline.find(line => line.part === part.id)?.quantity || 0) }));
  for (const line of baseline) if (line.part && !available.some(part => part.id === line.part)) available.push({id:line.part,name:line.name || '',reference:line.reference || '',quantity:line.quantity,machines:[],supplier:'',location:''});
  const families=Array.from(new Map(available.filter(p=>p.category&&p.categoryName).map(p=>[p.category!,p.categoryName!])).entries()).sort((a,b)=>a[1].localeCompare(b[1],'fr'));
  const options = matchingParts(available, '', machines,{category,compatibleOnly:compatibleOnly&&machines.length>0}).filter(part => !value.some(line => line.part === part.id));
  function togglePart(id:string){
    const part=available.find(p=>p.id===id);if(!part||part.quantity<1||value.some(line=>line.part===id))return;
    setChecked(previous=>previous.includes(id)?previous.filter(p=>p!==id):[...previous,id]);
  }
  function addStockParts(){
    const selected=checked.map(id=>available.find(p=>p.id===id)).filter((p):p is StockPart=>!!p&&!value.some(line=>line.part===p.id));
    if(selected.length!==checked.length||selected.some(p=>p.quantity<1)){setError('Le stock a changé. Vérifiez les pièces cochées ou effacez la sélection.');return;}
    if(value.length+selected.length>100){setError('Un rapport peut contenir au maximum 100 pièces. Réduisez la sélection.');return;}
    onChange([...value,...selected.map(part=>({part:part.id,name:part.name,reference:part.reference,unitCostCents:part.unitCostCents??null,quantity:1}))]);
    setChecked([]);setError('');
  }
  function update(index: number, patch: Partial<PartUsageInput>) {
    onChange(value.map((line, i) => i === index ? { ...line, ...patch } : line));
  }
  return <section className="parts-picker" aria-label="Pièces utilisées">
    <div className="panel-head"><h3>Pièces utilisées</h3><button type="button" disabled={disabled || loading} onClick={load}><RefreshCw size={15} />Actualiser le stock</button></div>
    {!!baseline.length && <p className="muted">Les quantités déjà prélevées par ce rapport sont incluses dans la disponibilité affichée. Seule la différence sera prélevée ou restituée.</p>}
    <p className="muted">Cochez les références souhaitées, puis ajoutez la sélection au rapport. Ajustez les quantités ci-dessous. Les pièces du stock seront déduites à l’enregistrement du rapport. Pour une pièce non référencée, indiquez le total disponible avant utilisation : sa référence sera créée dans le magasin et la quantité utilisée sera déduite.</p>
    <fieldset disabled={disabled||loading||value.length>=100} className="stock-picker-controls" onKeyDown={event => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) event.preventDefault();
    }}><legend>Prélever dans le stock du site</legend>
      <div className="parts-search-filters"><label>Famille / sous-ensemble<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes les familles</option><option value="none">Sans famille</option>{families.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className="check"><input type="checkbox" checked={compatibleOnly} disabled={!machines.length} onChange={e=>setCompatibleOnly(e.target.checked)}/>Pièces affectées aux machines de l’intervention</label></div>
      <ReferenceSelect label="Références du stock" value="" placeholder={loading?'Chargement du stock…':'Choisir une pièce…'} onChange={togglePart} multiple={{values:checked,onToggle:togglePart}} options={options.map(part=>({value:part.id,label:(part.machines.some(id=>machines.includes(id))?'Compatible · ':'')+part.name+' · '+(part.reference||'Sans référence')+' · Stock : '+part.quantity,searchText:[part.name,part.reference,part.supplier,part.location,part.categoryName||''].join(' '),group:part.categoryName||'Sans famille',disabled:part.quantity<=0}))}/><small>Les références compatibles avec les machines choisies apparaissent en premier.</small>
      <div className="parts-selection-actions"><button type="button" className="primary" disabled={!checked.length} onClick={addStockParts}>Ajouter la sélection ({checked.length})</button>{!!checked.length&&<button type="button" onClick={()=>setChecked([])}>Effacer la sélection</button>}</div>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="used-parts">{value.map((line, index) => {
      const current = line.part ? available.find(part => part.id === line.part) : null;
      const unavailable = line.part && !loading && (!current || line.quantity > current.quantity);
      return <div key={line.part || 'unlisted-' + index} className="used-part">
        <div className="panel-head"><strong>{line.part ? line.name : 'Pièce non référencée'}</strong><button type="button" disabled={disabled} aria-label={'Retirer ' + (line.name || 'la pièce non référencée')} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={15} />Retirer</button></div>
        {line.part ? <small>{line.reference || 'Sans référence'} · Stock disponible : {current?.quantity ?? '—'}</small> : <div className="fields"><label>Nom de la pièce *<input required maxLength={150} disabled={disabled} value={line.name || ''} onChange={e => update(index, { name: e.target.value })} /></label><label>Référence (facultatif)<input maxLength={200} disabled={disabled} value={line.reference || ''} onChange={e => update(index, { reference: e.target.value })} /></label><label>Fournisseur (facultatif)<input maxLength={200} disabled={disabled} value={line.supplier || ''} onChange={e=>update(index,{supplier:e.target.value})}/></label></div>}
        {!line.part&&<label>Quantité en magasin avant utilisation *<input type="number" min={line.quantity||1} max={1000000} step="1" required disabled={disabled} value={line.stockQuantity??''} onChange={e=>update(index,{stockQuantity:e.target.value===''?undefined:Number(e.target.value)})}/><small>Total disponible, pièces utilisées comprises.</small></label>}
        <label>Quantité utilisée *<input type="number" min="1" max={current ? current.quantity : line.stockQuantity??1000000} step="1" required disabled={disabled} value={line.quantity || ''} onChange={e => update(index, { quantity: Number(e.target.value) })} /></label>
        {line.part?<small>Prix indicatif : {money(line.unitCostCents??current?.unitCostCents)} HT · prix conservé à l’enregistrement.</small>:<label>Prix unitaire (€ HT, facultatif)<input type="number" min={0} max={1000000} step="0.01" disabled={disabled} value={priceInput(line.unitCostCents)} onChange={e=>update(index,{unitCostCents:priceCents(e.target.value)})}/></label>}
        {!line.part&&line.stockQuantity!==undefined&&<p className={line.stockQuantity<line.quantity?'error':'muted'} role={line.stockQuantity<line.quantity?'alert':undefined}>{line.stockQuantity<line.quantity?'La quantité disponible doit couvrir les pièces utilisées.':'Stock après intervention : '+(line.stockQuantity-line.quantity)+' · référence créée à l’enregistrement.'}</p>}
        {unavailable && <p role="alert" className="error">Stock insuffisant pour cette quantité. Ajustez-la ou retirez la ligne.</p>}
      </div>;
    })}</div>
    <button type="button" disabled={disabled || value.length >= 100} onClick={() => onChange([...value, { part: null, name: '', reference: '', quantity: 1,stockQuantity:1 }])}><Plus size={16} />Ajouter une pièce non référencée</button>
  </section>;
}
