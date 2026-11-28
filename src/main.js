const landscape = document.querySelector('#landscape');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

if (landscape) {
  const air = landscape.querySelector('.landscape-air');
  let inView = !('IntersectionObserver' in window);
  let depth;
  let requestedDepth = false;
  let frame = 0;
  let lastTime;
  let time = 0;
  let windDistance = 0;

  function tick(now) {
    const delta = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time += delta;

    const gust = Math.max(0, Math.sin(time * 0.78 + 0.19)) ** 4;
    const windSpeed = 0.49 + 0.59 * gust + 0.10 * Math.sin(time * 1.31) + 0.06 * Math.sin(time * 2.76);
    windDistance += windSpeed * delta;
    air.style.setProperty('--snow-wind', windDistance);

    depth?.draw(time, windDistance, delta);
    frame = window.requestAnimationFrame(tick);
  }

  function syncStorm() {
    const playing = inView && !document.hidden && !motionPreference.matches;
    landscape.classList.toggle('is-storming', playing);
    if (!playing) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = undefined;
      return;
    }

    if (!frame) frame = window.requestAnimationFrame(tick);
    if (requestedDepth || window.location.protocol === 'file:') return;

    requestedDepth = true;
    import(new URL(landscape.dataset.snowModule, document.baseURI)).then(({ mountLandscape }) => {
      depth = mountLandscape(landscape);
    }).catch(() => {
      // CSS snow stays available when the module or WebGL is unavailable.
    });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncStorm();
    });
    observer.observe(landscape);
  }
  motionPreference.addEventListener('change', syncStorm);
  document.addEventListener('visibilitychange', syncStorm);
  syncStorm();
}

const typingLine = document.querySelector('[data-typing-roles]');
if (typingLine) {
  const roles = JSON.parse(typingLine.dataset.typingRoles).map(({ text, lang }) => ({
    lang,
    // Keep Tamil letters and their combining marks together as they are typed.
    letters: typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(text), ({ segment }) => segment)
      : lang === 'ta' ? [text] : Array.from(text),
  }));
  let index = 0;
  let length = roles[0].letters.length;
  let deleting = true;
  let timer;

  function paintRole() {
    const { lang, letters } = roles[index];
    typingLine.lang = lang;
    typingLine.textContent = letters.slice(0, length).join('');
  }

  function typeNext() {
    if (length === 0) {
      index = (index + 1) % roles.length;
      deleting = false;
    }
    length += deleting ? -1 : 1;
    paintRole();

    let delay = deleting ? 42 : 85;
    if (length === roles[index].letters.length) {
      deleting = true;
      delay = 1900;
    } else if (length === 0) {
      delay = 240;
    }
    timer = window.setTimeout(typeNext, delay);
  }

  function syncTyping() {
    window.clearTimeout(timer);
    const playing = roles.length > 1 && !motionPreference.matches && !document.hidden;
    typingLine.toggleAttribute('data-typing-active', playing);
    if (motionPreference.matches) {
      index = 0;
      length = roles[0].letters.length;
      deleting = true;
      paintRole();
    }
    if (playing) timer = window.setTimeout(typeNext, 1200);
  }

  motionPreference.addEventListener('change', syncTyping);
  document.addEventListener('visibilitychange', syncTyping);
  syncTyping();
}

if (!motionPreference.matches && 'IntersectionObserver' in window) {
  // Prepare only text below the fold so already-visible text never blurs out.
  const targets = [...document.querySelectorAll('[data-reveal]')]
    .filter((target) => target.getBoundingClientRect().top > window.innerHeight + 24);
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('reveal-pending');
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px 12px 0px' });

  for (const target of targets) {
    target.classList.add('reveal-armed', 'reveal-pending');
    reveal.observe(target);
  }
  motionPreference.addEventListener('change', (event) => {
    if (!event.matches) return;
    reveal.disconnect();
    for (const target of targets) target.classList.remove('reveal-armed', 'reveal-pending');
  });
}
