export function manualMovement(m:{id:string;intervention?:string|null}) {
  return !m.intervention && !m.id.startsWith('receipt:') && !m.id.startsWith('receipt-line:') && !m.id.startsWith('return:');
}
