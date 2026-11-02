export type PdfCell={text:string;x:number;width:number};
export type PdfRow={page:number;y:number;cells:PdfCell[];text:string};
export type ImportLine={page?:number;id:string;name:string;reference:string;quantity:number|undefined;unitCostCents:number|null;part:string;source:string;warnings:string[]};
export type QuoteImport={name:string;supplier:string;status:'Devis'|'Commandé';lines:ImportLine[];warnings:string[];documentTotalCents:number|null;pages:number;text:string};
