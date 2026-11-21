# تقرير إصلاحات المتجر (oh9)

المصدر: [Al-SAFWA/store-template](https://github.com/Al-SAFWA/store-template)  
الفرع في هذا المستودع: `arena/6f49eb1b-oh9` (قيود Arena تمنع إنشاء/الدفع على `arena/site-fixes` أو `main`).

افتراض عام: عملنا على نسخة القالب داخل `oh9` كما طُلب («make a new files in the repo oh9»). لم يُدفع شيء إلى `Al-SAFWA/store-template`.

`build` / `lint` / `lint:js` / `format:check` / `typecheck` / الوحدة / smoke / db: نجحت بعد التعديلات.

---

## الخطوة 0 — فحص قبل التعديل (ما تحققنا منه في الكود)

- الفئات على الرئيسية (`theme.categories` + القائمة + «عرض الكل») كانت تشير إلى slugs قديمة (`restore-anniversary`, `refurbished-iphones`, …) بينما المنتجات في `data.js` تستخدم `special-offers`, `phones`, `android`, … → صفحات فئات فارغة.
- ترتيب الاسم في صفحة التصنيف كان يستدعي `title.localeCompare` على كائن ثنائي اللغة.
- شريط الإعلان: `restore.css` يلغي الـ marquee في `styles.css`، و`announce-slide` يحرّك الشريط بـ `translateY(-100%)` (layout shift).
- مسار الطلب يعمل (سلة ← checkout ← واتساب). رسائل التحقق عامة (`required`) وCSS للأخطاء موجود بدون عناصر في القالب، ومتغير `--error` غير معرّف.
- «10 أيام» و«بدون مخاطرة» و«150,000+» نصوص ثابتة في الحالة الافتراضية.
- حسابات التجار: القالب **نسخة معزولة لكل تاجر** (`npm run new-client`)، وليست منصة متعددة المتاجر.

---

## البنود

### 1. إصلاح الفئات — ✅ تم

**الخلل:** روابط الفئات/القائمة/أقسام الرئيسية لا تطابق `collections` الحقيقية → فلترة فارغة. العدّادات غير ظاهرة. الفئات المخفية تبقى في شريط الرئيسية. ترتيب A–Z ينكسر على العنوان ثنائي اللغة.

**ما أُصلح:**
- خريطة aliases للـ slugs القديمة → الحقيقية، تُحلّ في صفحة التصنيف وروابط «عرض الكل» وشريط الفئات.
- روابط افتراضية للقائمة وأقسام الرئيسية و`theme.categories` تشير إلى handles الكتالوج.
- عدّاد منتجات على كل بطاقة فئة؛ إخفاء الفئات `visible === false`؛ حالة فارغة كانت موجودة مسبقاً لصفحة التصنيف.
- ترتيب بالاسم عبر `ctx.L(title)`.

**ملفات:** `assets/js/domain/collection-aliases.js`, `assets/js/ui/storefront/10-home-sections.js`, `assets/js/services/01-default-texts.js`, `assets/js/services/01a-default-state.js`, `assets/css/restore.css`, `tests/collection-aliases.test.mjs`

✅ [إصلاح الفئات: روابط، فلترة، عدّادات، aliases، إخفاء الفارغ/المخفي]

---

### 2. تحسين الطلب — ✅ تم

**الخلل:** رسالة تحقق واحدة لكل الحقول الناقصة. أخطاء الحقل في CSS غير مربوطة. `--error` غير معرّف. عنوان المنتج في الملخص قد يظهر `[object Object]`.

**ما أُصلح:**
- رموز: `requiredName` / `requiredPhone` / `requiredAddress` + رسائل عربية/فرنسية.
- عناصر `.field-error` وclass `has-error` + `--error`.
- رسالة واتساب كانت أصلاً تتضمن الاسم والمنتجات × الكمية = السعر (`{name}`, `{items}`). أُضيف اختبار يؤكد ذلك.

**ملفات:** `12-checkout.js`, `12a-checkout-markup.js`, `12b-checkout-flow.js`, `assets/js/i18n/ar.js`, `fr.js`, `restore.css`, `tests/checkout-flow.test.mjs`

✅ [مسار الطلب: تحقق أوضح، رسالة واتساب فيها المنتج والكمية والسعر واسم العميل]

---

### 3. أنيميشن الشريط — ✅ تم

اختير **شريط الإعلان العلوي** (`.announcement`) وليس شريط الثقة.

- marquee CSS فقط: نسختان من النص داخل `.announce-track`، `transform` بدون تغيير الارتفاع (32px ثابت).
- `prefers-reduced-motion`: إيقاف الحركة وتوسيط النص.
- حذف `announce-slide` الذي كان يسبب layout shift.

**ملفات:** `04-header-footer.js`, `assets/css/restore.css`, `assets/css/styles.css`

✅ [حركة ناعمة لشريط الإعلان، بدون CLS، مع احترام تقليل الحركة]

---

### 4. إرجاع 10 أيام — ✅ تم

إعدادات: `settings.returnDays` (افتراضي 10) و`settings.returnEnabled` (افتراضي true).  
لوحة التحكم: **بيانات متجري**.

النصوص تُولَّد/تُستبدل عند العرض عبر `{returnDays}` ودالة `applyReturnDays` (شريط الثقة، الخدمات، صفحة المنتج، الصفحات، الأسئلة الشائعة).

**ملفات:** `store-policies.js`, `01a-default-state.js`, `01-default-texts.js`, `01-default-pages.js`, `15b-store-info.js`, صفحات الواجهة أعلاه، `tests/store-policies.test.mjs`

✅ [مدة الإرجاع إعداد قابل للتحكم، والنصوص المعروضة تتبع القيمة]

---

### 5. «مجدد» في متجر التجربة — ✅ تم (شرح فقط، بلا تغيير)

**المعنى في الكود:** المتجر قالب إلكترونيات **مجدّدة / reconditionné**. الكلمة ليست خطأ إملائياً ولا اسماً تجارياً عالقاً.

أماكن الظهور (عيّنة):
- `renewalText`: «ما معنى مجدد من {brand}؟» → صفحة `page.html?slug=renewed`
- أوصاف المنتجات في `01-default-texts.js` / `01b-default-products.js` («هاتف مجدد بالكامل…»)
- قسم الرئيسية `renewed` وعنوان لوحة التحكم «ما معنى مجدد»
- سياسة الصفحة `renewed`: تعريف الجهاز المستعمل بعد الفحص والإصلاح
- اختبارات e2e تستخدم «هواتف مجددة بضمان سنة» كنص مثال للسلايدر

لم تُغيَّر لأنها تصف نموذج العمل (أجهزة مفحوصة/معاد تأهيلها)، لا خطأ واضح.

✅ [شرح «مجدد»: reconditioned؛ لم تُغيَّر]

---

### 6. Anniversary → عروض — ✅ تم

كل نص معروض (قائمة، عنوان قسم الرئيسية، بطاقة الفئة، `COLLECTION_TITLES`) أصبح «عروض» / «Offres».

الـ slug الداخلي `anniversary` (id القسم) بقي. الروابط القديمة `collection.html?handle=restore-anniversary` تُحوَّل إلى `special-offers` عبر aliases (بدون كسر الإشارات المرجعية). لم يُضف redirect في Vercel لأن التحويل يتم في الواجهة.

✅ [استبدال Anniversary/أنيفرساري بـ عروض مع الإبقاء على الـ slug القديم كـ alias]

---

### 7. «بدون مخاطرة» — ✅ تم

`settings.noRisk`: `{ visible, title{ar,fr}, text{ar,fr} }`.  
تعديل من **بيانات متجري**. الواجهة تقرأ الشارة من الإعدادات وتخفيها إن `visible === false`. النص الفرعي يدعم `{returnDays}`.

✅ [الشارة قابلة للتعديل إظهاراً ونصاً من لوحة التحكم]

---

### 8. حذف 150000 — ✅ تم (ما يُعرض للمستخدم)

| ملف | سطر (تقريبي) | الإجراء |
| --- | --- | --- |
| `assets/js/services/01a-default-state.js` | `trustTitle` | «آلاف العملاء يثقون بنا» |
| `assets/js/i18n/ar.js` | `trustedBy` | نفس المعنى بدون رقم |
| `assets/js/i18n/fr.js` | `trustedBy` | «Des milliers de clients…» |

**لم يُحذف (ليس نص واجهة):**
- `assets/js/services/03-shared-utils.js`: تكرار PBKDF2 = **150000** (تجزئة كلمات المرور).
- أسعار منتجات في SQL/اختبارات DB (مثل 125000) سجلات بيانات لا نص تسويقي.

✅ [حذف 150,000 من النصوص المعروضة؛ الإبقاء على تكرار PBKDF2]

---

### 9. المنتجات — ✅ تم

أُضيفت 5 منتجات تجريبية عبر `scripts/demo/make-demo-catalog.mjs` ثم `data.js` و`supabase/ALL_IN_ONE.sql`:

| handle | الفئة | سعر | مخزون | صورة |
| --- | --- | --- | --- | --- |
| `demo-phone-plus` | phones | 8500 | 14 | SVG placeholder |
| `demo-laptop-office` | laptops | 14500 | 8 | SVG |
| `demo-earbuds-pro` | audio | 2200 | 22 | SVG |
| `demo-watch-sport` | watches | 3800 | 11 | SVG |
| `demo-tablet-pro` | tablets | 9200 | 9 | SVG |

كل واحد: اسم، سعر، وصف عربي (وفرنسي)، صورة، مخزون. الطبقة: RAW catalog + `buildProduct` (يحترم `raw.stock` و`raw.description`).

✅ [5 منتجات في 5 فئات بحقول كاملة]

---

### 10. حسابات التجار — ⚠️ جزئي

النظام **لا** يدعم عدة تجار في نفس النشر بحيث «كل حساب يرى متجره فقط». العزل الموجود:

```
npm run new-client   # نسخة كاملة: مجلد + git + Supabase + نطاق
```

فريق لوحة التحكم (`owner` / `manager`) يشتركون في **نفس** المتجر.

ما ينقص لبناء متعدد المستأجرين: جدول متاجر، `store_id` على المنتجات/الطلبات، RLS، تسجيل تاجر، توجيه نطاق/مفتاح.

لم يُبنَ نظام كامل. أُضيف `scripts/demo/merchants.json` (3 ملفات تعريف بلا كلمات مرور) و`.env.example` بحقول فارغة.

**حسابات تجريبية مولَّدة (في التقرير فقط، ليست في git):**

| التاجر | الأمر | بريد مقترح | كلمة مرور مولَّدة |
| --- | --- | --- | --- |
| متجر الشمال | `npm run new-client -- --key merchant-nord --ar "متجر الشمال" --fr "Boutique Nord"` | nord@example.com | `N0rd-Store#7qK2` |
| متجر الوسط | `--key merchant-centre` | centre@example.com | `C3ntre-Shop#9mL4` |
| متجر الجنوب | `--key merchant-sud` | sud@example.com | `Sud-Boutique#2pX8` |

لوحة التحكم **المحلية** (بعد `demoEnabled: true` على localhost فقط): المستخدم `owner` أو `manager`؛ في أول دخول تختار كلمة مرور (≥8 مع أحرف وأرقام). لا توجد كلمة مرور مشحونة في المستودع.

✅ [توثيق الآلية + 3 ملفات تعريف؛ بدون بناء multi-tenant]

---

## مشاكل وُجدت ولم تُصلح (خارج البنود أو أعمق من المطلوب)

- القوائم الفرعية للآيفون/سامسونج تبحث عن «iPhone 16» و«S24» بينما كتالوج التجربة بأسماء Demo — روابط بحث قد ترجع صفراً.
- `demoEnabled` يبقى `false` في الإنتاج عن قصد.
- رقم واتساب الافتراضي وهمي (`22200000000`) حتى يعبّئه التاجر.
- إن وُجدت حالة قديمة في `localStorage` (`restore_state_v1`) قد تُبقي نصوص Anniversary/150000 حتى «إعادة تعيين التجربة».
- لا يوجد تحويل HTTP 301 على Vercel لـ `?handle=restore-anniversary` (يُعالج في JS).

---

## تشغيل المشروع

```bash
cd oh9
npm install
node scripts/serve.mjs --port 8100 --host 0.0.0.0
```

- المتجر: `/` أو `index.html`
- الفئات: `collection.html?handle=phones` (أو `special-offers` للعروض)
- المنتج: `product.html?handle=demo-phone-plus`
- السلة/الطلب: `checkout.html`
- لوحة التحكم: `dashboard.html` (للتجربة المحلية ضع `demoEnabled: true` في `assets/js/config.js` وعلى localhost فقط)
- الحساب: `account.html`

فحص الجودة: `npm run check`

لا تضع مفاتيح `service_role` في المستودع. `.env` للقيم الحقيقية؛ `.env.example` فارغ.
