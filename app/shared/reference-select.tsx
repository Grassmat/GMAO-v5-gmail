'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { visibleReferences, type ReferenceOption } from '../../lib/maintenance/reference-options';
export function ReferenceSelect({label,options,value,onChange,required=false,placeholder='Choisir…',multiple}:{label:string;options:ReferenceOption[];value:string;onChange:(value:string)=>void;required?:boolean;placeholder?:string;multiple?:{values:string[];onToggle:(value:string)=>void}}) {
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1),id=useId();
  const input=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null);
  const selected=options.find(o=>o.value===value);
  const {visible,total,limited}=visibleReferences(options,query,value);
  const choices=multiple?visible:[{value:'',label:placeholder,group:'Choix'},...visible];
  useEffect(()=>{input.current?.setCustomValidity(required&&!selected?'Choisissez une pièce ou un devis dans les résultats.':'');},[required,selected]);
  useEffect(()=>{if(open&&active>=0)document.getElementById(id+'-option-'+active)?.scrollIntoView({block:'nearest'});},[active,open,id]);
  function choose(option:ReferenceOption) {if(option.disabled)return;if(multiple){multiple.onToggle(option.value);return;}onChange(option.value);setOpen(false);setQuery('');setActive(-1);}
  function show(){setQuery('');setActive(-1);setOpen(true);}
  return <div className={'reference-select reference-combobox'+(multiple?' reference-multiple':'')} ref={root}>
    <label htmlFor={id}>{label}</label>
    <div className="reference-input">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id+'-results'} aria-activedescendant={open&&active>=0?id+'-option-'+active:undefined} aria-required={required} required={required} autoComplete="off" placeholder="Écrire un nom, une référence, un fournisseur…" value={open?query:multiple?(multiple.values.length?multiple.values.length+' pièce(s) cochée(s)':''):selected?.label||''}
        onFocus={show} onChange={e=>{setQuery(e.target.value);setActive(-1);setOpen(true);}}
        onBlur={e=>{if(!root.current?.contains(e.relatedTarget as Node)){setOpen(false);setQuery('');setActive(-1);}}}
        onKeyDown={e=>{
          if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){show();setActive(e.key==='ArrowDown'?0:choices.length-1);}else setActive(index=>e.key==='ArrowDown'?Math.min(index+1,choices.length-1):Math.max(index-1,0));}
          else if(e.key==='Enter'){e.preventDefault();if(open&&active>=0&&choices[active])choose(choices[active]);else if(!open)show();}
          else if(e.key==='Escape'){e.preventDefault();setOpen(false);setQuery('');setActive(-1);}
        }}/>
      <button type="button" tabIndex={-1} className="reference-toggle" aria-label="Afficher les pièces et devis" onMouseDown={e=>e.preventDefault()} onClick={()=>{if(open)setOpen(false);else{input.current?.focus();show();}}}><ChevronDown size={18}/></button>
    </div>
    <div id={id+'-results'} role="listbox" aria-multiselectable={multiple?true:undefined} aria-label={label} className="reference-options" hidden={!open}>
      {choices.map((option,index)=><div key={option.value}>
        {(multiple&&index===0||index>0&&option.group!==choices[index-1].group)&&<div className="reference-group">{option.group||'Résultats'}</div>}
        <button id={id+'-option-'+index} type="button" role="option" disabled={option.disabled} data-reference-value={option.value} tabIndex={-1} aria-selected={multiple?multiple.values.includes(option.value):value===option.value} className={active===index?'reference-option active':'reference-option'} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}>{multiple?<><span aria-hidden="true">{multiple.values.includes(option.value)?'☑ ':'☐ '}</span>{option.label}</>:option.label}</button>
      </div>)}
      <small role="status" className="reference-result-count">{!total?'Aucun résultat pour cette recherche.':limited?'50 résultats sur '+total+' : précisez votre recherche.':total+' résultat'+(total>1?'s':'')+'.'}</small>
    </div>
  </div>;
}
