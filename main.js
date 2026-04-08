const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobileNav');

const PHOTO_BY_SLUG = {
  kavgolovskoe_ozero: 'assets/lake1.jpg',
  ozero_khepoyarvi: 'assets/lake2.jpg',
  severnyy_sklon: 'assets/ski.jpg',
  zubrovnik: 'assets/hero_bg.jpg',
};

const PHOTO_BY_CATEGORY = {
  attractions: 'assets/hero_lake.jpg',
  children: 'assets/summer.jpg',
  sport: 'assets/ski.jpg',
  hidden: 'assets/hero_bg.jpg',
};

const TAG_CLASS_BY_CATEGORY = {
  attractions: 'blue',
  children: 'green',
  sport: 'dark',
  hidden: 'green',
};

const LABEL_BY_CATEGORY = {
  attractions: 'Озеро',
  children: 'Детям',
  sport: 'Спорт',
  hidden: 'Маршрут',
};

const CATEGORY_TITLES = {
  attractions: 'Достопримечательности',
  children: 'Детям',
  sport: 'Спорт',
  hidden: 'Скрытые места',
};

const HERO_DEFAULT = window?.CATALOG_DEFAULTS?.hero ?? {
  title: 'Токсово — место,<br>где хочется',
  highlight: 'остаться',
  lead: 'Сосновые леса, чистые озёра и живописные холмы всего в 30 км от Санкт-Петербурга.',
};

const GENERATED_EVENTS = Array.isArray(window?.CATALOG_EVENTS?.events) && window.CATALOG_EVENTS.events.length
  ? window.CATALOG_EVENTS.events
  : null;

const EVENTS_DEFAULT = GENERATED_EVENTS ?? window?.CATALOG_DEFAULTS?.events ?? [
  { day: '25', month: 'мая', title: 'Открытие летнего сезона в парке', meta: 'Парк Токсово, 12:00' },
  { day: '1', month: 'июн', title: 'Турнир по футболу', meta: 'Стадион Токсово, 10:00' },
  { day: '12', month: 'июн', title: 'День России', meta: 'Площадь, 14:00' },
];
const EVENTS_VISIBLE_LIMIT = 4;

const NEWS_DEFAULT = window?.CATALOG_DEFAULTS?.news ?? [
  { title: 'Летний маршрут к лютеранской церкви снова популярен у туристов', meta: 'Новый маршрут выходного дня по историческим местам Токсово.' },
  { title: 'Турнир среди дворовых команд пройдёт в июне', meta: 'Спортивный календарь поселения пополнился летними матчами.' },
  { title: 'Спортивная инфраструктура Кавголово остаётся одной из визитных карточек района', meta: 'Подготовлен новый обзор активностей для жителей и туристов.' },
];

const TOKSOVO_CENTER = [60.1547, 30.4684];

let heroState = { ...HERO_DEFAULT };
let eventsState = EVENTS_DEFAULT.slice();
let newsState = NEWS_DEFAULT.slice();
const mapResizers = [];

function normalizeSlug(value) {
  return String(value || '').replace(/-/g, '_');
}

function placePageUrl(slug) {
  return `place-${encodeURIComponent(slug)}.html`;
}

function applyHeroText() {
  const title = document.getElementById('heroTitle');
  const highlight = document.getElementById('heroHighlight');
  const lead = document.getElementById('heroLead');

  if (title) title.innerHTML = `${heroState.title} <span id="heroHighlight">${heroState.highlight}</span>`;
  if (highlight) highlight.textContent = heroState.highlight;
  if (lead) lead.textContent = heroState.lead;
}

function featuredPlaces(places) {
  const scored = places
    .filter((place) => place.status === 'verified_public' || place.rating || place.lat)
    .sort((a, b) => {
      const diff = Number(b.rating || 0) - Number(a.rating || 0);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });

  const all = [...scored, ...places];
  const seen = new Set();
  return all.filter((place) => {
    if (!place?.slug || seen.has(place.slug)) return false;
    seen.add(place.slug);
    return true;
  }).slice(0, 8);
}

function trimCardText(text, min = 200, max = 300) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max && value.length >= min) return value;
  if (value.length <= max) return value;

  const cut = value.slice(0, max);
  const splitAt = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('—'));
  if (splitAt >= min - 40) {
    return cut.slice(0, splitAt + 1);
  }
  return `${cut.replace(/\s+\S*$/, '').trim()}…`;
}

function renderPlaces() {
  const root = document.getElementById('placesGrid');
  if (!root) return;

  root.innerHTML = featuredPlaces(PLACES).map((place) => {
    const slugKey = normalizeSlug(place.slug);
    const image = PHOTO_BY_SLUG[slugKey] || PHOTO_BY_CATEGORY[place.categoryId] || 'assets/hero_lake.jpg';
    const tagClass = TAG_CLASS_BY_CATEGORY[place.categoryId] || 'blue';
    const tagLabel = place.subcategory || LABEL_BY_CATEGORY[place.categoryId] || place.category || 'Место';
    const rating = place.rating ? `★ ${place.rating}` : 'Без рейтинга';
    const summary = trimCardText(place.description || 'Описание появится позже.');

    return `
      <article class="place-card">
        <a class="place-card-link" href="${placePageUrl(place.slug)}" aria-label="Карточка ${place.name}">
          <div class="place-image-wrap">
            <img src="${image}" alt="${place.name}" />
            <span class="tag ${tagClass}">${tagLabel}</span>
          </div>
          <div class="place-body">
            <h3>${place.name}</h3>
            <p>${summary}</p>
            <div class="rating">${rating}</div>
          </div>
        </a>
        <button class="fav" type="button" aria-label="Добавить в избранное">♡</button>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.fav').forEach((button) => {
    button.addEventListener('click', () => {
      const active = button.classList.toggle('active');
      button.textContent = active ? '♥' : '♡';
    });
  });
}

function renderCategoryColumns() {
  const root = document.getElementById('categoryColumns');
  if (!root) return;

  const displayLimit = 5;
  const categoryOrder = ['attractions', 'children', 'sport', 'hidden'];

  root.innerHTML = categoryOrder.map((categoryId) => {
    const places = PLACES
      .filter((place) => place.categoryId === categoryId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

    const visible = places.slice(0, displayLimit);
    const hidden = places.slice(displayLimit);

    return `
      <article class="category-list-card" id="cat-${categoryId}">
        <div class="category-list-head">
          <div>
            <h3>${CATEGORY_TITLES[categoryId] || categoryId}</h3>
            <div class="category-count">${places.length} объектов</div>
          </div>
          <span class="category-badge ${categoryId}">${LABEL_BY_CATEGORY[categoryId] || 'Каталог'}</span>
        </div>
        <ul class="category-object-list">
          ${visible.map((place) => `
            <li>
              <a class="category-object-link" href="${placePageUrl(place.slug)}">${place.name}</a>
              <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
            </li>
          `).join('')}
        </ul>
        ${hidden.length ? `
          <ul class="category-object-list category-object-list--hidden" data-hidden="${categoryId}">
            ${hidden.map((place) => `
              <li>
                <a class="category-object-link" href="${placePageUrl(place.slug)}">${place.name}</a>
                <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
              </li>
            `).join('')}
          </ul>
        ` : ''}
        <div class="list-actions">
          ${hidden.length ? `<button class="expand-category" type="button" data-category="${categoryId}">Показать ещё ${hidden.length}</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderEvents() {
  const root = document.getElementById('eventsFeed');
  if (!root) return;

  const visible = eventsState.slice(0, EVENTS_VISIBLE_LIMIT);
  const hidden = eventsState.slice(EVENTS_VISIBLE_LIMIT);

  root.innerHTML = `
    <div class="event-list event-list--visible">
      ${visible.map((event) => `
        <a class="event-item" href="${event.url || '#'}" aria-label="${event.title}">
          <div class="event-date"><strong>${event.day}</strong><span>${event.month}</span></div>
          <div><b>${event.title}</b><small>${event.meta}</small></div>
        </a>
      `).join('')}
    </div>
    ${hidden.length ? `
      <div class="event-list event-list--hidden" data-hidden-events>
        ${hidden.map((event) => `
          <a class="event-item" href="${event.url || '#'}" aria-label="${event.title}">
            <div class="event-date"><strong>${event.day}</strong><span>${event.month}</span></div>
            <div><b>${event.title}</b><small>${event.meta}</small></div>
          </a>
        `).join('')}
      </div>
      <div class="list-actions events-actions">
        <button class="events-toggle" type="button" data-events-toggle data-count="${hidden.length}">
          Показать ещё ${hidden.length}
        </button>
      </div>
    ` : ''}
  `;
}

function renderNews() {
  const root = document.getElementById('newsFeed');
  if (!root) return;

  root.innerHTML = newsState.map((item, index) => `
    <div class="news-row">
      <img src="${index % 3 === 0 ? 'assets/summer.jpg' : index % 3 === 1 ? 'assets/lake2.jpg' : 'assets/ski.jpg'}" alt="${item.title}">
      <span>${item.title}<small>${item.meta}</small></span>
    </div>
  `).join('');
}

function attachExpandListeners() {
  document.querySelectorAll('.expand-category').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.category;
      const hiddenList = document.querySelector(`.category-object-list--hidden[data-hidden="${category}"]`);
      if (!hiddenList) return;
      const expanded = hiddenList.classList.toggle('is-expanded');
      button.textContent = expanded ? 'Свернуть' : `Показать ещё ${hiddenList.children.length}`;
    });
  });
}

function attachEventExpandListeners() {
  document.querySelectorAll('[data-events-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const hiddenList = document.querySelector('[data-hidden-events]');
      if (!hiddenList) return;
      const expanded = hiddenList.classList.toggle('is-expanded');
      button.textContent = expanded ? 'Свернуть' : `Показать ещё ${button.dataset.count || hiddenList.children.length}`;
    });
  });
}

function buildMapPoints() {
  return PLACES.map((place) => ({
    coords: [parseFloat(place.lat), parseFloat(place.lng)],
    place,
  })).filter(({ coords }) => Number.isFinite(coords[0]) && Number.isFinite(coords[1]));
}

function initMaps() {
  if (typeof ymaps === 'undefined') return;

  ymaps.ready(() => {
    const previewNode = document.getElementById('heroMapPreview');
    const fullNode = document.getElementById('fullMap');
    const points = buildMapPoints();

    if (previewNode) {
      const previewMap = new ymaps.Map(previewNode, {
        center: TOKSOVO_CENTER,
        zoom: 11,
        controls: [],
      });
      previewMap.behaviors.disable('scrollZoom');
      points.slice(0, 6).forEach(({ coords, place }) => {
        previewMap.geoObjects.add(new ymaps.Placemark(coords, { hintContent: place.name }, { preset: 'islands#greenDotIcon' }));
      });
      previewMap.container.fitToViewport();
      mapResizers.push(() => previewMap.container.fitToViewport());
    }

    if (fullNode) {
      const fullMap = new ymaps.Map(fullNode, {
        center: TOKSOVO_CENTER,
        zoom: 11,
        controls: ['zoomControl'],
      });
      fullMap.behaviors.disable('scrollZoom');

      const clusterer = new ymaps.Clusterer({
        preset: 'islands#greenClusterIcons',
        groupByCoordinates: false,
      });

      const placemarks = points.map(({ coords, place }) => new ymaps.Placemark(coords, {
        hintContent: place.name,
        balloonContent: `<strong>${place.name}</strong><br>${place.address || place.district || 'Токсово'}<br><a href="${placePageUrl(place.slug)}">Подробнее</a>`,
      }, {
        preset: 'islands#greenDotIcon',
      }));

      clusterer.add(placemarks);
      fullMap.geoObjects.add(clusterer);

      if (placemarks.length) {
        fullMap.setBounds(clusterer.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
      }
      fullMap.container.fitToViewport();
      mapResizers.push(() => fullMap.container.fitToViewport());
    }

    if (mapResizers.length) {
      window.addEventListener('resize', () => {
        mapResizers.forEach((resize) => resize());
      });
    }
  });
}

function renderAll() {
  applyHeroText();
  renderEvents();
  renderNews();
  renderPlaces();
  renderCategoryColumns();
  attachExpandListeners();
  attachEventExpandListeners();
}

function setupNav() {
  if (burger && mobileNav) {
    burger.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  document.querySelectorAll('.mobile-nav a').forEach((link) => {
    link.addEventListener('click', () => mobileNav.classList.remove('open'));
  });
}

setupNav();
renderAll();
initMaps();
