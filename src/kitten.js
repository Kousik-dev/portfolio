(() => {
  const tau = Math.PI * 2;
  const stride = 40;
  const stance = 0.72;
  const viewWidth = 116;
  const viewHeight = 65;
  const origin = { x: 58, y: 61 };
  const floorTilt = 0.52;

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const mix = (a, b, fraction) => a + (b - a) * fraction;
  const smooth = (fraction) => fraction * fraction * (3 - 2 * fraction);

  // During stance the paw travels backwards relative to the body at exactly the body's
  // speed. During swing it lifts and returns forwards, out of phase with the other paws.
  function pawAt(distance, offset) {
    const phase = ((distance / stride + offset) % 1 + 1) % 1;
    const reach = stride * stance / 2;
    if (phase < stance) return { forward: reach - phase * stride, lift: 0 };
    const swing = (phase - stance) / (1 - stance);
    // Match the grounded paw's velocity at both ends of the swing.
    const eased = smooth(swing);
    return {
      forward: mix(-reach, reach, eased) - stride * (1 - stance) * (swing - eased),
      lift: Math.sin(Math.PI * swing) ** 2 * 7.5,
    };
  }

  function groundView(angle) {
    const yaw = Math.atan2(Math.sin(angle) / floorTilt, Math.cos(angle));
    return {
      c: Math.cos(yaw),
      s: Math.sin(yaw),
    };
  }

  const limbs = [
    { front: false, side: -1, phase: 0 },
    { front: true, side: -1, phase: 0.75 },
    { front: false, side: 1, phase: 0.5 },
    { front: true, side: 1, phase: 0.25 },
  ];

  function ellipse(ctx, point, rx, ry, color, rotation = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, rx, ry, rotation, 0, tau);
    ctx.fill();
  }

  function drawKitten(ctx, angle, gait, clock, rest, pace) {
    const { c, s } = groundView(angle);
    const sideOn = Math.abs(c);
    const away = s < -0.48;
    const facing = c < 0 ? -1 : 1;
    const breathing = Math.sin(clock * 3.2) * rest * 0.48;
    const step = gait / stride * tau;
    const bob = Math.sin(step * 2) * 0.8 * pace;
    const torsoZ = mix(18, 8, rest) + bob + breathing;
    const length = mix(1, 0.72, rest);
    // Keep the closest paw pad on the border while the kitten turns toward the viewer.
    const turnOffset = floorTilt * (13.5 * length * s + (sideOn - 1) * 6.5);
    const point = (forward, across, z = 0) => ({
      x: origin.x + forward * c - across * s,
      y: origin.y - turnOffset + (forward * s + across * c) * floorTilt - z,
    });
    const depth = (forward, across) => forward * s + across * c;

    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ellipse(ctx, point(0, 0), 14 + sideOn * 16, 3.3 + (1 - sideOn) * 3, '#222a3e23');

    const tailSway = Math.sin(clock * 2.3 + Math.sin(step * 0.72) * pace * 0.42) * (5 - rest * 3);
    const tail = [
      point(-15 * length, 0, torsoZ + 1),
      point(-29 * length, tailSway * 0.35, mix(18, 5, rest)),
      point(mix(-46, -21, rest), mix(tailSway, 13, rest), mix(27, 4.1, rest)),
      point(mix(-41, 3, rest), mix(tailSway, 13.5, rest), mix(33, 3.6, rest)),
    ];
    ctx.strokeStyle = '#292936';
    ctx.lineWidth = 5.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(tail[0].x, tail[0].y);
    ctx.bezierCurveTo(tail[1].x, tail[1].y, tail[2].x, tail[2].y, tail[3].x, tail[3].y);
    ctx.stroke();

    const legs = limbs.map(({ front, side, phase }) => {
      const fore = (front ? 13.5 : -14.3) * length;
      const across = side * 6.5;
      const foot = pawAt(gait, phase);
      const forward = fore + foot.forward * pace;
      const lift = foot.lift * pace;
      return {
        near: depth(fore, across),
        hip: point(fore, across, torsoZ - 2),
        knee: point(mix(fore, forward, 0.56) + (front ? -3 : 4) * (1 - rest), across, mix(8, 3, rest) + lift * 0.65),
        paw: point(forward, across, lift + 1.55),
        front,
        pale: front && side === 1,
      };
    }).sort((a, b) => a.near - b.near);

    function drawLeg(leg, near) {
      const color = near ? '#2d2d3c' : '#414254';
      ctx.strokeStyle = color;
      ctx.lineWidth = leg.front ? 5.5 : 7.1;
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y);
      ctx.quadraticCurveTo(leg.knee.x, leg.knee.y, leg.paw.x, leg.paw.y);
      ctx.stroke();
      ellipse(ctx, leg.paw, 2.9 + sideOn * 1.5, 2.1, leg.pale && near ? '#bfaeae' : color);
    }

    legs.slice(0, 2).forEach((leg) => drawLeg(leg, false));
    const back = point(-15 * length, 0, torsoZ);
    const chest = point(14 * length, 0, torsoZ);
    const bodyAngle = Math.atan2(chest.y - back.y, chest.x - back.x);
    ellipse(ctx, point(0, 0, torsoZ), 8.2 + Math.hypot(chest.x - back.x, chest.y - back.y) * 0.5,
      mix(8.4, 5.8, rest) + (1 - sideOn) * 2.5, '#2a2937', bodyAngle);
    ellipse(ctx, point(-6 * length, -1.2, torsoZ + 3), 8 + sideOn * 5.5, 3.1, '#45435270', bodyAngle);
    legs.slice(2).forEach((leg) => drawLeg(leg, true));

    const head = point(mix(21, 13, rest) * length, 0, mix(25.5, 8.1, rest) + bob);
    const squeeze = 1 - sideOn * 0.12;
    const tilt = facing * (rest * 0.15 + Math.sin(step) * pace * 0.026);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(tilt);
    ctx.scale(facing * squeeze, 1);

    // Mirror one ear around the skull center so both roots follow the face during turns.
    const skullX = sideOn * 1.8;
    const skullHeight = mix(10.2, 7.5, rest);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(skullX, -skullHeight * 0.38);
      ctx.scale(side, 1);
      const tip = mix(-13, -9.6, rest);
      ctx.fillStyle = '#383644';
      ctx.beginPath();
      ctx.moveTo(2.7, -1.4);
      ctx.quadraticCurveTo(4.5, tip + 4, 8.6, tip);
      ctx.quadraticCurveTo(10.7, tip - 0.6, 11.4, 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ba899b';
      ctx.beginPath();
      ctx.moveTo(5.1, -2);
      ctx.quadraticCurveTo(6.4, tip + 5, 8.6, tip + 3.1);
      ctx.lineTo(9.5, -1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ellipse(ctx, { x: skullX, y: 0 }, 13, skullHeight, '#383644');
    if (!away) {
      ellipse(ctx, { x: 4 + sideOn * 2, y: 4.3 }, 6.8, 3.5, '#605463');
      const blinking = (clock + 0.2) % 5.9 > 5.70;
      for (const x of [-4.9 + sideOn * 4.5, 5.5 + sideOn * 2.0]) {
        if (rest > 0.73 || blinking) {
          ctx.strokeStyle = '#f7d8ad';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 2.4, 0);
          ctx.quadraticCurveTo(x, 1.8, x + 2.4, -0.25);
          ctx.stroke();
        } else {
          ellipse(ctx, { x, y: -0.2 }, 2.7, 3.05, '#f9deb2');
          ellipse(ctx, { x: x + 0.55, y: 0 }, 1.12, 2.2, '#282332');
          ellipse(ctx, { x: x - 0.4, y: -1.15 }, 0.55, 0.55, '#fff9e8');
        }
      }
      ellipse(ctx, { x: 4.2 + sideOn * 3.2, y: 3.8 }, 1.7, 0.95, '#ed9eaa');
    }
    ctx.restore();
  }

  const track = document.querySelector('.pet-track');
  if (!track) return;
  const button = track.querySelector('.project-pet');
  const canvas = track.querySelector('.kitten-canvas');
  const prompt = track.querySelector('.pet-prompt');
  const walkLabel = prompt.querySelector('.pet-walk-label');
  const tuckLabel = prompt.querySelector('.pet-tuck-label');
  const status = track.querySelector('.pet-status');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const perchAngle = Math.PI * 0.84;
  let mode = 'ready';
  let clock = 0;
  let span = 0;
  let scale = 1;
  let distance = 0;
  let speed = 0;
  let curl = 0;
  let animation = 0;
  let lastTime;
  let visible = !('IntersectionObserver' in window);

  function setMode(next) {
    mode = next;
    const finished = next === 'finished';
    const sleeping = next === 'nap' || finished;
    track.classList.toggle('is-ready', next === 'ready');
    button.disabled = finished;
    if (next === 'ready') {
      walkLabel.hidden = preference.matches;
      tuckLabel.hidden = !preference.matches;
    }
    button.setAttribute('aria-label', {
      ready: (preference.matches ? tuckLabel : walkLabel).textContent,
      walk: 'Let Snowbell nap here',
      nap: 'Wake Snowbell and continue his walk',
      finished: 'Snowbell is asleep at the left edge',
    }[next]);
    if (next !== 'ready') status.textContent = sleeping ? 'Snowbell is settling down.' : 'Snowbell is walking.';
    speed = 0;
  }

  function paint() {
    button.style.transform = `translateX(${span - distance}px)`;
    const rest = smooth(curl);
    const strideBlend = smooth(clamp(Math.min(distance, span - distance) / (stride * scale * 0.65), 0, 1));
    const angle = mix(perchAngle, Math.PI, smooth(clamp(distance / (14 * scale), 0, 1)));
    drawKitten(ctx, angle, distance / scale, clock, rest, strideBlend * (1 - rest));
    track.classList.toggle('is-napping', curl > 0.88);
  }

  function resize() {
    const progress = mode === 'finished' ? 1 : span ? distance / span : 0;
    if (!button.clientWidth || !track.clientWidth) return;
    const gutter = document.documentElement.clientWidth - track.getBoundingClientRect().right;
    const promptOverhang = prompt.getBoundingClientRect().right - button.getBoundingClientRect().right;
    const perchInset = Math.max(0, promptOverhang - gutter);
    span = Math.max(0, track.clientWidth - button.clientWidth - perchInset);
    scale = button.clientWidth / viewWidth;
    distance = span * progress;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(button.clientWidth * density);
    canvas.height = Math.round(button.clientHeight * density);
    ctx.setTransform(canvas.width / viewWidth, 0, 0, canvas.height / viewHeight, 0, 0);
    paint();
  }

  function advance(delta) {
    clock += delta;
    if (mode === 'nap' || mode === 'finished') {
      curl = Math.min(1, curl + delta / 0.85);
      if (curl === 1) status.textContent = 'Snowbell is asleep.';
      return;
    }
    if (curl > 0) {
      curl = Math.max(0, curl - delta / 0.62);
      return;
    }
    const acceleration = 145 * scale;
    const targetSpeed = Math.min(84 * scale, Math.sqrt(2 * acceleration * (span - distance)));
    speed += clamp(targetSpeed - speed, -acceleration * delta, acceleration * delta);
    distance = Math.min(span, distance + speed * delta);
    if (span - distance < 0.06) {
      distance = span;
      setMode('finished');
    }
  }

  function sync() {
    const inView = visible && !document.hidden && !preference.matches;
    track.classList.toggle('is-active', inView);
    const moving = mode === 'walk' || (mode !== 'ready' && curl < 1);
    if (inView && moving) {
      if (!animation) animation = window.requestAnimationFrame(tick);
    } else {
      window.cancelAnimationFrame(animation);
      animation = 0;
      lastTime = undefined;
    }
    paint();
  }

  function tick(now) {
    animation = 0;
    const delta = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    advance(delta);
    sync();
  }

  function finishWithoutMotion() {
    distance = span;
    curl = 1;
    setMode('finished');
    status.textContent = 'Snowbell is asleep.';
  }

  button.addEventListener('click', () => {
    if (mode === 'finished') return;
    if (preference.matches) finishWithoutMotion();
    else setMode(mode === 'walk' ? 'nap' : 'walk');
    sync();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(button);
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(resize);
    observer.observe(track);
    observer.observe(prompt);
  }
  window.addEventListener('resize', resize);
  preference.addEventListener('change', () => {
    if (mode === 'ready') setMode('ready');
    if (preference.matches && mode === 'walk') finishWithoutMotion();
    if (preference.matches && mode === 'nap') curl = 1;
    sync();
  });
  document.addEventListener('visibilitychange', sync);

  track.classList.add('is-rigged');
  canvas.hidden = false;
  button.disabled = false;
  setMode('ready');
  resize();
  sync();
})();
