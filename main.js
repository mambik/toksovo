const CATEGORY_META = {
  attractions: {
    label: 'Достопримечательности',
    icon: '🏞️',
    description: 'Озёра, панорамы, экотропы и главные точки притяжения.',
  },
  children: {
    label: 'Детям',
    icon: '🧒',
    description: 'Кружки, семейные места, развитие и занятия рядом.',
  },
  sport: {
    label: 'Спорт',
    icon: '⛷️',
    description: 'Горные лыжи, клубы, тренировки и активный отдых.',
  },
  hidden: {
    label: 'Скрытые места',
    icon: '🌲',
    description: 'Менее очевидные локации и локальные рекомендации.',
  },
};

const STATUS_LABELS = {
  verified_public: 'Проверено',
  candidate: 'Требует проверки',
  chat_only: 'Из локальных источников',
};

const MAP_PRESET = {
  attractions: 'islands#darkGreenCircleDotIcon',
  children: 'islands#blueCircleDotIcon',
  sport: 'islands#orangeCircleDotIcon',
  hidden: 'islands#violetCircleDotIcon',
};

const QUICK_LINKS = [
  { icon: '🏠', title: 'О поселении', note: 'История и факты', href: '#about' },
  { icon: '⛰️', title: 'Достопримечательности', note: 'Что посмотреть', href: '#featured' },
  { icon: '🧒', title: 'Детям', note: 'Кружки и секции', href: '#categories' },
  { icon: '🚴', title: 'Спорт', note: 'Для активных', href: '#categories' },
  { icon: '🍃', title: 'Скрытые места', note: 'Малоизвестное', href: '#categories' },
  { icon: '🗓️', title: 'События', note: 'Афиша', href: '#events' },
  { icon: '📰', title: 'Новости', note: 'Главное', href: '#news' },
  { icon: '🧭', title: 'Туристам', note: 'Как добраться', href: '#guide' },
  { icon: '☎️', title: 'Контакты', note: 'Администрация', href: '#guide' },
];

const EVENTS = [
  { day: '25', month: 'мая', title: 'Открытие летнего сезона в парке Токсово', meta: 'Парк Токсово, 12:00', tone: 'news' },
  { day: '1', month: 'июн', title: 'Турнир по футболу', meta: 'Стадион Токсово, 10:00', tone: 'sport' },
  { day: '12', month: 'июн', title: 'День России', meta: 'Центральная площадь, 14:00', tone: 'civic' },
];

const NEWS = [
  { title: 'Благоустройство набережной у озера', meta: 'Новая прогулочная зона и навигация для туристов.', tone: 'news' },
  { title: 'Подготовка летних маршрутов', meta: 'Экотропы и семейные зоны отдыха приводят в порядок к сезону.', tone: 'sport' },
  { title: 'Обновление городского календаря', meta: 'На сайте появятся единые карточки мероприятий и новостей.', tone: 'civic' },
];

function initNavigation() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  const sections = document.querySelectorAll('section[id]');
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.remove('is-active'));
      const active = nav.querySelector(`a[href="#${entry.target.id}"]`);
      if (active) active.classList.add('is-active');
    });
  }, { rootMargin: '-35% 0px -50% 0px' });

  sections.forEach((section) => observer.observe(section));
}

function getCategoryCounts(places) {
  return places.reduce((acc, place) => {
    acc[place.categoryId] = (acc[place.categoryId] || 0) + 1;
    return acc;
  }, {});
}

function renderCounts(places) {
  const total = places.length;
  const withCoords = places.filter((place) => place.lat && place.lng).length;

  const totalNode = document.getElementById('metricTotal');
  const coordsNode = document.getElementById('metricCoords');
  const mapCountNode = document.getElementById('mapObjectsCount');

  if (totalNode) totalNode.textContent = total;
  if (coordsNode) coordsNode.textContent = withCoords;
  if (mapCountNode) mapCountNode.textContent = `${withCoords} объектов на карте`;
}

function renderQuickLinks() {
  const root = document.getElementById('quickPanel');
  if (!root) return;

  root.innerHTML = QUICK_LINKS.map((item) => `
    <a class="quick-link-card" href="${item.href}">
      <span class="quick-link-icon">${item.icon}</span>
      <strong>${item.title}</strong>
      <small>${item.note}</small>
    </a>
  `).join('');
}

function renderCategories(places) {
  const root = document.getElementById('categoryGrid');
  if (!root) return;

  const counts = getCategoryCounts(places);

  root.innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const items = places
      .filter((place) => place.categoryId === key)
      .slice(0, 3)
      .map((place) => `<li>${place.name}</li>`)
      .join('');

    return `
      <article class="category-card">
        <div class="category-head">
          <div class="category-badge ${key}">${meta.icon}</div>
          <span class="category-count">${counts[key] || 0} мест</span>
        </div>
        <div>
          <h3>${meta.label}</h3>
          <p>${meta.description}</p>
        </div>
        <ul>${items}</ul>
      </article>
    `;
  }).join('');
}

function featuredPlaces(places) {
  const verified = places.filter((place) => place.status === 'verified_public');
  const rated = verified
    .filter((place) => place.rating)
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  const unique = [];
  const seen = new Set();

  [...rated, ...verified, ...places].forEach((place) => {
    if (seen.has(place.slug)) return;
    seen.add(place.slug);
    unique.push(place);
  });

  return unique.slice(0, 4);
}

function renderFeatured(places) {
  const root = document.getElementById('featuredGrid');
  if (!root) return;

  root.innerHTML = featuredPlaces(places).map((place) => {
    const rating = place.rating ? `${place.rating}` : '4.6';
    const category = CATEGORY_META[place.categoryId]?.label || place.category;
    const status = STATUS_LABELS[place.status] || place.status || 'каталог';

    return `
      <article class="place-card">
        <div class="place-visual ${place.categoryId}">
          <div class="place-meta">
            <span class="meta-pill">${category}</span>
            <span class="meta-like">♡</span>
          </div>
        </div>
        <div class="place-body">
          <div>
            <h3>${place.name}</h3>
            <p>${place.description || 'Описание появится здесь.'}</p>
          </div>
          <div class="place-statline">
            <span class="place-rating">★ ${rating}</span>
            <span>${status}</span>
          </div>
          <div class="place-actions">
            <a class="place-link" href="place.html?slug=${place.slug}">Открыть карточку →</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderEvents() {
  const root = document.getElementById('eventsFeed');
  if (!root) return;

  root.innerHTML = EVENTS.map((item) => `
    <article class="feed-item">
      <div class="feed-date">
        <span class="feed-day">${item.day}</span>
        <span class="feed-month">${item.month}</span>
      </div>
      <div class="feed-copy">
        <strong>${item.title}</strong>
        <span>${item.meta}</span>
      </div>
      <div class="feed-thumb ${item.tone}"></div>
    </article>
  `).join('');
}

function renderNews() {
  const root = document.getElementById('newsFeed');
  if (!root) return;

  root.innerHTML = NEWS.map((item) => `
    <article class="feed-item">
      <div class="feed-date">
        <span class="feed-day">•</span>
        <span class="feed-month">новость</span>
      </div>
      <div class="feed-copy">
        <strong>${item.title}</strong>
        <span>${item.meta}</span>
      </div>
      <div class="feed-thumb ${item.tone}"></div>
    </article>
  `).join('');
}

function initHomeMap(places) {
  const mapRoot = document.getElementById('home-map');
  if (!mapRoot || typeof ymaps === 'undefined') return;

  const mapPlaces = places.filter((place) => place.lat && place.lng);
  if (!mapPlaces.length) return;

  const filters = [...document.querySelectorAll('[data-map-filter]')];
  const collections = {};
  let activeFilter = 'all';
  let map;

  function syncCollections() {
    ['attractions', 'children', 'sport', 'hidden'].forEach((cat) => {
      if (!collections[cat]) return;
      if (activeFilter === 'all' || activeFilter === cat) {
        map.geoObjects.add(collections[cat]);
      } else {
        map.geoObjects.remove(collections[cat]);
      }
    });
  }

  ymaps.ready(() => {
    const lats = mapPlaces.map((place) => place.lat);
    const lngs = mapPlaces.map((place) => place.lng);
    const center = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];

    map = new ymaps.Map('home-map', {
      center,
      zoom: 12,
      controls: ['zoomControl'],
    }, { suppressMapOpenBlock: true });

    ['attractions', 'children', 'sport', 'hidden'].forEach((cat) => {
      collections[cat] = new ymaps.GeoObjectCollection();
      map.geoObjects.add(collections[cat]);
    });

    mapPlaces.forEach((place) => {
      const mark = new ymaps.Placemark([place.lat, place.lng], {
        balloonContentHeader: place.name,
        balloonContentBody: `${CATEGORY_META[place.categoryId]?.label || place.category}<br><a href="place.html?slug=${place.slug}" style="color:#17362c;font-weight:700">Открыть карточку →</a>`,
        hintContent: place.name,
      }, {
        preset: MAP_PRESET[place.categoryId] || 'islands#grayCircleDotIcon',
      });

      collections[place.categoryId]?.add(mark);
    });

    map.setBounds(map.geoObjects.getBounds(), {
      checkZoomRange: true,
      zoomMargin: [20, 20, 20, 20],
    });

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.mapFilter;
        filters.forEach((item) => item.classList.toggle('active', item === button));
        syncCollections();
      });
    });
  });
}

function initHome() {
  if (typeof PLACES === 'undefined' || !Array.isArray(PLACES)) return;
  renderCounts(PLACES);
  renderQuickLinks();
  renderCategories(PLACES);
  renderFeatured(PLACES);
  renderEvents();
  renderNews();
  initHomeMap(PLACES);
}

initNavigation();
initHome();
