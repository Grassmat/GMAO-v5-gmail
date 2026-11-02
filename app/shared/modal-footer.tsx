'use client';
import type {ReactNode} from 'react';

export function ModalFooter({onClose,disabled=false,children}:{onClose:()=>void;disabled?:boolean;children?:ReactNode}){
 return <div className="modal-footer"><div className="modal-footer-actions">{children}</div><button type="button" disabled={disabled} onClick={onClose}>Fermer</button></div>;
}
