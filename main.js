const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobileNav');

const PHOTO_BY_SLUG = {
  'kavgolovskoe-ozero': 'assets/lake1.jpg',
  'ozero-khepoyarvi': 'assets/lake2.jpg',
  'kavgolovskie-toksovskie-vysoty': 'assets/hero_bg.jpg',
  'severnyy-sklon': 'assets/ski.jpg',
  'severnyy-sklon-2': 'assets/ski.jpg',
  'utts-kavgolovo': 'assets/ski.jpg',
  'utts-kavgolovo-2': 'assets/ski.jpg',
  'stantsiya-kavgolovo-vidovaya': 'assets/hero_lake.jpg',
  'tserkov-arkhangela-mikhaila': 'assets/summer.jpg',
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

const STORAGE_KEY = 'toksovo-catalog-edits';

function loadOverrides() {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const overrides = JSON.parse(raw);
    overrides.forEach((entry) => {
      const target = PLACES.find((item) => item.slug === entry.slug);
      if (target) Object.assign(target, entry);
    });
  } catch (error) {
    console.error('loadOverrides', error);
  }
}

function saveOverride(place) {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = list.filter((item) => item.slug !== place.slug);
    filtered.push({
      slug: place.slug,
      name: place.name,
      description: place.description,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('saveOverride', error);
  }
}

if (burger && mobileNav) {
  burger.addEventListener('click', () => mobileNav.classList.toggle('open'));
}

document.querySelectorAll('.mobile-nav a').forEach((link) => {
  link.addEventListener('click', () => mobileNav.classList.remove('open'));
});

document.querySelectorAll('.fav').forEach((button) => {
  button.addEventListener('click', () => {
    const active = button.classList.toggle('active');
    button.textContent = active ? '♥' : '♡';
  });
});

function featuredPlaces(places) {
  const scored = places
    .filter((place) => place.status === 'verified_public' || place.rating || place.lat)
    .sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });

  const fallback = places.slice();
  const unique = [];
  const seen = new Set();

  [...scored, ...fallback].forEach((place) => {
    if (!place?.slug || seen.has(place.slug)) return;
    seen.add(place.slug);
    unique.push(place);
  });

  return unique.slice(0, 12);
}

function renderPlaces() {
  const root = document.getElementById('placesGrid');
  if (!root) return;

  if (typeof PLACES === 'undefined' || !Array.isArray(PLACES) || PLACES.length === 0) {
    root.innerHTML = '<div class="empty-places">Каталог мест пока не загрузился.</div>';
    return;
  }

  root.innerHTML = featuredPlaces(PLACES).map((place) => {
    const image = PHOTO_BY_SLUG[place.slug] || PHOTO_BY_CATEGORY[place.categoryId] || 'assets/hero_lake.jpg';
    const tagClass = TAG_CLASS_BY_CATEGORY[place.categoryId] || 'blue';
    const tagLabel = place.subcategory || LABEL_BY_CATEGORY[place.categoryId] || place.category || 'Место';
    const rating = place.rating ? `★ ${place.rating}` : 'Без рейтинга';
    const extra = place.rating ? (place.district || place.address || 'Токсово') : (place.address || place.district || 'Токсово');

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
            <button class="edit-btn" type="button" data-slug="${place.slug}">Редактировать</button>
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

  if (typeof PLACES === 'undefined' || !Array.isArray(PLACES) || PLACES.length === 0) {
    root.innerHTML = '<div class="empty-places">Каталог категорий пока не загрузился.</div>';
    return;
  }

  const DISPLAY_LIMIT = 5;
  const categoryOrder = ['attractions', 'children', 'sport', 'hidden'];

  root.innerHTML = categoryOrder.map((categoryId) => {
    const places = PLACES
      .filter((place) => place.categoryId === categoryId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

    const visible = places.slice(0, DISPLAY_LIMIT);
    const hidden = places.slice(DISPLAY_LIMIT);

    const visibleItems = visible.map((place) => `
      <li>
        <a class="category-object-link" href="place.html?slug=${place.slug}">${place.name}</a>
        <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
      </li>
    `).join('');

    const hiddenItems = hidden.map((place) => `
      <li>
        <a class="category-object-link" href="place.html?slug=${place.slug}">${place.name}</a>
        <span class="category-object-meta">${place.subcategory || place.district || place.address || 'Токсово'}</span>
      </li>
    `).join('');

    return `
      <article class="category-list-card" id="cat-${categoryId}">
        <div class="category-list-head">
          <div>
            <h3>${CATEGORY_TITLES[categoryId] || categoryId}</h3>
            <div class="category-count">${places.length} объектов</div>
          </div>
          <span class="category-badge ${categoryId}">${LABEL_BY_CATEGORY[categoryId] || 'Каталог'}</span>
        </div>
        <ul class="category-object-list">${visibleItems}</ul>
        ${hidden.length ? `<ul class="category-object-list category-object-list--hidden" data-hidden="${categoryId}">${hiddenItems}</ul>` : ''}
        <div class="list-actions">
          <button class="edit-category-btn" type="button" data-category="${categoryId}">Редактировать первую</button>
          ${hidden.length ? `<button class="expand-category" type="button" data-category="${categoryId}">Показать ещё ${hidden.length}</button>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function attachEditListeners() {
  document.querySelectorAll('.edit-btn').forEach((button) => {
    button.addEventListener('click', () => openEditor(button.dataset.slug));
  });
  document.querySelectorAll('.edit-category-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.category;
      const place = PLACES.find((item) => item.categoryId === category);
      if (place) openEditor(place.slug);
    });
  });
  document.querySelectorAll('.category-object-link').forEach((link) => {
    const params = new URL(link.href, window.location.origin).searchParams;
    const slug = params.get('slug');
    if (!slug) return;
    const btn = document.createElement('button');
    btn.className = 'inline-edit';
    btn.type = 'button';
    btn.textContent = '✎';
    btn.dataset.slug = slug;
    link.after(btn);
    btn.addEventListener('click', () => openEditor(slug));
  });
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
  modal.querySelectorAll('.editor-close').forEach((btn) => btn.addEventListener('click', closeModal));
  modal.querySelector('.editor-save').addEventListener('click', () => {
    const name = modal.querySelector('input[name="name"]').value.trim();
    const description = modal.querySelector('textarea[name="description"]').value.trim();
    if (!name) return;
    place.name = name;
    place.description = description;
    saveOverride(place);
    renderPlaces();
    renderCategoryColumns();
    attachEditListeners();
    closeModal();
  });
}

loadOverrides();
renderPlaces();
renderCategoryColumns();
attachEditListeners();
attachExpandListeners();
