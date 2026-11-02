import { currentUser,sameOrigin,AppError } from '../../../../../lib/auth';
import { appOrigin,finishGoogleConnection } from '../../../../../lib/mail/configuration';
export async function POST(req:Request){
 let message='Connexion Gmail terminée.';
 try{sameOrigin(req);const user=await currentUser(req),text=await req.text();if(text.length>10000)throw new AppError('Autorisation trop volumineuse.');const data=new URLSearchParams(text),cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-gmao_google='))?.slice('__Host-gmao_google='.length)||'';const result=await finishGoogleConnection(user,data.get('state')||'',cookie,data.get('code')||'');message='Boîte connectée : '+result.sender;}catch(e){message=e instanceof AppError?e.message:'Connexion Gmail indisponible. Réessayez.';}
 return new Response(null,{status:303,headers:{Location:appOrigin()+'/#mail-setup='+encodeURIComponent(message),'Set-Cookie':'__Host-gmao_google=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
