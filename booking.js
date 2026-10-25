/* booking.js - booking page logic for Clean Media Pictures.
   Loaded by booking.html after portfolio-manifest.js and portfolio-images.js.

   Sections: settings, slideshow, packages, site galleries, steps and validation, WhatsApp send. */

/* ════ SETTINGS ════ */
var WHATSAPP_NUMBER = '27670237264';   /* international format, no + or spaces */

/* Optional: a form-handling URL (Formspree, Web3Forms, or your own server function). When set, every
   finished booking is also POSTed there as JSON, so you keep a copy even if the client never taps
   "send" in WhatsApp. Leave empty to turn it off. */
var BOOKING_ENDPOINT = '';

var BANK_ACCOUNT_NUMBER = '1052655939';

function $(id) { return document.getElementById(id); }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

/* ════ MIN DATE (today, in the visitor's own time zone) ════ */
var _now  = new Date();
var today = _now.getFullYear() + '-' + pad2(_now.getMonth() + 1) + '-' + pad2(_now.getDate());
['f-date', 'f-date2'].forEach(function(id) { $(id).setAttribute('min', today); });

/* ════ IMAGE SLIDER ════ */

var sliderEl    = document.getElementById('panel-slider');
var sliderIndex = 0;
var sliderTimer = null;

function startSlider(images) {
  /* Stop existing timer */
  clearInterval(sliderTimer);
  sliderTimer = null;
  sliderIndex = 0;

  /* Build fresh slides */
  sliderEl.innerHTML = '';
  for (var i = 0; i < images.length; i++) {
    var div = document.createElement('div');
    div.className = 'slide' + (i === 0 ? ' active' : '');
    div.style.backgroundImage = "url('" + images[i] + "')";
    sliderEl.appendChild(div);
  }

  /* Auto-advance */
  if (images.length > 1) {
    sliderTimer = setInterval(function() {
      var slides = sliderEl.querySelectorAll('.slide');
      slides[sliderIndex].classList.remove('active');
      sliderIndex = (sliderIndex + 1) % slides.length;
      slides[sliderIndex].classList.add('active');
    }, 3500);
  }
}

/* ════ SITE GALLERIES ════
   One entry per photo folder on the website (see the folder tree). Folders are numbered .webp files;
   ranges list the numbers that exist, so gaps (e.g. studio-photography 41-44) are never requested.
   apiSlugs = names to try with the portfolio library (portfolio-images.js), which prefers portrait photos.
   If it has nothing for a slug we pick random photos straight from the folder. */
var GALLERIES = {
  'professional-headshots': { dir: 'corporate-gallery/images/professional-headshots', ranges: [[31, 52]],  page: 'corporate-gallery/professional-headshots-gallery.html', label: 'Professional Headshots' },
  'fashion':                { dir: 'corporate-gallery/images/fashion',                ranges: [[1, 30]],   page: 'corporate-gallery/fashion-gallery.html',                label: 'Fashion' },
  'celebrations':           { dir: 'events-gallery/images/celebrations',              ranges: [[1, 85]],   page: 'events-gallery/celebration-gallery.html',               label: 'Celebration', apiSlugs: ['celebrations', 'celebration'] },
  'festive':                { dir: 'events-gallery/images/festive',                   ranges: [[1, 83]],   page: 'events-gallery/festive.html',                           label: 'Festive' },
  'weddings':               { dir: 'events-gallery/images/weddings',                  ranges: [[1, 124]],  page: 'events-gallery/weddings-gallery.html',                  label: 'Weddings' },
  'birthday':               { dir: 'lifestyle-gallery/images/birthday',               ranges: [[1, 186]],  page: 'lifestyle-gallery/birthday-gallery.html',               label: 'Birthday' },
  'cake-smash-photography': { dir: 'lifestyle-gallery/images/cake-smash-photography', ranges: [[1, 138]],  page: 'lifestyle-gallery/cake-smash-photography-gallery.html', label: 'Cake Smash' },
  'graduation':             { dir: 'lifestyle-gallery/images/graduation',             ranges: [[1, 232]],  page: 'lifestyle-gallery/graduation-gallery.html',             label: 'Graduation' },
  'maternity':              { dir: 'lifestyle-gallery/images/maternity',              ranges: [[1, 92]],   page: 'lifestyle-gallery/maternity-gallery.html',              label: 'Maternity' },
  'matric-farewell':        { dir: 'lifestyle-gallery/images/matric-farewell',        ranges: [[1, 313]],  page: 'lifestyle-gallery/matric-farewell-gallery.html',        label: 'Matric Farewell' },
  'outdoor-photography':    { dir: 'lifestyle-gallery/images/outdoor-photography',    ranges: [[1, 70]],   page: 'lifestyle-gallery/outdoor-photography-gallery.html',    label: 'Outdoor Photography' },
  'studio-photography':     { dir: 'lifestyle-gallery/images/studio-photography',     ranges: [[1, 40], [45, 111]], page: 'lifestyle-gallery/studio-photography-gallery.html', label: 'Studio Photography' }
};

/* Which gallery (or mix of galleries) each category shows. */
var DEFAULT_SLUGS = ['studio-photography', 'outdoor-photography', 'weddings', 'maternity', 'graduation', 'birthday'];
var GALLERY_CAT = {
  'Portraits':        ['outdoor-photography', 'studio-photography', 'professional-headshots'],
  'Couples & Family': ['outdoor-photography', 'studio-photography'],
  'Maternity':        ['maternity'],
  'Graduation & Matric': ['graduation'],
  'Birthdays':        ['birthday'],
  'Christmas':        ['festive'],
  'Events':           ['celebrations'],
  'Weddings':         ['weddings'],
  'Other':            DEFAULT_SLUGS
};
/* Packages that should show something more specific than their category.
   To give any other package its own photos, add its exact name here. */
var GALLERY_PKG = {
  'Outdoor Photoshoot':       ['outdoor-photography'],
  'Designer Backdrop Studio': ['studio-photography'],
  'Professional Headshots':   ['professional-headshots'],
  'Matric Farewell':          ['matric-farewell'],
  'Kids Birthday Shoot':      ['cake-smash-photography']
};

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function folderImages(slug, n) {
  var g = GALLERIES[slug];
  if (!g) return [];
  var nums = [];
  g.ranges.forEach(function(r) { for (var k = r[0]; k <= r[1]; k++) nums.push(k); });
  return shuffle(nums).slice(0, n).map(function(k) { return g.dir + '/' + k + '.webp'; });
}

function portfolioImages(slug, n) {
  var API = window.CMP_IMG;
  if (!API || !API.portraitSequence) return [];
  var g = GALLERIES[slug];
  var names = (g && g.apiSlugs) || [slug];
  for (var i = 0; i < names.length; i++) {
    try {
      var s = API.portraitSequence(names[i], n);
      if (Array.isArray(s) && s.length >= 2) return s;
    } catch (e) { /* try the next name */ }
  }
  return [];
}

/* Photos from several galleries, interleaved, e.g. 8 photos from 3 galleries. */
function gallerySequence(slugs, total) {
  var per = Math.max(2, Math.ceil(total / slugs.length));
  var lists = slugs.map(function(s) {
    var l = portfolioImages(s, per);
    return l.length >= 2 ? l : folderImages(s, per);
  });
  var out = [];
  for (var i = 0; i < per; i++) {
    lists.forEach(function(l) { if (l[i]) out.push(l[i]); });
  }
  return out.slice(0, total);
}

function preloadImg(src) {
  return new Promise(function(resolve) {
    var im = new Image();
    im.onload  = function() { resolve(src); };
    im.onerror = function() { resolve(null); };
    im.src = src;
  });
}

var galleryToken = 0;
var galleryLink  = document.getElementById('gallery-link');

function currentSlugs() {
  var own = selectedPkg ? GALLERY_PKG[selectedPkg.name] : null;
  return own || GALLERY_CAT[CATS[selectedCat].label] || DEFAULT_SLUGS;
}

function showGallery() {
  var slugs = currentSlugs();
  var my = ++galleryToken;

  /* "View our X gallery" link: only when one gallery is on show */
  if (galleryLink) {
    var g = slugs.length === 1 ? GALLERIES[slugs[0]] : null;
    if (g) {
      galleryLink.textContent = 'View our ' + g.label + ' gallery →';
      galleryLink.setAttribute('href', g.page);
      galleryLink.hidden = false;
    } else {
      galleryLink.hidden = true;
    }
  }

  Promise.all(gallerySequence(slugs, 8).map(preloadImg)).then(function(res) {
    if (my !== galleryToken) return;            /* the user already picked something else */
    var ok = res.filter(Boolean);
    if (ok.length >= 2) { startSlider(ok); return; }
    Promise.all(gallerySequence(DEFAULT_SLUGS, 8).map(preloadImg)).then(function(res2) {
      if (my !== galleryToken) return;
      startSlider(res2.filter(Boolean));
    });
  });
}

/* ════ PACKAGES (from the WhatsApp price list) ════
   Each package can ask for only what it needs:
     locations : [{ v, venue }]   a "where" choice the client must make (venue = what that choice needs in step 3)
     people    : { key, label, options }   a group size / guest count the client must give
     venue     : { mode: 'required' | 'optional', label, placeholder }   a fixed venue question
     days      : 2   asks for a second date
     notes     : { label, required, placeholder }   overrides the notes box
   Categories set `kind`: 'session' (default), 'event', 'wedding' or 'custom' (client explains in their own words). */

function money(n) {
  return 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

var MATERNITY_ADDONS = ['Dress rental (R250 each)', 'Hat with long strings (R300)', 'Hanging swing (R700)', 'Creative setup (R300)', 'Makeup (R600)'];
var GRAD_ADDONS      = ['Extra family member over 5 (R100 each)', 'Graduation newspaper (R200)', 'Extra pictures (R60 each)', 'Transport around Pretoria (R300)'];
var BIRTHDAY_ADDONS  = ['Designer backdrop (R300)', 'Snoot circle light (R350)', 'Newspaper (R200)', 'Helium balloons (R350)', 'Makeup (R600)', 'Custom set-up (quote)'];
var CHRISTMAS_ADDONS = ['Extra person (R100 each)', 'Different backdrop (R500)', 'Extra edited images (R80 each)', 'All unedited images (R1 500)'];

var VENUE_OUTDOOR = { mode: 'optional', label: 'Preferred outdoor location (optional)', placeholder: 'e.g. a park, garden or suburb in Pretoria' };
var VENUE_YOURS   = { mode: 'required', label: 'Venue or address', placeholder: 'Where should we come to?' };

var LOC_OUTDOOR_STUDIO = [{ v: 'Outdoor', venue: VENUE_OUTDOOR }, { v: 'Studio' }];
var NEED_DETAILS = { label: 'Tell us what you have in mind', required: true, placeholder: 'Theme, number of people, the look you want, your date…' };

var GUESTS = { key: 'Guests', label: 'Roughly how many guests?', options: ['Under 20', '20 to 50', '50 to 100', '100+'] };
var FAMILY_SIZE = { key: 'People', label: 'How many people will be in the shoot?', options: ['3', '4', '5', '6', '7+'] };
var GRAD_PEOPLE = { key: 'People joining the graduate', label: 'How many family members will join the graduate?', options: ['Just the graduate', '2', '3', '4', '5', '6+'] };

var CATS = [
  { label: 'Portraits', note: '', pkgs: [
    { name: 'Outdoor Photoshoot', price: 2200, info: '45 min · 20 images via Dropbox · 2 outfits', addons: ['30-sec reel (R300)'], venue: VENUE_OUTDOOR },
    { name: 'Designer Backdrop Studio', price: 2000, info: '45 min · 20 edited images · 2 outfits · backdrop catalog', addons: ['Extra images (R80 each)', 'Extra outfit (R200)', 'Extra 15 min studio time (R250)'] },
    { name: 'Professional Headshots', price: 1700, info: '30 min · 2 outfits · 15 retouched images', addons: [] }
  ]},
  { label: 'Couples & Family', note: 'Family shoots for a special occasion are under Maternity (Bump & Family), Graduation (Graduation Family) and Christmas.', pkgs: [
    { name: 'Couple Photoshoot', price: 2500, info: '45 min, outdoor or studio · 20 edited images · 2 outfits · online gallery', addons: ['Extra images (R50 each)', 'Props, e.g. flowers or balloons (R300 – R600)', 'Outdoor plus studio (R1 000)', 'Location around Pretoria (R300)', 'Makeup & styling (quote)'], locations: LOC_OUTDOOR_STUDIO },
    { name: 'Family Shoot', price: 3000, info: '60 min · 3 to 5 people · 2 outfits · 25 images', addons: ['Extra person (R100 each)', 'Extra images (R60 each)'], locations: LOC_OUTDOOR_STUDIO, people: FAMILY_SIZE }
  ]},
  { label: 'Maternity', note: 'Bump & Me, Love and Family are shot with your own two outfits.', pkgs: [
    { name: 'Bump & Me', price: 2000, info: 'Mom-to-be · 45 min studio or outdoor · 20 retouched images', addons: MATERNITY_ADDONS, locations: LOC_OUTDOOR_STUDIO },
    { name: 'Bump & Love', price: 2500, info: 'Mom-to-be and partner · 45 min · 20 retouched images', addons: MATERNITY_ADDONS, locations: LOC_OUTDOOR_STUDIO },
    { name: 'Bump & Family', price: 3000, info: 'Mom-to-be, partner and kids · 45 min · 20 retouched images', addons: MATERNITY_ADDONS, locations: LOC_OUTDOOR_STUDIO,
      people: { key: 'People', label: 'How many people in total?', options: ['3', '4', '5', '6+'] } },
    { name: 'Bump & Bliss (with dresses)', price: 3000, info: 'Solo, partner and family shoot · 2 maternity dresses provided · 20 retouched images', addons: ['Partner outfit changes & editing', 'Extra images (R60 each)', 'Extra outfit change (R150)'], locations: LOC_OUTDOOR_STUDIO }
  ]},
  { label: 'Graduation & Matric', note: '', pkgs: [
    { name: 'Graduation Individual', price: 1700, info: '30 min · 15 edited images · family shoot (max 5 people)', addons: ['Same-day edit, 24 h (R350)'].concat(GRAD_ADDONS),
      venue: { mode: 'required', label: 'Where is the graduation shoot?', placeholder: 'University, campus or venue' }, people: GRAD_PEOPLE },
    { name: 'Studio Graduation', price: 1700, info: '30 min in studio · 15 edited images · family shoot (max 5) · BTS reel', addons: GRAD_ADDONS, people: GRAD_PEOPLE },
    { name: 'Graduation Family', price: 2500, info: '45 min · 20 edited images · graduate solo and with family · transport charged separately', addons: [],
      venue: { mode: 'required', label: 'Where is the graduation shoot?', placeholder: 'University, campus or venue' },
      people: { key: 'People', label: 'How many people in the family shoot?', options: ['2', '3', '4', '5', '6+'] } },
    { name: 'Matric Farewell', price: 3000, info: '1 h 30 · 30 edited images · solo and partner shots · online gallery', addons: ['Extra hour (R1 500)', 'Additional images (R60 each)', 'Prints & merchandise (on request)'],
      venue: { mode: 'optional', label: 'Where is the matric farewell? (optional)', placeholder: 'Venue or suburb' } }
  ]},
  { label: 'Birthdays', note: '', pkgs: [
    { name: 'Birthday Bliss (Studio)', price: 1700, info: '45 min · 20 retouched images · 2 outfits · BTS coverage', addons: BIRTHDAY_ADDONS },
    { name: 'Helium Balloon Shoot (Studio)', price: 2000, info: '45 min · helium balloons · 20 retouched images · 2 outfits · 30-sec BTS reel', addons: [] },
    { name: 'LED Lights Birthday', price: 2000, info: '60 min · 25 images via Dropbox · 2 outfits · 30-sec reel', addons: [] },
    { name: 'House-call Birthday', price: 1800, suffix: ' + transport', info: '1 hour at your space · 20 edited images · 2 outfits · B-roll · transport R5.50 per km', addons: [],
      venue: { mode: 'required', label: 'Your address (home or hotel)', placeholder: 'Street address and suburb, so we can work out transport' } },
    { name: 'Birthday Exclusive', price: 4500, info: '45 min · balloons, cake, champagne and roses · make-up · 20 images · BTS video', addons: [] },
    { name: 'Birthday Calendar Shoot', price: 2200, info: 'Details on request', addons: [], notes: NEED_DETAILS },
    { name: 'Kids Birthday Shoot', price: 2500, info: 'Details on request', addons: [], notes: NEED_DETAILS },
    { name: 'Gender Reveal', price: 2000, info: 'Details on request', addons: [], notes: NEED_DETAILS }
  ]},
  { label: 'Christmas', note: '', pkgs: [
    { name: 'Christmas Setup', price: 3000, info: '45 min · 1 outfit · 20 images · family of 5', addons: CHRISTMAS_ADDONS,
      people: { key: 'People', label: 'How many people in your family shoot?', options: ['2', '3', '4', '5', '6', '7+'] } },
    { name: 'Mega Christmas', price: 3500, info: '60 min · 2 backdrops · 2 outfits · 30 images · family of 5', addons: CHRISTMAS_ADDONS,
      people: { key: 'People', label: 'How many people in your family shoot?', options: ['2', '3', '4', '5', '6', '7+'] } }
  ]},
  { label: 'Events', kind: 'event', note: 'Transport is charged separately.', pkgs: [
    { name: 'Event Coverage: 1 hour', price: 2500, info: 'Birthday lunch, dinner or party · unlimited pictures via Dropbox', addons: [], people: GUESTS },
    { name: 'Event Coverage: 2 hours', price: 4500, info: 'Unlimited pictures via Dropbox', addons: [], people: GUESTS },
    { name: 'Event Coverage: 3 hours', price: 6000, info: 'Unlimited pictures via Dropbox', addons: [], people: GUESTS },
    { name: 'Event Coverage: 4 hours', price: 7500, info: 'Unlimited pictures via Dropbox', addons: [], people: GUESTS },
    { name: 'MD Superstars (3 hours)', price: 5000, info: 'Prep shoot · session at your location · highlight reel · 25 edited + 25 retouched images', addons: [], people: GUESTS },
    { name: 'Fabulous Package (8 hours)', price: 10000, info: 'Pictures on a personalised USB · highlight video · A3 canvas', addons: [], people: GUESTS }
  ]},
  { label: 'Weddings', kind: 'wedding', note: 'All quotes include transport around Gauteng. Wedding content takes 2 to 3 months to deliver.', pkgs: [
    { name: 'Standard: 1 day', price: 14000, info: 'Photography only · unlimited edited images · prep shoot of bride & groom', addons: ['Photobook (R2 500)', 'Drone (R2 000)'], people: { key: 'Guests', label: 'Roughly how many guests?', options: ['Under 50', '50 to 100', '100 to 200', '200+'] } },
    { name: 'Standard: 2 days', price: 22000, days: 2, info: 'Photography only · unlimited edited images · prep shoot of bride & groom', addons: ['Photobook (R2 500)', 'Drone (R2 000)'], people: { key: 'Guests', label: 'Roughly how many guests?', options: ['Under 50', '50 to 100', '100 to 200', '200+'] } },
    { name: 'Mokgonyana & Makoti: 1 day', price: 25000, info: 'Photos, video and drone · 8 hours coverage · unlimited pictures via Dropbox', addons: ['Photobook (R2 500)'], people: { key: 'Guests', label: 'Roughly how many guests?', options: ['Under 50', '50 to 100', '100 to 200', '200+'] } },
    { name: 'Mokgonyana & Makoti: 2 days', price: 37000, days: 2, info: 'Photos, video and drone · 8 hours coverage per day · unlimited pictures via Dropbox', addons: ['Photobook (R2 500)'], people: { key: 'Guests', label: 'Roughly how many guests?', options: ['Under 50', '50 to 100', '100 to 200', '200+'] } }
  ]},
  { label: 'Other', kind: 'custom', note: 'Describe what you need and we will send you a quote.', pkgs: [
    { name: 'Videography', price: null, info: 'Cinematic video for any occasion', addons: [] },
    { name: 'Digital Art & Retouching', price: null, info: 'Creative editing and composite work', addons: [], venue: false, dateLabel: 'Deadline (optional)',
      notes: { label: 'Tell us what you need', required: true, placeholder: 'What should we edit or create, how many images, the style you want and your deadline…' } }
  ]}
];

/* ════ STATE ════ */
var selectedCat = -1;
var selectedPkg = null;
var pref      = { location: '', people: '' };
var addonsSel = {};

var catGroup = $('cat-group');
var svcGroup = $('svc-group');
var pkgNote  = $('pkg-note');

function priceText(p) {
  return p.price ? money(p.price) + (p.suffix || '') : 'Quote';
}
function kindOf() {
  return (selectedCat >= 0 && CATS[selectedCat].kind) || 'session';
}
function hasPrefs() {
  var p = selectedPkg;
  return !!(p && (p.locations || p.people || (p.addons && p.addons.length)));
}
function resetPrefs() {
  pref = { location: '', people: '' };
  addonsSel = {};
}

/* ════ STEP 1: category and package ════ */
function renderCats() {
  catGroup.innerHTML = '';
  CATS.forEach(function(c, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip cat-chip' + (i === selectedCat ? ' selected' : '');
    b.textContent = c.label;
    b.addEventListener('click', function() { selectCat(i); });
    catGroup.appendChild(b);
  });
}

function renderPkgs() {
  svcGroup.innerHTML = '';
  if (selectedCat < 0) return;
  CATS[selectedCat].pkgs.forEach(function(p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'svc-card' + (p === selectedPkg ? ' selected' : '');
    var n  = document.createElement('div'); n.className  = 'svc-name';  n.textContent  = p.name;
    var pr = document.createElement('div'); pr.className = 'pkg-price'; pr.textContent = priceText(p);
    var d  = document.createElement('div'); d.className  = 'svc-desc';  d.textContent  = p.info;
    b.appendChild(n); b.appendChild(pr); b.appendChild(d);
    b.addEventListener('click', function() { selectPkg(p); });
    svcGroup.appendChild(b);
  });
}

function renderNote() {
  var parts = [];
  if (selectedCat >= 0 && CATS[selectedCat].note) parts.push(CATS[selectedCat].note);
  if (selectedPkg && selectedPkg.price) {
    parts.push('A 50% deposit of ' + money(Math.round(selectedPkg.price / 2)) + ' secures your date.');
  }
  pkgNote.textContent = parts.join(' ');
}

function selectCat(i) {
  if (i === selectedCat) return;
  selectedCat = i;
  selectedPkg = null;
  resetPrefs();
  computeFlow();
  renderCats();
  renderPkgs();
  renderNote();
  showGallery();
  showError(0, '');
  updateUI();
}

function selectPkg(p) {
  selectedPkg = (selectedPkg === p) ? null : p;
  resetPrefs();
  computeFlow();
  renderPkgs();
  renderNote();
  showGallery();
  showError(0, '');
  updateUI();
}

/* ════ STEP 2: preferences (only what this package needs) ════ */
function renderChoice(groupId, values, current, onPick) {
  var g = $(groupId);
  g.innerHTML = '';
  values.forEach(function(v) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (v === current ? ' selected' : '');
    b.textContent = v;
    b.addEventListener('click', function() {
      onPick(v);
      renderChoice(groupId, values, v, onPick);
      showError(1, '');
    });
    g.appendChild(b);
  });
}

function setLabel(labelEl, text, required) {
  labelEl.dataset.text = text;
  labelEl.textContent = text;
  if (required) {
    var s = document.createElement('span');
    s.className = 'req';
    s.textContent = ' *';
    labelEl.appendChild(s);
  }
}

function configurePrefs() {
  var p = selectedPkg;
  var kind = kindOf();
  $('prefs-heading').textContent = kind === 'wedding' ? 'Your wedding' : (kind === 'event' ? 'Your event' : 'Session preferences');

  var gl = $('grp-location');
  gl.hidden = !(p && p.locations);
  if (!gl.hidden) {
    setLabel($('lbl-location'), 'Where would you like to shoot?', true);
    renderChoice('location-group', p.locations.map(function(o) { return o.v; }), pref.location, function(v) { pref.location = v; });
  }

  var gp = $('grp-people');
  gp.hidden = !(p && p.people);
  if (!gp.hidden) {
    setLabel($('lbl-people'), p.people.label, true);
    renderChoice('people-group', p.people.options, pref.people, function(v) { pref.people = v; });
  }

  var ga = $('grp-addons');
  var list = (p && p.addons) || [];
  ga.hidden = !list.length;
  var ag = $('addon-group');
  ag.innerHTML = '';
  list.forEach(function(a) {
    var c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip' + (addonsSel[a] ? ' selected' : '');
    c.textContent = a;
    c.addEventListener('click', function() {
      addonsSel[a] = !addonsSel[a];
      c.classList.toggle('selected', !!addonsSel[a]);
    });
    ag.appendChild(c);
  });
}

/* ════ STEP 3: date, time and place (different for sessions, events, weddings and custom requests) ════ */
function setField(id, cfg) {
  var wrap = $('fld-' + id), input = $('f-' + id), lbl = $('lbl-' + id);
  wrap.hidden = !cfg.show;
  input.dataset.required = (cfg.show && cfg.required) ? '1' : '';
  if (!cfg.show) return;
  setLabel(lbl, cfg.label, cfg.required);
  if (cfg.placeholder !== undefined) input.placeholder = cfg.placeholder;
}

function venueRule() {
  var p = selectedPkg;
  var kind = kindOf();
  if (p && p.venue === false) return null;      /* this package never needs a venue */
  if (p && p.locations && pref.location) {
    for (var i = 0; i < p.locations.length; i++) {
      if (p.locations[i].v === pref.location && p.locations[i].venue) return p.locations[i].venue;
    }
  }
  if (p && p.venue) return p.venue;
  if (kind === 'wedding') return { mode: 'required', label: 'Wedding venue(s) and town', placeholder: 'Ceremony and reception venues' };
  if (kind === 'event')   return { mode: 'required', label: 'Event venue and town', placeholder: 'Where is the event?' };
  if (kind === 'custom')  return { mode: 'optional', label: 'Location (optional)', placeholder: 'Where should we shoot? (if it applies)' };
  return null;
}

function configureWhen() {
  var p = selectedPkg || {};
  var kind = kindOf();

  var copy = {
    session: ['When & where',    'Pick your date',        'Your vision (optional)',          'Mood, inspiration, special requests, outfit ideas…'],
    event:   ['Your event',      'Event details',         'About the occasion (optional)',   'What are we covering? Any moments you do not want us to miss?'],
    wedding: ['Your big day',    'Wedding day details',   'Anything we should know? (optional)', 'Traditional or white wedding, where the prep happens, special moments…'],
    custom:  ['Your request',    'Describe what you need', 'Tell us what you need',          'Describe the shoot or edit, the occasion, your deadline and anything else we should know…']
  }[kind];
  $('when-eyebrow').textContent = copy[0];
  $('when-heading').textContent = copy[1];

  var dateLabel = kind === 'custom' ? 'Preferred date (optional)'
                : p.days === 2      ? 'Day 1 date'
                : kind === 'wedding' ? 'Wedding date'
                : kind === 'event'   ? 'Event date' : 'Preferred date';
  if (p.dateLabel) dateLabel = p.dateLabel;
  setField('date',  { show: true, required: kind !== 'custom', label: dateLabel });
  setField('date2', { show: p.days === 2, required: true, label: 'Day 2 date' });
  setField('time',  { show: kind === 'session', required: true, label: 'Preferred time' });
  setField('starttime', { show: kind === 'event' || kind === 'wedding', required: true, label: 'Start time' });

  var vr = venueRule();
  setField('venue', vr ? { show: true, required: vr.mode === 'required', label: vr.label, placeholder: vr.placeholder || '' } : { show: false });

  var nt = p.notes || { label: copy[2], required: kind === 'custom', placeholder: copy[3] };
  setField('notes', { show: true, required: !!nt.required, label: nt.label, placeholder: nt.placeholder });
}

/* ════ STEP 4: contact details ════ */
function configureDetails() {
  setLabel($('lbl-fname'), 'First name', true);
  setLabel($('lbl-lname'), 'Last name', true);
  setLabel($('lbl-phone'), 'Phone / WhatsApp', true);
  setLabel($('lbl-email'), 'Email address (optional)', false);
}

/* ════ FLOW: steps are skipped when a package has nothing to ask ════ */
var currentStep = 0;
var flow = [0, 1, 2, 3];
var STEP_COUNT = 4;

function computeFlow() {
  flow = [0];
  if (!selectedPkg || hasPrefs()) flow.push(1);
  flow.push(2, 3);
}
function flowPos() { return flow.indexOf(currentStep); }

function prepareStep(step) {
  if (step === 1) configurePrefs();
  if (step === 2) configureWhen();
  if (step === 3) configureDetails();
}

function goTo(step) {
  $('step-' + currentStep).classList.remove('active');
  currentStep = step;
  $('step-' + currentStep).classList.add('active');
  prepareStep(step);
  updateUI();
}

function panelTitle(step) {
  if (step === 0) return 'Choose your <em>package</em>.';
  if (step === 1) return 'Set your <em>preferences</em>.';
  if (step === 2) {
    var k = kindOf();
    if (k === 'event')   return 'Plan your <em>event</em>.';
    if (k === 'wedding') return 'Tell us about the <em>day</em>.';
    if (k === 'custom')  return 'Tell us what you <em>need</em>.';
    return 'Pick the <em>perfect</em> date.';
  }
  return 'Last step — <em>almost</em> there.';
}

function updateUI() {
  var pos = flowPos();
  for (var i = 0; i < STEP_COUNT; i++) {
    var d = $('dot-' + i);
    d.classList.remove('active', 'done');
    d.style.display = flow.indexOf(i) >= 0 ? '' : 'none';
    if (i === currentStep) d.classList.add('active');
    else if (flow.indexOf(i) >= 0 && flow.indexOf(i) < pos) d.classList.add('done');
  }
  $('btn-prev').disabled = pos <= 0;
  $('btn-next-arr').textContent = (pos === flow.length - 1) ? 'Send on WhatsApp' : 'Next';
  $('panel-label').textContent = 'Step ' + (pos + 1) + ' of ' + flow.length;
  $('panel-title').innerHTML = panelTitle(currentStep);
}

$('btn-prev').addEventListener('click', function() {
  var pos = flowPos();
  if (pos > 0) goTo(flow[pos - 1]);
});
$('btn-next-arr').addEventListener('click', function() {
  var msg = validate(currentStep);
  if (msg) { showError(currentStep, msg); return; }
  showError(currentStep, '');
  var pos = flowPos();
  if (pos < flow.length - 1) goTo(flow[pos + 1]);
  else submitForm();
});

/* ════ VALIDATION (required fields are marked with a red * ) ════ */
function showError(step, msg) {
  var el = $('err-' + step);
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
  if (msg && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function markInvalid(el, bad) {
  el.classList.toggle('invalid', !!bad);
}

function validate(step) {
  var p = selectedPkg;

  if (step === 0) {
    return p ? '' : 'Please choose a package to continue.';
  }

  if (step === 1) {
    var missing = [];
    if (p.locations && !pref.location) missing.push('where you would like to shoot');
    if (p.people && !pref.people) missing.push(p.people.key === 'Guests' ? 'the number of guests' : 'how many people');
    return missing.length ? 'Please choose ' + missing.join(' and ') + '.' : '';
  }

  if (step === 2) {
    var bad = false, msg = '';
    ['date', 'date2', 'time', 'starttime', 'venue', 'notes'].forEach(function(id) {
      var el = $('f-' + id);
      var empty = el.dataset.required === '1' && !el.value.trim();
      markInvalid(el, empty);
      if (empty) bad = true;
    });
    if (bad) return 'Please fill in the fields marked with *.';
    var d1 = $('f-date').value, d2 = $('f-date2').value;
    if (d1 && d1 < today) { markInvalid($('f-date'), true); return 'Please choose a date that is today or later.'; }
    if (!$('fld-date2').hidden && d2 && d1 && d2 <= d1) { markInvalid($('f-date2'), true); return 'Day 2 must come after day 1.'; }
    return msg;
  }

  if (step === 3) {
    var problems = false;
    ['f-fname', 'f-lname', 'f-phone'].forEach(function(id) {
      var el = $(id);
      var empty = !el.value.trim();
      markInvalid(el, empty);
      if (empty) problems = true;
    });
    if (problems) return 'Please fill in your name, surname and phone number.';
    var digits = $('f-phone').value.replace(/\D/g, '');
    if (digits.length < 9) { markInvalid($('f-phone'), true); return 'Please enter a phone number we can reach you on, including the area code.'; }
    var email = $('f-email').value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { markInvalid($('f-email'), true); return 'That email address does not look right.'; }
    if (!$('f-consent').checked) return 'Please tick the box to confirm you have read the terms.';
    return '';
  }
  return '';
}

/* clear the red outline as soon as the client fixes a field */
document.querySelector('.panel-right').addEventListener('input', function(e) { markInvalid(e.target, false); });
document.querySelector('.panel-right').addEventListener('change', function(e) { markInvalid(e.target, false); });

/* ════ SEND (opens WhatsApp with the booking pre-filled) ════ */
function val(id) {
  var el = $(id);
  return el && el.value ? el.value.trim() : '';
}

function buildPairs() {
  var p = selectedPkg;
  var pairs = [];
  pairs.push(['Package', p.name + ' (' + priceText(p) + ')']);

  var ads = Object.keys(addonsSel).filter(function(k) { return addonsSel[k]; });
  if (ads.length) pairs.push(['Add-ons', ads.join(', ')]);

  if (pref.location) pairs.push(['Location', pref.location]);
  if (pref.people)   pairs.push([(p.people && p.people.key) || 'People', pref.people]);

  ['date', 'date2', 'time', 'starttime', 'venue', 'notes'].forEach(function(id) {
    if ($('fld-' + id).hidden) return;
    var v = val('f-' + id);
    if (!v) return;
    var label = ($('lbl-' + id).dataset.text || id).replace(/\s*\(optional\)\s*$/i, '');
    pairs.push([label, v]);
  });

  pairs.push(['Name', (val('f-fname') + ' ' + val('f-lname')).trim()]);
  pairs.push(['Phone', val('f-phone')]);
  if (val('f-email')) pairs.push(['Email', val('f-email')]);
  if (val('f-heard')) pairs.push(['Heard about us via', val('f-heard')]);
  return pairs;
}

function submitForm() {
  var p = selectedPkg;
  var pairs = buildPairs();

  var lines = ['Hi Clean Media Pictures, I would like to make a booking.', ''];
  pairs.forEach(function(r) { lines.push(r[0] + ': ' + r[1]); });
  if (p.price) {
    lines.push('');
    lines.push('Please confirm availability. I will pay the 50% deposit of ' + money(Math.round(p.price / 2)) + ' only after you reply.');
  }

  var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
  $('wa-link').setAttribute('href', url);

  /* optional copy of the booking to your own form endpoint */
  if (BOOKING_ENDPOINT) {
    var payload = {};
    pairs.forEach(function(r) { payload[r[0]] = r[1]; });
    try {
      fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function() {});
    } catch (e) { /* the WhatsApp message still goes ahead */ }
  }

  /* final screen: what they booked, the warning, and the bank details */
  $('sum-line').textContent = p.name + ' · ' + priceText(p) + (p.price ? ' · 50% deposit ' + money(Math.round(p.price / 2)) : '');
  $('bank-ref').textContent = (val('f-fname') + ' ' + val('f-lname')).trim() + ' ' + p.name;

  for (var i = 0; i < STEP_COUNT; i++) $('step-' + i).classList.remove('active');
  $('success').style.display = 'flex';
  document.querySelector('.progress-row').style.display = 'none';
  $('panel-label').textContent = 'Last step';
  $('panel-title').innerHTML = 'Send it on <em>WhatsApp</em>.';
  document.querySelector('.panel-right').scrollTop = 0;
  if (window.innerWidth <= 700) $('success').scrollIntoView({ block: 'start' });
  window.open(url, '_blank', 'noopener');
}

/* copy the account number */
$('copy-acc').addEventListener('click', function() {
  var btn = this;
  function done() {
    btn.textContent = 'Copied';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(BANK_ACCOUNT_NUMBER).then(done, function() {});
  } else {
    var ta = document.createElement('textarea');
    ta.value = BANK_ACCOUNT_NUMBER;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
});

/* ════ START ════ */
renderCats();
selectCat(0);
