function makeLoopScroller(scrollEl, contentEl, onWrap) {
  contentEl = contentEl || scrollEl
  const originalChildren = Array.from(contentEl.children)
  if (!originalChildren.length) return null
  while (contentEl.children.length < originalChildren.length * 3) {
    originalChildren.forEach((child) =>
      contentEl.appendChild(child.cloneNode(true))
    )
  }
  const setWidth = scrollEl.scrollWidth / 3
  scrollEl.scrollLeft = setWidth

  scrollEl.addEventListener('scroll', () => {
    if (scrollEl.scrollLeft <= 0) {
      scrollEl.scrollLeft += setWidth
      onWrap?.(setWidth)
    } else if (scrollEl.scrollLeft >= setWidth * 2) {
      scrollEl.scrollLeft -= setWidth
      onWrap?.(-setWidth)
    }
  })

  return { setWidth }
}

function setupInfiniteButtonScroll(root) {
  const viewport = root.querySelector('.current__viewport')
  const track = viewport?.querySelector('.current__track')
  if (!viewport || !track) return
  const loop = makeLoopScroller(viewport, track)
  if (!loop) return
  root.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = viewport.querySelector('.current__item')
      const step = item
        ? item.getBoundingClientRect().width + 20
        : viewport.clientWidth
      viewport.scrollBy({
        left: step * Number(button.dataset.scroll),
        behavior: 'smooth'
      })
    })
  })
}

const COMPETITIONS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSm8Ng6laoS82viy7_29K97HAdmh_x5yn2li8Y6ZaMceXKW_4lOMDCOZBOEan76Mk_fgW_S5QUk1vMd/pub?output=csv'

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function competitionsFromCSV(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const findColumn = (...keys) =>
    header.findIndex((h) => keys.some((key) => h.includes(key)))
  const titleCol = findColumn('заголовок', 'title')
  const deadlineCol = findColumn('дедлайн', 'deadline')
  const imageCol = findColumn('изображен', 'image')
  const urlCol = findColumn('сайт', 'url', 'website')
  return rows
    .slice(1)
    .map((r) => ({
      title: (r[titleCol] || '').trim(),
      deadline: (r[deadlineCol] || '').trim(),
      image: (r[imageCol] || '').trim(),
      url: (r[urlCol] || '#').trim()
    }))
    .filter((item) => item.title)
}

async function loadCompetitions(csvUrl) {
  try {
    const response = await fetch(csvUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return competitionsFromCSV(await response.text())
  } catch (err) {
    console.error('Не удалось загрузить конкурсы из Google Таблиц', err)
    return []
  }
}

function escapeHtml(value) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return String(value).replace(/[&<>"']/g, (c) => map[c])
}

function competitionCardHtml(item) {
  const title = escapeHtml(item.title)
  const deadline = escapeHtml(item.deadline)
  const image = escapeHtml(item.image)
  const url = escapeHtml(item.url || '#')
  return `<a href="${url}" class="ph-tile current__item" target="_blank" rel="noopener">
    <div class="current__item-wrapper">
      <img src="${image}" alt="${title}" loading="lazy" class="current__item-image" />
      <div class="current__item-info">
        <div class="current__item-primary">
          <div class="current__item-title">${title}</div>
        </div>
        <div class="current__item-dates">
          <div class="current__item-dates-label">дедлайн</div>
          <div class="current__item-dates-value">${deadline}</div>
        </div>
      </div>
    </div>
  </a>`
}

async function initCurrentSection(root) {
  const track = root.querySelector('.current__track')
  if (!track) return
  const items = await loadCompetitions(
    root.dataset.sheetCsv || COMPETITIONS_CSV_URL
  )
  track.innerHTML = items.map(competitionCardHtml).join('')
  setupInfiniteButtonScroll(root)
}

document.querySelectorAll('.current').forEach(initCurrentSection)

function makeSlideCycler(root, slideSelector) {
  const slides = root.querySelectorAll(slideSelector)
  if (slides.length < 2) return
  let index = 0
  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === 0))
  root.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => {
      slides[index].classList.remove('is-active')
      index =
        (index + Number(button.dataset.dir) + slides.length) % slides.length
      slides[index].classList.add('is-active')
    })
  })
}

document
  .querySelectorAll('.testimonial')
  .forEach((el) => makeSlideCycler(el, '.testimonial__slide'))

document
  .querySelectorAll('.spotlight__media')
  .forEach((el) => makeSlideCycler(el, '.spotlight__photo'))

function setupInfiniteDragScroll(el) {
  let dragging = false
  let startX = 0
  let startScroll = 0

  const loop = makeLoopScroller(el, el, (delta) => {
    if (dragging) startScroll += delta
  })
  if (!loop) return

  el.addEventListener('pointerdown', (e) => {
    dragging = true
    el.setPointerCapture(e.pointerId)
    startX = e.clientX
    startScroll = el.scrollLeft
    el.classList.add('is-dragging')
  })
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return
    el.scrollLeft = startScroll - (e.clientX - startX)
  })
  const stopDrag = () => {
    dragging = false
    el.classList.remove('is-dragging')
  }
  el.addEventListener('pointerup', stopDrag)
  el.addEventListener('pointercancel', stopDrag)
  el.addEventListener('pointerleave', stopDrag)
}

document.querySelectorAll('.contact__gallery').forEach(setupInfiniteDragScroll)

function setupPhotoFocus(photoSelector) {
  const photos = document.querySelectorAll(photoSelector)
  if (!photos.length) return
  let active = null

  const setActive = (photo) => {
    if (active === photo) return
    if (active) active.classList.remove('is-active')
    active = photo
    if (active) active.classList.add('is-active')
  }

  photos.forEach((photo) => {
    photo.addEventListener('click', (e) => {
      e.stopPropagation()
      setActive(photo)
    })
  })

  document.addEventListener('click', () => setActive(null))
}

setupPhotoFocus('.event-card__photo')
