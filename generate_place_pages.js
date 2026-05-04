const fs = require('fs');
const vm = require('vm');

const SITE_ORIGIN = 'https://toksovo.info';
const PLACE_TEMPLATE = fs.readFileSync('place.html', 'utf8');
const PREFIX = PLACE_TEMPLATE.split('<div id="app"></div>')[0];
const DATA_CODE = fs.readFileSync('data.js', 'utf8') + '\nthis.__PLACES = PLACES;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(DATA_CODE, sandbox);

const PLACES = Array.isArray(sandbox.__PLACES) ? sandbox.__PLACES : [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function absoluteUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_ORIGIN}/${String(value).replace(/^\/+/, '')}`;
}

function cleanMetaText(parts) {
  return parts
    .filter(Boolean)
    .map((value) => String(value).replace(/\s+/g, ' ').replace(/[.]+$/g, '').trim())
    .filter(Boolean)
    .join(' · ');
}

function slugToTitle(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildImages(place) {
  return [];
}

function photoAlt(place, index) {
  return index === 0 ? `${place.name} - главное фото` : `${place.name} - фото ${index + 1}`;
}

function renderGallery(place) {
  return '';
}

function infoCard(label, value, isLink = false) {
  if (!value) return '';
  const content = isLink
    ? `<a href="${escapeAttr(value)}" target="_blank" rel="noopener">${escapeHtml(String(value).replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`
    : escapeHtml(value);
  return `
    <div class="info-card">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value">${content}</div>
    </div>
  `;
}

function snapshotItem(label, value, isLink = false) {
  if (!value) return '';
  const content = isLink
    ? `<a href="${escapeAttr(value)}" target="_blank" rel="noopener">${escapeHtml(String(value).replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`
    : escapeHtml(value);
  return `
    <div class="snapshot-item">
      <div class="snapshot-label">${escapeHtml(label)}</div>
      <div class="snapshot-value">${content}</div>
    </div>
  `;
}

function buildMeta(place, images) {
  const category = place.category || 'Место';
  const description = cleanMetaText([
    place.description,
    place.address,
    place.district && place.district !== place.address ? place.district : '',
    category,
  ]).slice(0, 180);
  const canonical = `${SITE_ORIGIN}/place-${place.slug}.html`;
  const image = absoluteUrl('assets/hero_lake.jpg');
  const title = `${place.name} — Токсово`;

  return { title, description, canonical, image };
}

function replaceMeta(prefix, meta, jsonLd) {
  return prefix
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta name="description" id="metaDescription" content="[^"]*" \/>/, `<meta name="description" id="metaDescription" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta name="robots" id="robotsMeta" content="[^"]*" \/>/, '<meta name="robots" id="robotsMeta" content="index,follow" />')
    .replace(/<link rel="canonical" id="canonicalLink" href="[^"]*" \/>/, `<link rel="canonical" id="canonicalLink" href="${escapeAttr(meta.canonical)}" />`)
    .replace(/<meta property="og:title" id="ogTitle" content="[^"]*" \/>/, `<meta property="og:title" id="ogTitle" content="${escapeAttr(meta.title)}" />`)
    .replace(/<meta property="og:description" id="ogDescription" content="[^"]*" \/>/, `<meta property="og:description" id="ogDescription" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta property="og:url" id="ogUrl" content="[^"]*" \/>/, `<meta property="og:url" id="ogUrl" content="${escapeAttr(meta.canonical)}" />`)
    .replace(/<meta property="og:image" id="ogImage" content="[^"]*" \/>/, `<meta property="og:image" id="ogImage" content="${escapeAttr(meta.image)}" />`)
    .replace(/<meta name="twitter:title" id="twitterTitle" content="[^"]*" \/>/, `<meta name="twitter:title" id="twitterTitle" content="${escapeAttr(meta.title)}" />`)
    .replace(/<meta name="twitter:description" id="twitterDescription" content="[^"]*" \/>/, `<meta name="twitter:description" id="twitterDescription" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta name="twitter:image" id="twitterImage" content="[^"]*" \/>/, `<meta name="twitter:image" id="twitterImage" content="${escapeAttr(meta.image)}" />`)
    .replace(/<script type="application\/ld\+json" id="placeJsonLd"><\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`);
}

function renderPlace(place) {
  const images = buildImages(place);
  const meta = buildMeta(place, images);
  const category = place.category || 'Каталог';
  const statusMap = {
    verified_public: 'Проверено',
    candidate: 'Требует проверки',
    chat_only: 'Локальный источник',
  };
  const status = statusMap[place.status] || place.status || 'Каталог';
  const subtitle = [place.subcategory, place.age ? `${place.age} лет` : '', place.district].filter(Boolean).join(' · ');
  const canonical = meta.canonical;
  const seoDescription = meta.description;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: place.name,
    description: seoDescription || place.description || `Карточка места: ${place.name} в Токсово.`,
    url: canonical,
    image: meta.image,
    address: place.address || place.district || undefined,
    geo: place.lat && place.lng ? {
      '@type': 'GeoCoordinates',
      latitude: place.lat,
      longitude: place.lng,
    } : undefined,
    telephone: place.phone || undefined,
    sameAs: place.website || undefined,
  };

  const overview = `
    <section class="card place-overview">
      <div class="place-overview-top">
        <div class="place-overview-copy">
          <h2>Описание</h2>
          <p>${escapeHtml(place.description || 'Подробное описание пока отсутствует.')}</p>
        </div>
        <aside class="place-snapshot">
          <h2>Коротко</h2>
          <div class="snapshot-list">
            ${snapshotItem('Адрес', place.address)}
            ${snapshotItem('Район', place.district)}
            ${snapshotItem('Телефон', place.phone)}
            ${snapshotItem('Сайт', place.website, true)}
          </div>
        </aside>
      </div>
      <div class="place-details">
        <h2>Детали</h2>
        <div class="info-grid">
          ${infoCard('Цена', place.price)}
          ${infoCard('Возраст', place.age)}
          ${infoCard('Формат', place.format)}
          ${infoCard('Рейтинг', place.rating)}
        </div>
      </div>
    </section>
  `;

  const media = `
    <div class="media-row">
      ${renderGallery(place)}
      <section class="card map-sidebar">
        <h2>Карта</h2>
        <p>Расположение объекта и быстрый ориентир на местности.</p>
        <div id="place-map"></div>
      </section>
    </div>
  `;

  const content = `
    <section class="hero">
      <div class="container hero-inner">
        <div>
          <div class="tags">
            <span class="tag">${escapeHtml(category)}</span>
            <span class="tag">${escapeHtml(status)}</span>
          </div>
          <h1>${escapeHtml(place.name)}</h1>
          ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
          <div class="hero-actions">
            <a class="btn btn-primary" href="index.html#mapSection">Открыть карту</a>
            ${place.website ? `<a class="btn btn-secondary" href="${escapeAttr(place.website)}" target="_blank" rel="noopener">Перейти на сайт</a>` : ''}
          </div>
        </div>
      </div>
    </section>

    <div class="container place-main">
      ${place.lat && place.lng ? media : renderGallery(place)}
      ${overview}
    </div>
  `;

  const mapScript = place.lat && place.lng ? `
    <script src="https://api-maps.yandex.ru/2.1/?apikey=8e92e0f0-e860-4047-9d12-7a329837fd4e&lang=ru_RU&coordorder=latlong" type="text/javascript"></script>
    <script>
      ymaps.ready(() => {
        const map = new ymaps.Map('place-map', {
          center: [${place.lat}, ${place.lng}],
          zoom: 15,
          controls: ['zoomControl'],
        }, { suppressMapOpenBlock: true });
        map.geoObjects.add(new ymaps.Placemark([${place.lat}, ${place.lng}], {
          balloonContent: ${JSON.stringify(place.name)},
          hintContent: ${JSON.stringify(place.name)},
        }, { preset: 'islands#darkGreenCircleDotIcon' }));
        map.container.fitToViewport();
        window.addEventListener('resize', () => map.container.fitToViewport());
      });
    </script>
  ` : '';

  const navScript = `
    <script>
      const burger = document.getElementById('burger');
      const mobileNav = document.getElementById('mobileNav');
      if (burger && mobileNav) {
        burger.addEventListener('click', () => mobileNav.classList.toggle('open'));
      }
      document.querySelectorAll('.mobile-nav a').forEach((link) => {
        link.addEventListener('click', () => mobileNav.classList.remove('open'));
      });
    </script>
  `;

  const html = replaceMeta(PREFIX, meta, jsonLd);
  return `${html}${content}\n${mapScript}\n${navScript}\n</body>\n</html>\n`;
}

function main() {
  const generatedFiles = new Set();
  let count = 0;
  for (const place of PLACES) {
    if (!place || !place.slug) continue;
    const fileName = `place-${place.slug}.html`;
    fs.writeFileSync(fileName, renderPlace(place));
    generatedFiles.add(fileName);
    count += 1;
  }

  for (const entry of fs.readdirSync('.')) {
    if (!/^place-.*\.html$/i.test(entry) || entry === 'place.html') continue;
    if (!generatedFiles.has(entry)) {
      fs.unlinkSync(entry);
    }
  }

  console.log(`Generated ${count} place pages.`);
}

main();
