import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';
export const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app), functions=getFunctions(app,'us-central1');
export const $=id=>document.getElementById(id);
export function say(message,type='notice',target='message'){const el=$(target);if(!el)return;el.className='notice '+type;el.textContent=message;el.classList.remove('hidden');}
export function setBusy(btn,busy,label='جارٍ التنفيذ...'){if(!btn)return;btn.disabled=busy;if(busy){btn.dataset.old=btn.textContent;btn.textContent=label}else{btn.textContent=btn.dataset.old||btn.textContent}}
export async function getProfile(user){const snap=await getDoc(doc(db,'users',user.uid));return snap.exists()?{uid:user.uid,...snap.data()}:null}
export function requireRole(roles,render){onAuthStateChanged(auth,async user=>{if(!user){location.href='index.html';return}try{const p=await getProfile(user);if(!p||!roles.includes(p.role)){await signOut(auth);alert('هذا الحساب غير مسموح له بالدخول إلى هذه الصفحة.');location.href='index.html';return}render(user,p)}catch(e){console.error(e);say('تعذر تحميل صلاحيات الحساب. راجعي اتصال الإنترنت وقواعد Firestore.','error')}})}
export async function logout(){await signOut(auth);location.href='index.html'}
export function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function csvFallback(rows,filename='attendance.csv'){const text='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();URL.revokeObjectURL(a.href)}
export {onAuthStateChanged,signInWithEmailAndPassword,signOut,doc,getDoc,collection,getDocs,query,where,orderBy,limit,httpsCallable};
