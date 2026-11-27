const landscape = document.querySelector('#landscape');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

function mountTree(artwork) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;

  canvas.width = artwork.naturalWidth;
  canvas.height = artwork.naturalHeight;
  canvas.className = 'landscape-tree';
  canvas.setAttribute('aria-hidden', 'true');
  context.imageSmoothingEnabled = false;
  context.drawImage(artwork, 0, 0);
  artwork.after(canvas);

  // Image-space landmarks in winter-pass.jpg. The snow and roots below stay fixed.
  const trunk = 78;
  const branchTips = 320;
  const edge = 440;
  const root = 320;
  const stripHeight = window.matchMedia('(max-width: 690px)').matches ? 8 : 4;
  const strips = Array.from({ length: root / stripHeight }, (_, index) => {
    const y = index * stripHeight;
    const height = 1 - (y + stripHeight / 2) / root;
    return { y, height, flex: 22 * height ** 1.65, trunkX: trunk, tipsX: branchTips };
  });

  return (time, bend) => {
    for (const strip of strips) {
      const { y, height, flex } = strip;
      const trunkX = trunk + Math.round(flex * bend);
      const flutter = Math.sin(time * 2.8 - y * 0.045) * 2 * bend;
      const tipsX = branchTips + Math.round(trunkX - trunk + (8 * bend + flutter) * height);
      if (trunkX === strip.trunkX && tipsX === strip.tipsX) continue;
      strip.trunkX = trunkX;
      strip.tipsX = tipsX;

      // Taper the displacement past the branch tips so the mountains stay still.
      context.drawImage(artwork, 0, y, trunk, stripHeight, 0, y, trunkX, stripHeight);
      context.drawImage(artwork, trunk, y, branchTips - trunk, stripHeight, trunkX, y, tipsX - trunkX, stripHeight);
      context.drawImage(artwork, branchTips, y, edge - branchTips, stripHeight, tipsX, y, edge - tipsX, stripHeight);
    }
  };
}

if (landscape) {
  const artwork = landscape.querySelector('img');
  const air = landscape.querySelector('.landscape-air');
  let inView = !('IntersectionObserver' in window);
  let depth;
  let requestedDepth = false;
  let drawTree;
  let treeReady = false;
  let frame = 0;
  let lastTime;
  let time = 0;
  let windDistance = 0;
  let treeBend = 0.5;

  function tick(now) {
    const delta = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time += delta;

    // Snow responds immediately. The fir bends and recovers more slowly.
    const windSpeed = 0.61 + 0.28 * Math.sin(time * 0.72) + 0.15 * Math.sin(time * 1.49 - 0.8);
    windDistance += windSpeed * delta;
    treeBend += (windSpeed - treeBend) * (1 - Math.exp(-3 * delta));
    air.style.setProperty('--snow-wind', windDistance);

    if (!treeReady && artwork.complete) {
      treeReady = true;
      if (artwork.naturalWidth) drawTree = mountTree(artwork);
    }
    drawTree?.(time, treeBend);
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
