const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');
initializeApp();
const db = getFirestore();
async function profileFor(uid) { const s = await db.collection('users').doc(uid).get(); return s.exists ? s.data() : null; }
async function requireRole(uid, roles) { const p = await profileFor(uid); if (!p || !roles.includes(p.role)) throw new HttpsError('permission-denied','صلاحيات الحساب لا تسمح بتنفيذ العملية.'); return p; }
exports.createManagedUser = onCall({ region:'us-central1', enforceAppCheck:false }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated','يجب تسجيل الدخول.'); await requireRole(req.auth.uid,['admin']);
  const {name,email,password,role,code='',year='',courses=[]}=req.data||{};
  if (!name || !email || !password || !['student','doctor','admin'].includes(role) || String(password).length<8) throw new HttpsError('invalid-argument','أدخلي الاسم والبريد وكلمة مرور من 8 أحرف على الأقل ودورًا صحيحًا.');
  if (!Array.isArray(courses) || courses.length>100) throw new HttpsError('invalid-argument','قائمة المقررات غير صالحة.');
  let user;
  try { user=await getAuth().createUser({displayName:String(name).slice(0,120),email:String(email).trim().toLowerCase(),password:String(password),emailVerified:false,disabled:false});
    await db.collection('users').doc(user.uid).set({name:String(name).slice(0,120),email:user.email,role,code:String(code).slice(0,50),year:String(year).slice(0,30),courses:courses.map(x=>String(x).slice(0,120)),createdAt:FieldValue.serverTimestamp(),createdBy:req.auth.uid,forcePasswordChange:true});
    return {uid:user.uid,email:user.email};
  } catch(e) { if(user) { try { await getAuth().deleteUser(user.uid); } catch(_) {} } if(e.code==='auth/email-already-exists') throw new HttpsError('already-exists','هذا البريد مسجل بالفعل.'); throw new HttpsError('internal','تعذر إنشاء الحساب. راجعي سجلات Cloud Functions.'); }
});
exports.createAttendanceSession = onCall({ region:'us-central1', enforceAppCheck:false }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated','يجب تسجيل الدخول.'); await requireRole(req.auth.uid,['doctor','admin']);
  const {course,sessionType,durationMinutes}=req.data||{};
  if (!course || !['lecture','section','lab'].includes(sessionType) || ![2,5,10].includes(Number(durationMinutes))) throw new HttpsError('invalid-argument','بيانات الجلسة غير صحيحة.');
  const now=Date.now(), expiresAt=Timestamp.fromMillis(now+Number(durationMinutes)*60*1000), ref=db.collection('sessions').doc();
  await ref.set({course:String(course).slice(0,120),sessionType,createdBy:req.auth.uid,createdAt:FieldValue.serverTimestamp(),expiresAt,status:'open',attendanceCount:0,nonce:crypto.randomBytes(16).toString('hex')});
  return {sessionId:ref.id,expiresAt:expiresAt.toMillis()};
});
exports.closeAttendanceSession = onCall({ region:'us-central1', enforceAppCheck:false }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated','يجب تسجيل الدخول.'); await requireRole(req.auth.uid,['doctor','admin']);
  const {sessionId}=req.data||{}; if(!sessionId) throw new HttpsError('invalid-argument','معرّف الجلسة مطلوب.');
  const ref=db.collection('sessions').doc(sessionId); const s=await ref.get(); if(!s.exists) throw new HttpsError('not-found','الجلسة غير موجودة.');
  if(s.data().createdBy!==req.auth.uid && (await profileFor(req.auth.uid)).role!=='admin') throw new HttpsError('permission-denied','لا يمكنك إنهاء جلسة أنشأها مستخدم آخر.');
  await ref.update({status:'closed',closedAt:FieldValue.serverTimestamp(),closedBy:req.auth.uid}); return {ok:true};
});
exports.checkInAttendance = onCall({ region:'us-central1', enforceAppCheck:false }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated','يجب تسجيل الدخول أولًا.'); const student=await requireRole(req.auth.uid,['student']);
  const {sessionId}=req.data||{}; if(!sessionId || typeof sessionId!=='string' || sessionId.length>150) throw new HttpsError('invalid-argument','رمز QR غير صالح.');
  const sessionRef=db.collection('sessions').doc(sessionId), attendanceRef=db.collection('attendance').doc(`${sessionId}_${req.auth.uid}`);
  return await db.runTransaction(async tx=>{
    const ss=await tx.get(sessionRef); if(!ss.exists) throw new HttpsError('not-found','الجلسة غير موجودة.'); const s=ss.data();
    if(s.status!=='open' || !s.expiresAt || s.expiresAt.toMillis()<=Date.now()) throw new HttpsError('failed-precondition','انتهت صلاحية رمز QR أو أُغلقت الجلسة.');
    const courses=Array.isArray(student.courses)?student.courses:[]; if(!courses.includes(s.course)) throw new HttpsError('permission-denied','هذا المقرر غير موجود ضمن مقررات حسابك. راجعي الإدارة إذا كان ذلك خطأ.');
    const old=await tx.get(attendanceRef); if(old.exists) throw new HttpsError('already-exists','تم تسجيل حضورك في هذه الجلسة من قبل.');
    tx.create(attendanceRef,{sessionId,studentId:req.auth.uid,createdBy:s.createdBy,course:s.course,sessionType:s.sessionType,status:'حاضر',createdAt:FieldValue.serverTimestamp()});
    tx.update(sessionRef,{attendanceCount:FieldValue.increment(1)}); return {ok:true,message:'تم تسجيل الحضور بنجاح.'};
  });
});
