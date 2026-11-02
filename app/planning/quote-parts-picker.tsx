'use client';
import { useState } from 'react';
import { orderLines } from '../../lib/maintenance/order-lines';
import type { Row } from '../../lib/maintenance/types';
import type { Requirement } from '../../lib/planning/types';

export function QuotePartsPicker({ order, requirements, onApply, onCancel }: {
  order: Row; requirements: Requirement[];
  onApply: (lines: Requirement[]) => void; onCancel: () => void;
}) {
  const lines = orderLines(order);
  const [selection, setSelection] = useState<Requirement[]>(() => {
    const grouped = new Map<string | null, Requirement>();
    for (const r of requirements.filter(r => r.order === order.id)) {
      const id = r.orderLine || (lines.length === 1 ? lines[0].id : lines.find(l => l.id === 'legacy')?.id || null);
      const previous = grouped.get(id);
      grouped.set(id, {...r, orderLine: id, quantity: (previous?.quantity || 0) + r.quantity});
    }
    return [...grouped.values()];
  });
  const selected = (id: string) => selection.find(r => r.orderLine === id);
  const requirement = (id: string): Requirement => ({part: null, order: order.id, orderLine: id, quantity: 1});
  function toggle(id: string, checked: boolean) {
    setSelection(current => checked ? [...current, requirement(id)] : current.filter(r => r.orderLine !== id));
  }
  const chosen = lines.filter(line => selected(line.id));
  return <fieldset className="quote-parts-picker"><legend>Pièces du devis : {order.name}</legend>
    <div className="quote-parts-actions"><button type="button" onClick={() => setSelection(lines.map(line => selected(line.id) || requirement(line.id)))}>Tout cocher</button><button type="button" onClick={() => setSelection([])}>Tout décocher</button><small>{chosen.length} / {lines.length} pièce(s) sélectionnée(s)</small></div>
    <div className="quote-parts-list">{lines.map(line => <div className="quote-part-choice" key={line.id}>
      <label className="check"><input type="checkbox" checked={!!selected(line.id)} onChange={e => toggle(line.id, e.target.checked)}/><span>{line.name}{line.reference ? ' · ' + line.reference : ''}<small>{line.received ? 'Reçue' : 'En attente de réception'}{line.quantity ? ' · ' + line.quantity + ' au devis' : ''}</small></span></label>
      {selected(line.id) && <label>Quantité requise<input required type="number" min={1} max={1000000} value={selected(line.id)!.quantity} onChange={e => setSelection(current => current.map(r => r.orderLine === line.id ? {...r, quantity: Number(e.target.value)} : r))}/></label>}
    </div>)}</div>
    <small>Seules les pièces cochées seront liées à cette intervention. Les pièces déjà reçues restent sélectionnables.</small>
    <div className="quote-parts-actions"><button type="button" className="primary" disabled={!chosen.length || selection.some(r => !Number.isSafeInteger(r.quantity) || r.quantity < 1 || r.quantity > 1000000)} onClick={() => onApply(chosen.map(line => selected(line.id)!))}>Utiliser la sélection</button><button type="button" onClick={onCancel}>Annuler la sélection</button></div>
  </fieldset>;
}
