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

  return unique.slice(0, 6);
}

function renderFeatured(places) {
  const root = document.getElementById('featuredGrid');
  if (!root) return;

  root.innerHTML = featuredPlaces(places).map((place) => {
    const rating = place.rating ? `★ ${place.rating}` : 'без рейтинга';
    const category = CATEGORY_META[place.categoryId]?.label || place.category;
    const status = STATUS_LABELS[place.status] || place.status || 'каталог';
    const location = place.district || place.address || 'Токсово';

    return `
      <article class="place-card">
        <div class="place-visual">
          <div class="place-meta">
            <span class="meta-pill">${category}</span>
            <span class="meta-pill">${place.subcategory || 'место'}</span>
          </div>
          <div class="place-landscape" aria-hidden="true">
            <span class="hill hill-back"></span>
            <span class="hill hill-front"></span>
            <span class="tree t1"></span>
            <span class="tree t2"></span>
            <span class="tree t3"></span>
            <span class="water"></span>
          </div>
        </div>
        <div class="place-body">
          <div>
            <h3>${place.name}</h3>
            <p>${place.description || 'Описание появится здесь.'}</p>
          </div>
          <div class="place-statline">
            <span>${rating}</span>
            <span>${location}</span>
          </div>
          <div class="place-actions">
            <a class="place-link" href="place.html?slug=${place.slug}">Открыть карточку →</a>
            <span class="place-status">${status}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
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
      zoomMargin: [24, 24, 24, 24],
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
  renderCategories(PLACES);
  renderFeatured(PLACES);
  initHomeMap(PLACES);
}

initNavigation();
initHome();
