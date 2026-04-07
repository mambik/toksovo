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

const STORAGE_KEYS = {
  hero: 'toksovo-hero',
  events: 'toksovo-events',
  news: 'toksovo-news',
  catalog: 'toksovo-catalog-edits',
  admin: 'toksovo-admin-unlocked',
};

const ADMIN_PASSWORD = 'toksovo-admin-2026';

const HERO_DEFAULT = {
  title: 'Токсово — место,<br>где хочется',
  highlight: 'остаться',
  lead: 'Сосновые леса, чистые озёра и живописные холмы всего в 30 км от Санкт-Петербурга.',
};

const EVENTS_DEFAULT = [
  { day: '25', month: 'мая', title: 'Открытие летнего сезона в парке', meta: 'Парк Токсово, 12:00' },
  { day: '1', month: 'июн', title: 'Турнир по футболу', meta: 'Стадион Токсово, 10:00' },
  { day: '12', month: 'июн', title: 'День России', meta: 'Площадь, 14:00' },
];

const NEWS_DEFAULT = [
  { title: 'Летний маршрут к лютеранской церкви снова популярен у туристов', meta: 'Новый маршрут выходного дня по историческим местам Токсово.' },
  { title: 'Турнир среди дворовых команд пройдёт в июне', meta: 'Спортивный календарь поселения пополнился летними матчами.' },
  { title: 'Спортивная инфраструктура Кавголово остаётся одной из визитных карточек района', meta: 'Подготовлен новый обзор активностей для жителей и туристов.' },
];

const TOKSOVO_CENTER = [60.1547, 30.4684];

let heroState = { ...HERO_DEFAULT };
let eventsState = EVENTS_DEFAULT.slice();
let newsState = NEWS_DEFAULT.slice();
let adminUnlocked = false;

function loadFromStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error('loadFromStorage', error);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('saveToStorage', error);
  }
}

function applyStoredState() {
  heroState = { ...HERO_DEFAULT, ...(loadFromStorage(STORAGE_KEYS.hero, {}) || {}) };
  eventsState = loadFromStorage(STORAGE_KEYS.events, EVENTS_DEFAULT.slice()) || EVENTS_DEFAULT.slice();
  newsState = loadFromStorage(STORAGE_KEYS.news, NEWS_DEFAULT.slice()) || NEWS_DEFAULT.slice();
  adminUnlocked = Boolean(loadFromStorage(STORAGE_KEYS.admin, false));

  const overrides = loadFromStorage(STORAGE_KEYS.catalog, []);
  if (!Array.isArray(overrides)) return;
  overrides.forEach((entry) => {
    const target = PLACES.find((item) => item.slug === entry.slug);
    if (target) {
      target.name = entry.name;
      target.description = entry.description;
    }
  });
}

function normalizeSlug(value) {
  return String(value || '').replace(/-/g, '_');
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
  }).slice(0, 12);
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
    const extra = place.address || place.district || 'Токсово';

    return `
      <article class="place-card">
        <div class="place-image-wrap">
          <img src="${image}" alt="${place.name}" />
          <span class="tag ${tagClass}">${tagLabel}</span>
          <button class="fav" type="button" aria-label="Добавить в избранное">♡</button>
        </div>
        <div class="place-body">
          <h3>${place.name}</h3>
          <p>${place.description || 'Описание появится позже.'}</p>
          <div class="rating">${rating} <span>${extra}</span></div>
          <div class="place-actions">
            <a class="place-detail-link" href="place.html?slug=${place.slug}">Открыть карточку →</a>
            ${adminUnlocked ? `<button class="edit-btn" type="button" data-slug="${place.slug}">Редактировать</button>` : ''}
          </div>
        </div>
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
              <a class="category-object-link" href="place.html?slug=${place.slug}">${place.name}</a>
              <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
            </li>
          `).join('')}
        </ul>
        ${hidden.length ? `
          <ul class="category-object-list category-object-list--hidden" data-hidden="${categoryId}">
            ${hidden.map((place) => `
              <li>
                <a class="category-object-link" href="place.html?slug=${place.slug}">${place.name}</a>
                <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
              </li>
            `).join('')}
          </ul>
        ` : ''}
        <div class="list-actions">
          ${adminUnlocked ? `<button class="edit-category-btn" type="button" data-category="${categoryId}">Редактировать первую</button>` : ''}
          ${hidden.length ? `<button class="expand-category" type="button" data-category="${categoryId}">Показать ещё ${hidden.length}</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderEvents() {
  const root = document.getElementById('eventsFeed');
  if (!root) return;

  root.innerHTML = eventsState.map((event) => `
    <div class="event-item">
      <div class="event-date"><strong>${event.day}</strong><span>${event.month}</span></div>
      <div><b>${event.title}</b><small>${event.meta}</small></div>
    </div>
  `).join('');
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

function openEditor(slug) {
  if (!adminUnlocked) return;
  const place = PLACES.find((item) => item.slug === slug);
  if (!place) return;

  const modal = document.createElement('div');
  modal.className = 'editor-modal';
  modal.innerHTML = `
    <div class="editor-modal__inner">
      <header>
        <h3>Редактировать "${place.name}"</h3>
        <button type="button" class="editor-close">×</button>
      </header>
      <label>
        Название
        <input name="name" type="text" value="${place.name}" />
      </label>
      <label>
        Описание
        <textarea name="description">${place.description || ''}</textarea>
      </label>
      <div class="editor-actions">
        <button type="button" class="editor-save">Сохранить</button>
        <button type="button" class="editor-close">Отмена</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelectorAll('.editor-close').forEach((button) => button.addEventListener('click', closeModal));
  modal.querySelector('.editor-save').addEventListener('click', () => {
    place.name = modal.querySelector('input[name="name"]').value.trim() || place.name;
    place.description = modal.querySelector('textarea[name="description"]').value.trim();

    const overrides = loadFromStorage(STORAGE_KEYS.catalog, []).filter((item) => item.slug !== place.slug);
    overrides.push({ slug: place.slug, name: place.name, description: place.description });
    saveToStorage(STORAGE_KEYS.catalog, overrides);

    renderAll();
    closeModal();
  });
}

function attachEditListeners() {
  document.querySelectorAll('.edit-btn').forEach((button) => {
    button.addEventListener('click', () => openEditor(button.dataset.slug));
  });

  document.querySelectorAll('.edit-category-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const place = PLACES.find((item) => item.categoryId === button.dataset.category);
      if (place) openEditor(place.slug);
    });
  });
}

function syncAdminVisibility() {
  const locked = document.getElementById('adminLocked');
  const content = document.getElementById('adminContent');
  const unlockButton = document.getElementById('adminUnlockBtn');

  if (!locked || !content || !unlockButton) return;

  if (adminUnlocked) {
    locked.classList.add('is-hidden');
    content.classList.remove('is-hidden');
    unlockButton.textContent = 'Доступ открыт';
    unlockButton.disabled = true;
  } else {
    locked.classList.remove('is-hidden');
    content.classList.add('is-hidden');
    unlockButton.textContent = 'Войти';
    unlockButton.disabled = false;
  }
}

function setupAdmin() {
  syncAdminVisibility();

  const unlockButton = document.getElementById('adminUnlockBtn');
  const logoutButton = document.getElementById('adminLogoutBtn');
  const gate = document.getElementById('adminGate');
  const gateClose = document.getElementById('adminGateClose');
  const gateForm = document.getElementById('adminGateForm');
  const gateError = document.getElementById('adminGateError');

  if (unlockButton && gate) {
    unlockButton.addEventListener('click', () => gate.classList.remove('is-hidden'));
  }

  if (gateClose && gate) {
    gateClose.addEventListener('click', () => {
      gate.classList.add('is-hidden');
      gateError.textContent = '';
    });
  }

  if (gateForm && gate) {
    gateForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const password = gateForm.elements.password.value;
      if (password !== ADMIN_PASSWORD) {
        gateError.textContent = 'Неверный пароль.';
        return;
      }

      adminUnlocked = true;
      saveToStorage(STORAGE_KEYS.admin, true);
      gate.classList.add('is-hidden');
      gateForm.reset();
      gateError.textContent = '';
      renderAll();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      adminUnlocked = false;
      saveToStorage(STORAGE_KEYS.admin, false);
      renderAll();
    });
  }

  const heroForm = document.getElementById('heroEditor');
  if (heroForm) {
    heroForm.elements.title.value = heroState.title.replace('<br>', ' ');
    heroForm.elements.highlight.value = heroState.highlight;
    heroForm.elements.lead.value = heroState.lead;
    heroForm.addEventListener('submit', (event) => {
      event.preventDefault();
      heroState.title = heroForm.elements.title.value.trim() || HERO_DEFAULT.title;
      heroState.highlight = heroForm.elements.highlight.value.trim() || HERO_DEFAULT.highlight;
      heroState.lead = heroForm.elements.lead.value.trim() || HERO_DEFAULT.lead;
      saveToStorage(STORAGE_KEYS.hero, heroState);
      applyHeroText();
    });
  }

  const eventForm = document.getElementById('eventEditor');
  if (eventForm) {
    eventForm.elements.events.value = JSON.stringify(eventsState, null, 2);
    eventForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        eventsState = JSON.parse(eventForm.elements.events.value);
        saveToStorage(STORAGE_KEYS.events, eventsState);
        renderEvents();
      } catch (error) {
        alert('Проверь JSON событий.');
      }
    });
  }

  const newsForm = document.getElementById('newsEditor');
  if (newsForm) {
    newsForm.elements.news.value = JSON.stringify(newsState, null, 2);
    newsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        newsState = JSON.parse(newsForm.elements.news.value);
        saveToStorage(STORAGE_KEYS.news, newsState);
        renderNews();
      } catch (error) {
        alert('Проверь JSON новостей.');
      }
    });
  }

  const resetButton = document.getElementById('resetOverrides');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      window.location.reload();
    });
  }
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
        balloonContent: `<strong>${place.name}</strong><br>${place.address || place.district || 'Токсово'}<br><a href="place.html?slug=${place.slug}">Открыть карточку</a>`,
      }, {
        preset: 'islands#greenDotIcon',
      }));

      clusterer.add(placemarks);
      fullMap.geoObjects.add(clusterer);

      if (placemarks.length) {
        fullMap.setBounds(clusterer.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
      }
    }
  });
}

function renderAll() {
  applyHeroText();
  renderEvents();
  renderNews();
  renderPlaces();
  renderCategoryColumns();
  syncAdminVisibility();
  attachExpandListeners();
  attachEditListeners();
}

function setupNav() {
  if (burger && mobileNav) {
    burger.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  document.querySelectorAll('.mobile-nav a').forEach((link) => {
    link.addEventListener('click', () => mobileNav.classList.remove('open'));
  });
}

applyStoredState();
setupNav();
renderAll();
setupAdmin();
initMaps();
