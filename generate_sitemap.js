const fs = require('fs');
const vm = require('vm');

const SITE_ORIGIN = 'https://toksovo.info';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());

const code = fs.readFileSync('data.js', 'utf8') + '\nthis.__PLACES = PLACES;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const places = Array.isArray(sandbox.__PLACES) ? sandbox.__PLACES.filter((place) => place && place.slug) : [];

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const urls = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/map.html`,
  `${SITE_ORIGIN}/dostoprimechatelnosti-toksovo.html`,
  ...places.map((place) => `${SITE_ORIGIN}/place-${encodeURIComponent(place.slug)}.html`),
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${esc(url)}</loc><lastmod>${TODAY}</lastmod></url>`),
  '</urlset>',
].join('\n') + '\n';

fs.writeFileSync('sitemap.xml', sitemap);
fs.writeFileSync(
  'robots.txt',
  'User-agent: *\nAllow: /\nSitemap: https://toksovo.info/sitemap.xml\n',
);
