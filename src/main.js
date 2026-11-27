const landscape = document.querySelector('#landscape');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

function moveSpring(spring, load, delta) {
  spring.velocity += (spring.stiffness * (load - spring.angle) - spring.damping * spring.velocity) * delta;
  spring.angle += spring.velocity * delta;
}

function mountTree(artwork) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const buffer = document.createElement('canvas');
  const horizontal = buffer.getContext('2d', { alpha: false });
  if (!context || !horizontal) return undefined;

  // Image-space landmarks in winter-pass.jpg.
  const trunk = 78;
  const branchTips = 320;
  const edge = 440;
  const root = 320;
  const compact = window.matchMedia('(max-width: 690px)').matches;
  const stripHeight = compact ? 8 : 4;
  const columnWidth = compact ? 12 : 8;

  canvas.width = artwork.naturalWidth;
  canvas.height = artwork.naturalHeight;
  buffer.width = edge;
  buffer.height = root;
  canvas.className = 'landscape-tree';
  canvas.setAttribute('aria-hidden', 'true');
  context.imageSmoothingEnabled = false;
  horizontal.imageSmoothingEnabled = false;
  context.drawImage(artwork, 0, 0);
  horizontal.drawImage(artwork, 0, 0);
  artwork.after(canvas);

  const trunkSpring = { stiffness: 13, damping: 4, angle: 0, velocity: 0 };
  const branches = [
    { y: 66, flex: 1, stiffness: 41, damping: 6.2 },
    { y: 165, flex: 0.85, stiffness: 32, damping: 5.7 },
    { y: 257, flex: 0.68, stiffness: 25, damping: 5.1 },
  ].map((branch) => ({ ...branch, angle: 0, velocity: 0, drop: 0 }));
  const strips = Array.from({ length: root / stripHeight }, (_, index) => {
    const y = index * stripHeight;
    const height = 1 - (y + stripHeight / 2) / root;
    const influence = branches.map((branch) => Math.exp(-(((y - branch.y) / 48) ** 2)));
    return { y, flex: 30 * height ** 1.65, influence, trunkX: trunk, tipsX: branchTips };
  });
  const columns = [];
  for (let x = trunk; x < edge; x += columnWidth) {
    const width = Math.min(columnWidth, edge - x);
    const center = x + width / 2;
    const reach = center < branchTips
      ? ((center - trunk) / (branchTips - trunk)) ** 1.5
      : (edge - center) / (edge - branchTips);
    columns.push({ x, width, reach });
  }
  const paintInterval = compact ? 1 / 30 : 0;
  let lastPaint = -Infinity;

  return (time, windSpeed, delta) => {
    const pressure = windSpeed ** 2 - 0.28;
    moveSpring(trunkSpring, pressure, delta);
    branches.forEach((branch, index) => {
      const flutter = windSpeed * 0.11 * Math.sin(time * (5.1 - index * 0.6) - index * 1.7);
      moveSpring(branch, pressure * branch.flex + flutter, delta);
    });
    if (time - lastPaint < paintInterval - 0.001) return;
    lastPaint = time;

    let changed = false;
    for (const branch of branches) {
      const drop = Math.round(14 * branch.angle + 1.2 * branch.velocity);
      changed ||= drop !== branch.drop;
      branch.drop = drop;
    }
    for (const strip of strips) {
      const { y, flex, influence } = strip;
      const lean = flex * trunkSpring.angle;
      let branchLean = 0;
      for (let index = 0; index < branches.length; index += 1) {
        branchLean += 15 * branches[index].angle * influence[index];
      }
      const trunkX = trunk + Math.round(lean);
      const tipsX = branchTips + Math.round(lean + branchLean);
      if (trunkX === strip.trunkX && tipsX === strip.tipsX) continue;
      strip.trunkX = trunkX;
      strip.tipsX = tipsX;
      changed = true;

      // Taper the displacement past the branch tips so the mountains stay still.
      horizontal.drawImage(artwork, 0, y, trunk, stripHeight, 0, y, trunkX, stripHeight);
      horizontal.drawImage(artwork, trunk, y, branchTips - trunk, stripHeight, trunkX, y, tipsX - trunkX, stripHeight);
      horizontal.drawImage(artwork, branchTips, y, edge - branchTips, stripHeight, tipsX, y, edge - tipsX, stripHeight);
    }
    if (!changed) return;

    // Bend outer branches down and back up while pinning the trunk and the ground.
    context.drawImage(buffer, 0, 0);
    for (const { x, width, reach } of columns) {
      let sourceY = 0;
      let targetY = 0;
      for (const branch of branches) {
        const nextY = branch.y + Math.round(branch.drop * reach);
        if (sourceY !== targetY || branch.y !== nextY) {
          context.drawImage(buffer, x, sourceY, width, branch.y - sourceY, x, targetY, width, nextY - targetY);
        }
        sourceY = branch.y;
        targetY = nextY;
      }
      if (sourceY !== targetY) {
        context.drawImage(buffer, x, sourceY, width, root - sourceY, x, targetY, width, root - targetY);
      }
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

  function tick(now) {
    const delta = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time += delta;

    const gust = Math.max(0, Math.sin(time * 0.78 + 0.19)) ** 4;
    const windSpeed = 0.49 + 0.59 * gust + 0.10 * Math.sin(time * 1.31) + 0.06 * Math.sin(time * 2.76);
    windDistance += windSpeed * delta;
    air.style.setProperty('--snow-wind', windDistance);

    if (!treeReady && artwork.complete) {
      treeReady = true;
      if (artwork.naturalWidth) drawTree = mountTree(artwork);
    }
    drawTree?.(time, windSpeed, delta);
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
