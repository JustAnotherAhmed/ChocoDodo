// ============================================
// ChocoDoDo — i18n / language toggle
// Loaded BEFORE script.js / auth-pages.js / admin.js
// so they see the right `dir` from the start.
// ============================================

window.CHOCODODO_I18N = (function () {
  const LANG_KEY = 'chocododo_lang';
  const SUPPORTED = ['en', 'ar'];

  // Translation dictionary. Add keys as you add HTML markers.
  const DICT = {
    en: {
      'nav.home':     'Home',
      'nav.about':    'About',
      'nav.menu':     'Menu',
      'nav.featured': 'Featured',
      'nav.contact':  'Contact',
      'nav.signin':   'Sign in',
      'nav.signup':   'Sign up',
      'nav.track':    'Track Order',
      'nav.signout':  'Sign out',
      'nav.account':  'Account',
      'nav.admin':    'Admin',

      'hero.badge':    'Fresh Today · Handmade with Love',
      'hero.tagline':  'From our kitchen to you',
      'hero.desc':     'Handcrafted chocolates, biscuits, and bakery treats — made fresh every day with the finest ingredients and a whole lot of love.',
      'hero.order':    'Order Now',
      'hero.see_menu': 'See Menu',

      'about.eyebrow':  'Our Story',
      'about.title':    'Sweet moments, made by hand',
      'about.fresh':    'Fresh Ingredients',
      'about.fresh.d':  'We source the finest cocoa, butter, and seasonal fruits to craft every single bite.',
      'about.handmade': 'Handmade Daily',
      'about.handmade.d': 'Every piece is made by hand in small batches.',
      'about.love':     'Made With Love',
      'about.love.d':   'Recipes passed down and perfected — we treat every order like it\'s for family.',
      'about.delivery': 'Made Fresh, Just for You',
      'about.delivery.d': 'Every order is hand-made from scratch — please plan 3 to 4 days ahead. Pick your delivery day at checkout; we bake it the same week.',

      'cat.eyebrow':    'Explore',
      'cat.title':      'Shop by category',

      'featured.eyebrow': 'Bestsellers',
      'featured.title':   'This week\'s favorites',
      'featured.sub':     'Hand-picked treats our customers can\'t get enough of',
      'featured.cta':     'View Full Menu',

      'how.eyebrow':  'Easy Peasy',
      'how.title':    'How it works',
      'how.s1':       'Pick Your Treats',
      'how.s1.d':     'Browse our menu and add your favorites to the cart.',
      'how.s2':       'Checkout Safely',
      'how.s2.d':     'Pay securely with card, PayPal, or cash on delivery.',
      'how.s3':       'We Bake It',
      'how.s3.d':     'We start crafting your order fresh, the moment it comes in.',
      'how.s4':       'Delivered Fresh',
      'how.s4.d':     'Your treats arrive at your door — fresh and beautifully packed.',

      'testi.eyebrow': 'Sweet Words',
      'testi.title':   'What our customers say',

      'newsletter.title': 'Fresh from the kitchen — be the first to know',
      'newsletter.desc':  "New flavors, holiday boxes, and limited drops. Drop your email and we'll let you know before they sell out.",
      'newsletter.cta':   'Subscribe',
      'newsletter.placeholder': 'your@email.com',

      'contact.eyebrow':  'Get In Touch',
      'contact.title':    'We\'d love to hear from you',
      'contact.visit':    'Visit Us',
      'contact.call':     'Call',
      'contact.email':    'Email',
      'contact.hours':    'Hours',
      'contact.name':     'Your Name',
      'contact.your_email': 'Your Email',
      'contact.subject':  'Subject',
      'contact.message':  'Message',
      'contact.send':     'Send Message',

      'footer.shop':       'Shop',
      'footer.company':    'Company',
      'footer.help':       'Help',

      'cart.title':       'Your Cart',
      'cart.empty':       'Your cart is empty',
      'cart.empty.add':   'Add some sweet treats!',
      'cart.total':       'Total:',
      'cart.checkout':    'Checkout',

      'menu.title':       'Sweet things await',
      'menu.eyebrow':     'Our Menu',
      'menu.desc':        'Everything we make, all in one place. Fresh, made by hand, delivered with love.',
      'menu.all':         'All',
      'menu.chocolate':   'Chocolate',
      'menu.biscuits':    'Biscuits',
      'menu.search':      "Search treats — try 'chocolate', 'biscuits', 'coffee'…",

      // Checkout
      'checkout.eyebrow':       'Almost there!',
      'checkout.title':         'Complete your',
      'checkout.title.em':      'order',
      'checkout.deposit_title': 'Deposit to confirm your order',
      'checkout.pay_now_label': 'Pay now',
      'checkout.guest':         'Have an account?',
      'checkout.guest.signin':  'Sign in',
      'checkout.guest.benefit': 'to autofill your details and use saved addresses.',
      'checkout.contact':       'Contact Details',
      'checkout.full_name':     'Full Name',
      'checkout.email':         'Email',
      'checkout.phone':         'Phone (Egyptian mobile)',
      'checkout.delivery':      'Delivery',
      'checkout.saved_addr':    'Use a saved address',
      'checkout.address':       'Delivery Address',
      'checkout.city':          'City / Area',
      'checkout.save_addr':     'Save this address?',
      'checkout.dont_save':     "Don't save",
      'checkout.notes':         'Notes for the kitchen (optional)',
      'checkout.when':          'When should we deliver?',
      'checkout.lead.title':    "Heads up — we don't do same-day delivery",
      'checkout.lead.body':     'Everything is hand-made fresh, so please pick a slot at least 3–4 days from today.',
      'checkout.paymode':       'How much would you like to pay now?',
      'checkout.deposit_only':  'Deposit only',
      'checkout.required':      'required',
      'checkout.pay_in_full':   'Pay in full',
      'checkout.pay_now':       'Pay',
      'checkout.now_50':        'now (50%)',
      'checkout.remaining':     'Remaining',
      'checkout.due_delivery':  'due on delivery',
      'checkout.now':           'Pay',
      'checkout.now_full':      'now',
      'checkout.nothing_left':  'Nothing left to pay on delivery',
      'checkout.note':          '📌 Every order requires a deposit to confirm — it locks in your slot and ingredients.',
      'checkout.method':        'Payment Method',
      'checkout.method.instapay':'InstaPay',
      'checkout.method.vcash':  'Vodafone Cash',
      'checkout.method.cod':    'Cash on Delivery',
      'checkout.place':         'Place Order',
      'checkout.summary':       'Order Summary',
      'checkout.subtotal':      'Subtotal',
      'checkout.delivery_fee':  'Delivery',
      'checkout.tax':           'Tax',
      'checkout.deposit':       'Pay now (deposit)',
      'checkout.due':           'Due on delivery',
      'checkout.secure':        '🔒 Your information is encrypted and secure',

      // Brand + tagline
      'brand.tagline':    'From our kitchen to you',

      // Hero stats
      'hero.stats.fillings': 'Filling Options',
      'hero.stats.customers':'Happy Customers',
      'hero.stats.handmade': '% Handmade',
      'hero.scroll':         'Scroll',

      // Categories grid
      'cat.stuffed':       'Stuffed Chocolate',
      'cat.stuffed.desc':  '10 fillings to choose from',
      'cat.plain':         'Plain Chocolate',
      'cat.plain.desc':    'Pure premium cocoa',
      'cat.snickers':      'Snickers Chocolate',
      'cat.snickers.desc': 'Peanut & caramel signature',
      'cat.mixed':         'Mixed Box',
      'cat.mixed.desc':    'A taste of everything',
      'cat.biscuits':      'Biscuits',
      'cat.biscuits.desc': 'Soft, buttery, handmade',
      'cat.diet':          'Diet Biscuits',
      'cat.diet.desc':     'Lower-sugar, full flavor',

      // Newsletter
      'newsletter.email':  'your@email.com',

      // Contact info
      'contact.delivery_only':       'Delivery only',
      'contact.delivery_only.desc':  "We're a delivery-first kitchen across Egypt. Order online, we'll bring the sweets to you.",
      'contact.whatsapp':            'WhatsApp / Call',
      'contact.email_label':         'Email',
      'contact.instagram':           'Instagram',
      'contact.cta.title':           'Talk to us on WhatsApp',
      'contact.cta.body':            'Custom orders, large quantities, special requests — message us directly. We reply within minutes during business hours.',
      'contact.cta.button':          'Open WhatsApp chat',
      'contact.cta.insta':           'Follow on Instagram',
      'contact.hours_anytime':       'Order anytime',
      'contact.hours_desc':          "Place orders 24/7 — we deliver fresh during business hours.",

      // Footer
      'footer.tagline':    'Handcrafted chocolates, donuts, and bakery treats — from our kitchen to you.',
      'footer.about':      'About',
      'footer.custom':     'Custom Orders',
      'footer.shipping':   'Shipping',
      'footer.returns':    'Returns',
      'footer.faq':        'FAQ',
      'footer.privacy':    'Privacy',
      'footer.copyright':  'From our kitchen to you · Made with 🍫 and love',

      // Loader
      'loader.text':       'Baking magic...',

      'lang.toggle':      'العربية',
    },
    ar: {
      'nav.home':     'الرئيسية',
      'nav.about':    'من نحن',
      'nav.menu':     'المنيو',
      'nav.featured': 'الأكثر مبيعاً',
      'nav.contact':  'تواصل معنا',
      'nav.signin':   'تسجيل الدخول',
      'nav.signup':   'إنشاء حساب',
      'nav.track':    'تتبع طلبك',
      'nav.signout':  'تسجيل الخروج',
      'nav.account':  'حسابي',
      'nav.admin':    'لوحة التحكم',

      'hero.badge':    'طازج اليوم · مصنوع بالحب',
      'hero.tagline':  'من مطبخنا إليك',
      'hero.desc':     'شكولاتة وبسكويت ومخبوزات مصنوعة يدوياً — طازجة كل يوم بأجود المكونات وبكثير من الحب.',
      'hero.order':    'اطلب الآن',
      'hero.see_menu': 'شاهد المنيو',

      'about.eyebrow':  'قصتنا',
      'about.title':    'لحظات حلوة، مصنوعة يدوياً',
      'about.fresh':    'مكونات طازجة',
      'about.fresh.d':  'نختار أجود أنواع الكاكاو والزبدة والفواكه الموسمية لكل قضمة.',
      'about.handmade': 'مصنوع يدوياً يومياً',
      'about.handmade.d': 'كل قطعة مصنوعة يدوياً في دفعات صغيرة.',
      'about.love':     'مصنوع بحب',
      'about.love.d':   'وصفات متوارثة ومتقنة — نعامل كل طلب كأنه لعائلتنا.',
      'about.delivery': 'مصنوع طازج، خصيصاً لك',
      'about.delivery.d': 'كل طلب مصنوع يدوياً من الصفر — يرجى التخطيط قبل ٣ إلى ٤ أيام. اختر يوم التوصيل عند إتمام الطلب، ونحن نخبزه في نفس الأسبوع.',

      'cat.eyebrow':    'استكشف',
      'cat.title':      'تسوق حسب الفئة',

      'featured.eyebrow': 'الأكثر مبيعاً',
      'featured.title':   'مفضلات هذا الأسبوع',
      'featured.sub':     'حلويات يحبها عملاؤنا',
      'featured.cta':     'شاهد المنيو كاملاً',

      'how.eyebrow':  'بسيط جداً',
      'how.title':    'كيف يعمل',
      'how.s1':       'اختر حلوياتك',
      'how.s1.d':     'تصفح المنيو وأضف المفضلة إلى السلة.',
      'how.s2':       'ادفع بأمان',
      'how.s2.d':     'ادفع بالكارت أو PayPal أو كاش عند الاستلام.',
      'how.s3':       'نحضر طلبك',
      'how.s3.d':     'نبدأ في تحضير طلبك طازج فور وصوله.',
      'how.s4':       'توصيل طازج',
      'how.s4.d':     'تصل حلوياتك إلى باب بيتك — طازجة ومُغلَّفة بأناقة.',

      'testi.eyebrow': 'كلمات حلوة',
      'testi.title':   'ماذا يقول عملاؤنا',

      'newsletter.title': 'طازج من المطبخ — كن أول من يعرف',
      'newsletter.desc':  'نكهات جديدة، صناديق المناسبات، وإصدارات محدودة. اكتب إيميلك ونعرّفك قبل ما تنفد.',
      'newsletter.cta':   'اشترك',
      'newsletter.placeholder': 'your@email.com',

      'contact.eyebrow':  'تواصل معنا',
      'contact.title':    'نحب أن نسمع منك',
      'contact.visit':    'زرنا',
      'contact.call':     'اتصل',
      'contact.email':    'إيميل',
      'contact.hours':    'ساعات العمل',
      'contact.name':     'الاسم',
      'contact.your_email': 'الإيميل',
      'contact.subject':  'الموضوع',
      'contact.message':  'الرسالة',
      'contact.send':     'أرسل الرسالة',

      'footer.shop':       'تسوق',
      'footer.company':    'الشركة',
      'footer.help':       'مساعدة',

      'cart.title':       'سلتك',
      'cart.empty':       'السلة فارغة',
      'cart.empty.add':   'أضف بعض الحلويات!',
      'cart.total':       'المجموع:',
      'cart.checkout':    'إتمام الطلب',

      'menu.title':       'حلويات تنتظرك',
      'menu.eyebrow':     'المنيو',
      'menu.desc':        'كل ما نصنعه، في مكان واحد. طازج، مصنوع يدوياً، يصلك بحب.',
      'menu.all':         'الكل',
      'menu.chocolate':   'شكولاتة',
      'menu.biscuits':    'بسكويت',
      'menu.search':      'ابحث عن حلوياتك — جرّب «شكولاتة»، «بسكويت»، «قهوة»…',

      // Checkout
      'checkout.eyebrow':       'اقتربت!',
      'checkout.title':         'أكمل',
      'checkout.title.em':      'طلبك',
      'checkout.deposit_title': 'المقدم لتأكيد طلبك',
      'checkout.pay_now_label': 'ادفع الآن',
      'checkout.guest':         'لديك حساب بالفعل؟',
      'checkout.guest.signin':  'تسجيل الدخول',
      'checkout.guest.benefit': 'لتعبئة بياناتك تلقائياً واستخدام عناوينك المحفوظة.',
      'checkout.contact':       'بيانات التواصل',
      'checkout.full_name':     'الاسم الكامل',
      'checkout.email':         'البريد الإلكتروني',
      'checkout.phone':         'رقم المحمول (مصري)',
      'checkout.delivery':      'التوصيل',
      'checkout.saved_addr':    'استخدم عنوان محفوظ',
      'checkout.address':       'عنوان التوصيل',
      'checkout.city':          'المدينة / المنطقة',
      'checkout.save_addr':     'حفظ هذا العنوان؟',
      'checkout.dont_save':     'عدم الحفظ',
      'checkout.notes':         'ملاحظات للمطبخ (اختياري)',
      'checkout.when':          'متى تريد التوصيل؟',
      'checkout.lead.title':    'انتبه — لا توجد توصيلات في نفس اليوم',
      'checkout.lead.body':     'كل ما نصنعه طازج ويدوي، لذا اختر موعداً قبل ٣–٤ أيام على الأقل من اليوم.',
      'checkout.paymode':       'كم تريد أن تدفع الآن؟',
      'checkout.deposit_only':  'دفعة مقدمة فقط',
      'checkout.required':      'مطلوب',
      'checkout.pay_in_full':   'الدفع كاملاً',
      'checkout.pay_now':       'ادفع',
      'checkout.now_50':        'الآن (٥٠٪)',
      'checkout.remaining':     'المتبقي',
      'checkout.due_delivery':  'مستحق عند التسليم',
      'checkout.now':           'ادفع',
      'checkout.now_full':      'الآن',
      'checkout.nothing_left':  'لا يوجد متبقي للدفع عند التسليم',
      'checkout.note':          '📌 كل طلب يتطلب دفعة مقدمة لتأكيده — لحجز موعدك وتحضير المكونات.',
      'checkout.method':        'طريقة الدفع',
      'checkout.method.instapay':'إنستاباي',
      'checkout.method.vcash':  'فودافون كاش',
      'checkout.method.cod':    'الدفع عند الاستلام',
      'checkout.place':         'تأكيد الطلب',
      'checkout.summary':       'ملخص الطلب',
      'checkout.subtotal':      'المجموع الفرعي',
      'checkout.delivery_fee':  'التوصيل',
      'checkout.tax':           'الضريبة',
      'checkout.deposit':       'ادفع الآن (مقدم)',
      'checkout.due':           'مستحق عند التسليم',
      'checkout.secure':        '🔒 بياناتك مشفرة وآمنة',

      // Brand + tagline
      'brand.tagline':    'من مطبخنا إليك',

      // Hero stats
      'hero.stats.fillings': 'نكهات الحشو',
      'hero.stats.customers':'عميل سعيد',
      'hero.stats.handmade': '٪ مصنوع يدوياً',
      'hero.scroll':         'مرر للأسفل',

      // Categories
      'cat.stuffed':       'شكولاتة محشية',
      'cat.stuffed.desc':  '١٠ نكهات للاختيار',
      'cat.plain':         'شكولاتة سادة',
      'cat.plain.desc':    'كاكاو فاخر ونقي',
      'cat.snickers':      'شكولاتة سنيكرز',
      'cat.snickers.desc': 'فول سوداني وكراميل',
      'cat.mixed':         'تشكيلة',
      'cat.mixed.desc':    'طعم من كل شيء',
      'cat.biscuits':      'بسكويت',
      'cat.biscuits.desc': 'طري، زبدي، يدوي',
      'cat.diet':          'بسكويت دايت',
      'cat.diet.desc':     'قليل السكر، غني بالنكهة',

      // Newsletter
      'newsletter.email':  'بريدك@الإلكتروني.com',

      // Contact
      'contact.delivery_only':      'توصيل فقط',
      'contact.delivery_only.desc': 'مطبخ يعمل بنظام التوصيل في جميع أنحاء مصر. اطلب أونلاين ونحن نوصل لك الحلويات.',
      'contact.whatsapp':           'واتساب / اتصال',
      'contact.email_label':        'البريد',
      'contact.instagram':          'إنستجرام',
      'contact.cta.title':          'تواصل معنا على واتساب',
      'contact.cta.body':           'طلبات خاصة، كميات كبيرة، طلبات مميزة — راسلنا مباشرة. نرد خلال دقائق في ساعات العمل.',
      'contact.cta.button':         'افتح محادثة واتساب',
      'contact.cta.insta':          'تابعنا على إنستجرام',
      'contact.hours_anytime':      'اطلب في أي وقت',
      'contact.hours_desc':         'نستقبل الطلبات على مدار الساعة — والتوصيل خلال ساعات العمل.',

      // Footer
      'footer.tagline':    'شكولاتة وبسكويت ومخبوزات مصنوعة يدوياً — من مطبخنا إليك.',
      'footer.about':      'من نحن',
      'footer.custom':     'طلبات خاصة',
      'footer.shipping':   'الشحن',
      'footer.returns':    'الاسترجاع',
      'footer.faq':        'الأسئلة الشائعة',
      'footer.privacy':    'الخصوصية',
      'footer.copyright':  'من مطبخنا إليك · مصنوع بـ 🍫 وحب',

      // Loader
      'loader.text':       'نُحضّر السحر...',

      'lang.toggle':      'English',
    },
  };

  function getLang() {
    let lang = localStorage.getItem(LANG_KEY) || (navigator.language || 'en').slice(0, 2);
    if (!SUPPORTED.includes(lang)) lang = 'en';
    return lang;
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'en';
    localStorage.setItem(LANG_KEY, lang);
    apply(lang);
  }

  function t(key, lang = getLang()) {
    return (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  }

  function apply(lang = getLang()) {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body?.classList.toggle('rtl', lang === 'ar');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key, lang);
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key, lang));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key, lang));
    });

    // Update toggle button label
    document.querySelectorAll('.lang-toggle').forEach(el => {
      el.textContent = t('lang.toggle', lang);
    });

    // Notify other scripts (e.g. so they can re-render dynamic content)
    window.dispatchEvent(new CustomEvent('chocododo:lang', { detail: { lang } }));
  }

  /**
   * Inject a "Track Order" nav link on every page that has a navbar.
   * Idempotent — won't add a duplicate if one already exists.
   */
  function injectTrackLink() {
    const nav = document.getElementById('navLinks');
    if (!nav) return;
    if (nav.querySelector('.nav-track-link')) return;
    // Don't double-up if a track link already exists
    const existing = Array.from(nav.querySelectorAll('a[href]'))
      .find(a => /track\.html/i.test(a.getAttribute('href') || ''));
    if (existing) {
      existing.classList.add('nav-track-link');
      existing.setAttribute('data-i18n', 'nav.track');
      existing.textContent = t('nav.track');
      return;
    }
    const inPages = location.pathname.includes('/pages/');
    const href = inPages ? 'track.html' : 'pages/track.html';
    const li = document.createElement('li');
    li.innerHTML = `<a href="${href}" class="nav-link nav-track-link" data-i18n="nav.track">📦 ${t('nav.track')}</a>`;
    // Insert after Menu link if found, otherwise append
    const menuLi = Array.from(nav.querySelectorAll('a'))
      .find(a => /menu\.html$/i.test(a.getAttribute('href') || ''));
    if (menuLi && menuLi.parentElement) {
      menuLi.parentElement.insertAdjacentElement('afterend', li);
    } else {
      nav.appendChild(li);
    }
  }

  function injectToggle() {
    // Preferred mount point
    let hosts = Array.from(document.querySelectorAll('[data-lang-toggle-mount]'));
    // Fallback: any .nav-actions container (covers pages that don't have the explicit mount)
    if (hosts.length === 0) {
      hosts = Array.from(document.querySelectorAll('.nav-actions'));
    }
    // Last fallback: prepend to .nav-container so simple pages still get a toggle
    if (hosts.length === 0) {
      const navc = document.querySelector('.nav-container');
      if (navc) hosts = [navc];
    }
    hosts.forEach(host => {
      if (host.querySelector('.lang-toggle')) return;
      const btn = document.createElement('button');
      btn.className = 'lang-toggle';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Switch language / تغيير اللغة');
      btn.addEventListener('click', () => {
        setLang(getLang() === 'en' ? 'ar' : 'en');
      });
      host.appendChild(btn);
    });
  }

  // Apply ASAP — before paint when possible
  function init() {
    injectTrackLink();
    apply();
    injectToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Apply RTL `dir` on <html> immediately so layout doesn't flash
  document.documentElement.dir = getLang() === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = getLang();

  return { t, apply, setLang, getLang };
})();
