# نظام الحضور والغياب — كلية طب الأسنان، جامعة المنوفية

مشروع أولي متكامل متعدد الصفحات، يعتمد على Firebase Authentication وCloud Firestore وCloud Functions. يحافظ على الهوية البصرية الزرقاء واللغة العربية RTL.

## الملفات
- `index.html`: تسجيل الدخول وتوجيه المستخدم حسب الدور.
- `student.html`: قراءة QR بالكاميرا، عرض سجل الطالب، تصدير Excel والطباعة.
- `doctor.html`: إنشاء جلسة QR بمدة صلاحية قصيرة، إغلاق الجلسة وعرض الجلسات.
- `admin.html`: إنشاء الحسابات عبر الخادم، تقارير الحضور، Excel والطباعة.
- `shared.js`, `styles.css`, `firebase-config.js`: ملفات مشتركة.
- `functions/index.js`: عمليات موثوقة لإنشاء المستخدمين والجلسات وتسجيل الحضور.
- `firestore.rules`: قواعد تمنع تعديل الحسابات والجلسات والحضور مباشرة من المتصفح.

## قبل النشر: مراجعة إعداد Firebase
لا يمكن لهذا المشروع أو للكود وحده قراءة إعدادات Firebase المنشورة أو التأكد من صلاحيات حسابك. راجعي في Firebase Console:
1. Authentication → Sign-in method: فعّلي Email/Password.
2. Authentication → Users: تأكدي من الحسابات الموجودة.
3. Firestore Database: تأكدي من قاعدة البيانات الصحيحة والمنطقة المستخدمة.
4. Project Settings → Your apps: طابقي `firebase-config.js` مع إعدادات تطبيق الويب.
5. Billing/Usage: نشر Cloud Functions يتطلب خطة فوترة مناسبة حسب سياسة Firebase الحالية.
6. App Check: فعّليه بعد اختباره وضبطه، ثم أضيفي التحقق منه إلى الدوال قبل الإنتاج.

## إعداد أول مدير (Bootstrap)
لأسباب أمنية لا توجد كلمة مرور مدير افتراضية. أنشئي مستخدمًا أولًا من Firebase Console → Authentication → Add user، ثم انسخي UID. افتحي Firestore وأنشئي وثيقة `users/{UID}` بالحقول التالية:

```json
{
  "name": "مدير النظام",
  "email": "admin@example.com",
  "role": "admin",
  "code": "ADMIN-001",
  "year": "",
  "courses": [],
  "createdAt": "استخدمي قيمة Timestamp من واجهة Firestore"
}
```

استخدمي البريد الفعلي للحساب. لا تضعي كلمة المرور في Firestore. بعد ذلك يستطيع المدير إنشاء الحسابات من صفحة الإدارة؛ الدالة تنشئ Auth account وملف Firestore معًا.

## نشر المشروع
ثبّتي Node.js 20 وFirebase CLI، ثم من مجلد المشروع:

```bash
npm install -g firebase-tools
firebase login
firebase use menoufia-dental-attendance
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions,hosting
```

يمكن استضافة الصفحات عبر Firebase Hosting (الملف `firebase.json` يضبط ذلك). إذا استُخدم GitHub Pages بدلًا منه، يجب نشر الصفحات وملفات JavaScript فقط على الموقع، ونشر Rules وFunctions منفصلًا من Firebase CLI. صفحات الويب يجب أن تعمل عبر HTTPS للسماح باستخدام الكاميرا.

## نموذج بيانات Firestore
- `users/{uid}`: `name`, `email`, `role` (`student`/`doctor`/`admin`), `code`, `year`, `courses` (مصفوفة أسماء مقررات مطابقة تمامًا لأسماء الجلسات).
- `sessions/{sessionId}`: ينشئها الخادم، وتتضمن `course`, `sessionType`, `createdBy`, `createdAt`, `expiresAt`, `status`, `attendanceCount`.
- `attendance/{sessionId_studentUid}`: ينشئها الخادم فقط، وبذلك يمنع التكرار لنفس الطالب والجلسة.

## نقاط يجب إكمالها/اختبارها قبل الاستخدام الرسمي
- دالة `checkInAttendance` تتحقق من تسجيل الطالب بالمقرر، وصلاحية الجلسة، وعدم تكرار حضوره. QR قصير الصلاحية يقلل إعادة الاستخدام لكنه لا يمنع مشاركة الرمز لحظيًا بشكل كامل. لمنع ذلك بدرجة أقوى يلزم رمز دوّار كل 15–30 ثانية مع تحدٍّ قصير العمر والتحقق من App Check، وقد يلزم تحقق حضور داخل القاعة حسب سياسة الكلية.
- واجهة Excel تستخدم مكتبة SheetJS من CDN؛ تأكدي من سياسة الشبكة/المتصفح أو استضيفي المكتبة محليًا للإنتاج.
- يجب اختبار صلاحيات Rules بحسابات طالب ومدرس ومدير منفصلة قبل إضافة بيانات حقيقية.
- لا توجد في النسخة الحالية آلية استيراد جماعي للطلاب، أو نظام اعتراضات/تعديل حضور بموافقة، أو سجل تدقيق إداري متكامل. أضيفيها قبل اعتماد النظام رسميًا إذا كانت مطلوبة.
- Cloud Functions لا يمكن نشرها أو اختبارها على مشروع المستخدم من هنا؛ يجب تشغيل خطوات النشر في بيئتك والتحقق من سجلات الدوال.
- لا تستخدمي بيانات طلاب حقيقية أثناء التجربة، وخذي نسخة احتياطية قبل أي تعديل لقواعد الإنتاج.
