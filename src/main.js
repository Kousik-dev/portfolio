const landscape = document.querySelector('#landscape');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

if (landscape && 'IntersectionObserver' in window) {
  let depth;
  let active = false;
  let finished = false;
  let timer;

  function stopStorm() {
    if (finished) return;
    finished = true;
    active = false;
    window.clearTimeout(timer);
    landscape.classList.remove('is-storming');
    depth?.dispose();
    depth = undefined;
    observer.disconnect();
    motionPreference.removeEventListener('change', onPreference);
  }

  function onPreference(event) {
    if (event.matches) stopStorm();
  }

  async function startStorm() {
    if (motionPreference.matches) {
      stopStorm();
      return;
    }
    active = true;
    landscape.classList.add('is-storming');
    timer = window.setTimeout(stopStorm, 4500);
    if (window.location.protocol === 'file:') return;
    try {
      const { mountLandscape } = await import('./landscape.js');
      if (active) {
        depth = mountLandscape(landscape);
        depth?.setPlaying(true);
      }
    } catch {
      // The artwork and CSS snow are available without WebGL.
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !active && !finished) startStorm();
    else if (!entry.isIntersecting && active) stopStorm();
  });
  observer.observe(landscape);
  motionPreference.addEventListener('change', onPreference);
  window.addEventListener('pagehide', stopStorm, { once: true });
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
