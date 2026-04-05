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
          <a class="place-detail-link" href="place.html?slug=${place.slug}">Открыть карточку →</a>
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

  const categoryOrder = ['attractions', 'children', 'sport', 'hidden'];

  root.innerHTML = categoryOrder.map((categoryId) => {
    const places = PLACES
      .filter((place) => place.categoryId === categoryId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

    const items = places.map((place) => `
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
        <ul class="category-object-list">${items}</ul>
      </article>
    `;
  }).join('');
}

renderPlaces();
renderCategoryColumns();
