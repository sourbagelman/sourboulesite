/* Private Chromium/CDP preparation-input probe. No production import or hook.
 *
 * const probe = await installPreparationInputProbe({context, profile});
 * await probe.attach(page, cdp); // before goto; reuse the harness CDP session
 * await page.goto(url);
 * ...wait for normal weather cleanup without running another input driver...
 * const result = await probe.collect(page);
 *
 * Requires the private instrumented renderer's weather:prepare:start/end marks.
 * It never delays preparation, changes weather time or bypasses eligibility.
 * Warm preparation may finish before any input arrives: collect() reports that
 * as missed, not passed. Functional gated tests must be separate and labeled.
 */
let serial = 0;

export async function installPreparationInputProbe({ context, profile }) {
  if (!context || !profile) throw new TypeError('context and profile are required');
  const binding = '__sbPreparationInputBinding' + ++serial;
  const key = '__sbPreparationInputProbe' + serial;
  const pages = new WeakMap();
  const sessions = new Set();

  await context.exposeBinding(binding, ({ page, frame }, message) => {
    const session = pages.get(page);
    if (!session || frame !== page.mainFrame() || !message) return;
    if (message.kind === 'start') {
      if (session.current?.id === message.id) return;
      const run = { id: message.id, targets: message.targets, ended: false,
        commands: [], errors: [], waiter: null, promise: null };
      session.current = run;
      // Do not await this promise in the binding: browser preparation continues.
      run.promise = exercisePreparationInputs({ cdp: session.cdp, profile, run })
        .catch(error => run.errors.push(String(error.message || error)));
    } else if (session.current?.id === message.id) {
      const run = session.current;
      if (message.kind === 'end') run.ended = true;
      if (message.kind === 'paint' && run.waiter &&
          message.control === run.waiter.control &&
          message.open === run.waiter.open) run.waiter.resolve(message);
    }
  });

  await context.addInitScript(({ binding, key }) => {
    const q = window[key] = {
      id: Math.random().toString(36).slice(2), prepareStart: null, prepareEnd: null,
      prepareStarts: 0, prepareEnds: 0, preparationScrollY: 0, events: [], paints: [], scrolls: [],
      eventTiming: [], firstInput: [], pendingPaints: 0, errors: [], targets: {},
      eventTimingSupported: PerformanceObserver.supportedEntryTypes.includes('event')
    };
    const push = (list, value) => { if (list.length < 80) list.push(value); };
    const notify = value => {
      try { void window[binding]({ id: q.id, ...value }).catch(() => {}); } catch {}
    };
    const selectors = {
      order: '.site-header__order > summary',
      menu: '.mobile-nav > summary, .site-nav details > summary'
    };
    const targetInfo = () => {
      for (const [control, selector] of Object.entries(selectors)) {
        const node = [...document.querySelectorAll(selector)].find(node => {
          const r = node.getBoundingClientRect();
          return r.width && r.height && getComputedStyle(node).visibility !== 'hidden';
        });
        if (!node) continue;
        const r = node.getBoundingClientRect();
        q.targets[control] = { x: r.x + r.width / 2, y: r.y + r.height / 2,
          open: node.parentElement.open, text: node.textContent.trim() };
      }
      q.targets.wheel = { x: Math.min(innerWidth - 12, innerWidth * .55),
        y: Math.min(innerHeight - 12, innerHeight * .7) };
    };
    // Coordinates are prepared before idle/render preparation, not measured
    // synchronously in the weather:prepare:start callback.
    addEventListener('DOMContentLoaded', targetInfo, { once: true });
    addEventListener('load', targetInfo, { once: true });
    const originalMark = performance.mark.bind(performance);
    performance.mark = function (name, ...args) {
      const entry = originalMark(name, ...args);
      if (name === 'weather:prepare:start') {
        q.prepareStarts++;
        if (q.prepareStart === null) {
          q.prepareStart = entry.startTime; q.preparationScrollY = scrollY;
          notify({ kind: 'start', at: entry.startTime, targets: q.targets });
        }
      } else if (name === 'weather:prepare:end') {
        q.prepareEnds++; q.prepareEnd = entry.startTime;
        notify({ kind: 'end', at: entry.startTime });
      }
      return entry;
    };
    const controlFor = node => {
      if (!(node instanceof Element)) return null;
      for (const [control, selector] of Object.entries(selectors)) {
        const summary = node.closest(selector);
        if (summary) return { control, summary };
      }
      return null;
    };
    for (const type of ['event', 'first-input']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      try {
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const target = controlFor(entry.target);
            if (!target && type !== 'first-input') continue;
            push(type === 'event' ? q.eventTiming : q.firstInput, {
              name: entry.name, control: target?.control || null,
              startTime: entry.startTime, processingStart: entry.processingStart,
              processingEnd: entry.processingEnd, duration: entry.duration,
              interactionId: entry.interactionId || 0,
              inputDelay: entry.processingStart - entry.startTime,
              processing: entry.processingEnd - entry.processingStart
            });
          }
        }).observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
      } catch (error) { push(q.errors, String(error.message)); }
    }
    const eventListener = event => {
      if (q.prepareStart === null || !event.isTrusted) return;
      const target = controlFor(event.target);
      if (!target && event.type !== 'wheel') return;
      const control = target?.control || 'wheel';
      push(q.events, { name: event.type, control, trusted: event.isTrusted,
        timeStamp: event.timeStamp, handledAt: performance.now(),
        openBefore: target?.summary.parentElement.open ?? null,
        scrollY, deltaY: event.type === 'wheel' ? event.deltaY : null });
      if (event.type !== 'click' && event.type !== 'wheel') return;
      q.pendingPaints++;
      requestAnimationFrame(firstRAF => {
        const open = target?.summary.parentElement.open ?? null;
        requestAnimationFrame(secondRAF => {
          q.pendingPaints--;
          const value = { control, eventTime: event.timeStamp, firstRAF, secondRAF,
            open, scrollY, observedAt: performance.now() };
          push(q.paints, value); notify({ kind: 'paint', ...value });
        });
      });
    };
    for (const name of ['pointerdown', 'pointerup', 'click', 'wheel']) {
      document.addEventListener(name, eventListener, { capture: true, passive: true });
    }
    addEventListener('scroll', () => {
      if (q.prepareStart !== null) push(q.scrolls, { at: performance.now(), scrollY });
    }, { passive: true });
  }, { binding, key });

  return {
    async attach(page, cdp) {
      if (pages.has(page)) return;
      const session = { page, cdp: cdp || await context.newCDPSession(page),
        owned: !cdp, current: null };
      pages.set(page, session); sessions.add(session);
    },
    async collect(page) {
      const session = pages.get(page);
      if (!session) throw new Error('Attach the probe before navigation');
      await session.current?.promise;
      const snapshot = await page.evaluate(key => {
        const q = window[key]; if (!q) return null;
        const end = q.prepareEnd;
        const within = at => end !== null && at >= q.prepareStart && at < end;
        return { ...q, targets: undefined,
          events: q.events.map(e => ({ ...e, queuedDuringPreparation: within(e.timeStamp),
            handledDuringPreparation: within(e.handledAt) })),
          paints: q.paints.map(e => ({ ...e, firstRAFDuringPreparation: within(e.firstRAF),
            secondRAFDuringPreparation: within(e.secondRAF) })),
          scrolls: q.scrolls.map(e => ({ ...e, duringPreparation: within(e.at) })) };
      }, key);
      const events = snapshot?.events || [];
      const covered = control => events.some(e => e.control === control &&
        e.name === (control === 'wheel' ? 'wheel' : 'click') && e.trusted &&
        e.queuedDuringPreparation && e.handledDuringPreparation);
      const paints = snapshot?.paints || [];
      const firstWheel = events.find(e => e.name === 'wheel' && e.handledDuringPreparation);
      return { ...snapshot, commands: session.current?.commands || [],
        controllerErrors: session.current?.errors || [],
        coverage: { order: covered('order'), menu: covered('menu'), wheel: covered('wheel') },
        outcomes: {
          orderOpenedDuringPreparation: paints.some(p => p.control === 'order' && p.open === true && p.firstRAFDuringPreparation),
          menuOpenedDuringPreparation: paints.some(p => p.control === 'menu' && p.open === true && p.firstRAFDuringPreparation),
          // Passive wheel listeners may run after compositor scrolling. Compare with
          // the pre-input position, not the already-scrolled wheel-handler position.
          scrolledDuringPreparation: !!firstWheel && (snapshot?.scrolls || []).some(s =>
            s.duringPreparation && s.at >= firstWheel.timeStamp && s.scrollY !== snapshot.preparationScrollY)
        },
        outcome: snapshot?.prepareEnd == null ? 'incomplete-or-no-preparation' :
          ['order', 'menu', 'wheel'].every(covered) ? 'all-input-types-during-preparation' :
          ['order', 'menu', 'wheel'].some(covered) ? 'partial-preparation-window' : 'missed-preparation-window',
        interpretation: 'Trusted input timestamps and processing are classified against actual preparation marks. RAF observations show DOM state and rendering opportunities, not screenshot proof. Event Timing uses its 16ms minimum: missing entries are unavailable/below threshold, never zero latency. CDP command durations are controller round trips, not INP.' };
    },
    async dispose() {
      for (const session of sessions) {
        await session.current?.promise;
        if (session.owned) await session.cdp.detach().catch(() => {});
      }
      sessions.clear();
    }
  };
}

/** Called by the private binding; never wait for this from page JavaScript. */
export async function exercisePreparationInputs({ cdp, profile, run }) {
  const mobile = profile.cpu !== 1 || profile.isMobile === true;
  const command = async (name, params, label) => {
    const start = performance.now();
    try { await cdp.send(name, params); }
    finally { run.commands.push({ label, command: name,
      controllerElapsedMs: performance.now() - start, endReceived: run.ended }); }
  };
  const click = async (control, point, expectedOpen, cleanup = false) => {
    let timer;
    const paint = new Promise(resolve => {
      run.waiter = { control, open: expectedOpen, resolve };
      timer = setTimeout(() => resolve(null), 150);
    });
    try {
      const label = control + (expectedOpen ? ':open' : ':close') + (cleanup ? ':cleanup' : '');
      if (mobile) {
        await command('Input.dispatchTouchEvent', { type: 'touchStart',
          touchPoints: [{ x: point.x, y: point.y, id: 0 }] }, label);
        // Always finish a started gesture, even if preparation just ended.
        await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, label);
      } else {
        await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x,
          y: point.y, button: 'left', clickCount: 1 }, label);
        await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x,
          y: point.y, button: 'left', clickCount: 1 }, label);
      }
      return await paint;
    } finally { clearTimeout(timer); run.waiter = null; }
  };
  for (const control of ['order', 'menu']) {
    if (run.ended) break;
    const point = run.targets?.[control];
    if (!point || point.open) continue;
    await click(control, point, true);
    // Restore only the disclosure we just toggled, using another trusted input.
    // Outside-window cleanup is labeled and is never counted as prep coverage.
    await click(control, point, false, run.ended);
  }
  if (!run.ended && run.targets?.wheel) {
    const { x, y } = run.targets.wheel;
    await command('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y,
      deltaX: 0, deltaY: 180 }, 'wheel:down');
  }
}
