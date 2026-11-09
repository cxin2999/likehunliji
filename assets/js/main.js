/* =========================================================
   婚礼邀请函 · 交互脚本
   原生 JS，无依赖；所有资源同源自托管，直接适配 GitHub Pages
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     自动下滑默认配置
     speed  : 像素/秒（平均速度，只在这里配置）
     delay  : 封面停留多久后开始，毫秒
     resume : 被打断后多久继续，毫秒
     --------------------------------------------------------- */
  var AUTO_SCROLL = {
    enabled: true,
    speed: 60,      // 平均速度：像素/秒（只在这里配置）
    delay: 2600,    // 封面停留：毫秒
    resume: 2000    // 被打断后多久继续：毫秒
  };

  /* 打开页面后是否尝试自动播放音乐；关闭后仍可用右上角按钮手动播放 */
  var AUTO_MUSIC = {
    enabled: true
  };

  function $(selector, scope) {
    return (scope || doc).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /* 让入场动效只在脚本正常执行时才隐藏内容，避免 JS 失败后白屏 */
  root.classList.add('reveal-enabled');

  /* ---------------------------------------------------------
     1. 开场加载
     --------------------------------------------------------- */
  var loader = $('[data-loader]');
  var coverImg = $('.cover__media img');
  var startAt = (window.performance && performance.now) ? performance.now() : Date.now();

  var readyDispatched = false;

  function doneLoading() {
    if (!loader || loader.classList.contains('is-done')) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var wait = Math.max(0, 520 - (now - startAt));

    window.setTimeout(function () {
      loader.classList.add('is-done');
      body.classList.add('is-ready');

      if (!readyDispatched) {
        readyDispatched = true;
        var readyEvent;
        try {
          readyEvent = new CustomEvent('wedding:ready');
        } catch (error) {
          readyEvent = doc.createEvent('Event');
          readyEvent.initEvent('wedding:ready', true, true);
        }
        doc.dispatchEvent(readyEvent);
      }
    }, wait);
  }

  function afterFade() {
    doneLoading();
  }

  var imageReady = Promise.resolve();
  if (coverImg) {
    if (coverImg.complete && coverImg.naturalWidth) {
      imageReady = Promise.resolve();
    } else if (coverImg.decode) {
      imageReady = coverImg.decode().catch(function () {});
    } else {
      imageReady = new Promise(function (resolve) {
        coverImg.addEventListener('load', resolve, { once: true });
        coverImg.addEventListener('error', resolve, { once: true });
      });
    }
  }

  var fontReady = Promise.resolve();
  if (doc.fonts && doc.fonts.load) {
    var fontLoad = Promise.all([
      doc.fonts.load('400 1em "Ma Shan Zheng"'),
      doc.fonts.load('400 1em "Bodoni Moda"')
    ]).catch(function () {});

    fontReady = Promise.race([
      fontLoad,
      new Promise(function (resolve) { window.setTimeout(resolve, 1500); })
    ]);
  }

  Promise.race([
    Promise.all([imageReady, fontReady]),
    new Promise(function (resolve) { window.setTimeout(resolve, 2000); })
  ]).then(afterFade);

  window.addEventListener('load', doneLoading, { once: true });

  /* ---------------------------------------------------------
     2. 滚动入场
     --------------------------------------------------------- */
  var revealTargets = $$('[data-reveal]');

  $$('.mosaic__item').forEach(function (el, i) {
    el.setAttribute('data-reveal', '');
    el.style.setProperty('--delay', (i % 2) * 70 + 'ms');
    revealTargets.push(el);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });

    /* 快速滑动 / 锚点跳转时 IO 可能漏掉元素：滚动停下后补一次扫描 */
    var sweepTimer = null;

    var revealSweep = function () {
      revealTargets.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top < window.innerHeight * 0.96) {
          el.classList.add('is-in');
        }
      });
    };

    window.addEventListener('scroll', function () {
      window.clearTimeout(sweepTimer);
      sweepTimer = window.setTimeout(revealSweep, 140);
    }, { passive: true });

    window.addEventListener('load', function () {
      window.setTimeout(revealSweep, 300);
    }, { once: true });
  }

  /* ---------------------------------------------------------
     3. 倒计时
     --------------------------------------------------------- */
  var countdown = $('[data-countdown]');

  if (countdown) {
    var target = Date.parse(countdown.getAttribute('data-target'));
    var units = {
      days: $('[data-unit="days"]', countdown),
      hours: $('[data-unit="hours"]', countdown),
      minutes: $('[data-unit="minutes"]', countdown),
      seconds: $('[data-unit="seconds"]', countdown)
    };
    var hint = $('.time__hint');
    var finished = false;

    var renderCountdown = function () {
      var diff = target - Date.now();

      if (!isFinite(diff) || diff <= 0) {
        Object.keys(units).forEach(function (key) {
          if (units[key]) units[key].textContent = '00';
        });
        if (!finished) {
          finished = true;
          countdown.classList.add('is-past');
          if (hint) hint.textContent = '礼成 · 谢谢你曾来见证';
        }
        return false;
      }

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var minutes = Math.floor((diff % 3600000) / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);

      units.days.textContent = String(days).padStart(2, '0');
      units.hours.textContent = pad(hours);
      units.minutes.textContent = pad(minutes);
      units.seconds.textContent = pad(seconds);
      return true;
    };

    if (renderCountdown()) {
      var cdTimer = window.setInterval(function () {
        if (!renderCountdown()) window.clearInterval(cdTimer);
      }, 1000);
    }

    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden) renderCountdown();
    });
  }

  /* ---------------------------------------------------------
     4. 轮播
     --------------------------------------------------------- */
  var carousel = $('[data-carousel]');

  if (carousel) {
    var viewport = $('.carousel__viewport', carousel);
    var slides = $$('.slide', carousel);
    var dotsWrap = $('[data-carousel-dots]', carousel);
    var prevBtn = $('[data-carousel-prev]', carousel);
    var nextBtn = $('[data-carousel-next]', carousel);
    var current = 0;
    var autoplay = null;
    var inView = false;
    var pausedUntil = 0;
    var hovering = false;
    var dots = [];

    var setCurrent = function (index) {
      current = index;
      dots.forEach(function (dot, i) {
        if (i === index) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    };

    var goTo = function (index, smooth) {
      if (!slides.length) return;
      var next = (index + slides.length) % slides.length;
      current = next;
      viewport.scrollTo({
        left: next * viewport.clientWidth,
        behavior: smooth === false || reduceMotion ? 'auto' : 'smooth'
      });
      setCurrent(next);
    };

    slides.forEach(function (slide, i) {
      var dot = doc.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', '第 ' + (i + 1) + ' 张照片');
      if (i === 0) dot.setAttribute('aria-current', 'true');
      dot.addEventListener('click', function () {
        pausedUntil = Date.now() + 8000;
        goTo(i);
      });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    var readScroll = function () {
      var index = Math.round(viewport.scrollLeft / viewport.clientWidth);
      if (index !== current && index >= 0 && index < slides.length) setCurrent(index);
    };

    var ticking = false;
    viewport.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        readScroll();
        ticking = false;
      });
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', function () {
      pausedUntil = Date.now() + 8000;
      goTo(current - 1);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      pausedUntil = Date.now() + 8000;
      goTo(current + 1);
    });

    viewport.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(current - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(current + 1);
      }
    });

    var pause = function () { pausedUntil = Date.now() + 9000; };
    viewport.addEventListener('pointerdown', pause, { passive: true });
    viewport.addEventListener('touchstart', pause, { passive: true });

    carousel.addEventListener('mouseenter', function () { hovering = true; });
    carousel.addEventListener('mouseleave', function () { hovering = false; });
    carousel.addEventListener('focusin', function () { pausedUntil = Date.now() + 9000; });

    var stopAuto = function () {
      if (autoplay) {
        window.clearInterval(autoplay);
        autoplay = null;
      }
    };

    var startAuto = function () {
      stopAuto();
      if (reduceMotion || slides.length < 2) return;

      autoplay = window.setInterval(function () {
        if (doc.hidden || !inView || hovering) return;
        if (Date.now() < pausedUntil) return;
        goTo(current + 1);
      }, 4800);
    };

    /* 轮播是横向滚动，lazy 图片不会提前加载；接近视口时手动预取其余几张 */
    var preloaded = false;

    var preloadRest = function () {
      if (preloaded) return;
      preloaded = true;
      slides.slice(1).forEach(function (slide) {
        var img = slide.querySelector('img');
        if (!img) return;
        var src = img.getAttribute('src');
        if (src) {
          var pre = new Image();
          pre.src = src;
        }
      });
    };

    if ('IntersectionObserver' in window) {
      var carouselObserver = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) {
          preloadRest();
          startAuto();
        } else {
          stopAuto();
        }
      }, { threshold: 0.35 });
      carouselObserver.observe(carousel);
    } else {
      inView = true;
      preloadRest();
      startAuto();
    }

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) stopAuto();
      else if (inView) startAuto();
    });

    window.addEventListener('resize', function () {
      goTo(current, false);
    });
  }

  /* ---------------------------------------------------------
     5. 背景音乐
     --------------------------------------------------------- */
  var audio = $('[data-audio]');
  var musicBtn = $('[data-music]');
  var musicToggle = $('[data-music-toggle]');
  var musicState = $('[data-music-state]');
  var musicHint = $('[data-music-hint]');
  var musicHintTimer = null;
  var pendingResume = false;

  function showMusicHint() {
    if (!musicHint) return;
    musicHint.classList.add('is-show');
    window.clearTimeout(musicHintTimer);
    musicHintTimer = window.setTimeout(function () {
      musicHint.classList.remove('is-show');
    }, 6000);
  }

  function hideMusicHint() {
    if (!musicHint) return;
    window.clearTimeout(musicHintTimer);
    musicHint.classList.remove('is-show');
  }

  var toast = $('[data-toast]');
  var toastTimer = null;

  function showToast(message, duration) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-show');
    }, duration || 2600);
  }

  function setMusicUI(playing) {
    if (musicBtn) {
      musicBtn.classList.toggle('is-playing', playing);
      musicBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      musicBtn.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    }
    if (musicState) {
      musicState.textContent = playing ? '正在播放 · 轻触暂停' : '未播放 · 轻触开始';
    }
    if (musicToggle) {
      musicToggle.classList.toggle('is-playing', playing);
    }
  }

  if (audio) {
    audio.volume = 0.48;

    /* -------------------------------------------------------
       自动播放：先尝试直接播；被浏览器策略拦截时，
       在首次点击 / 触摸 / 按键 / 滚轮时补播一次。
       ------------------------------------------------------- */
    var autoplayAttempted = false;
    var unlockArmed = false;
    var unlockListeners = [];

    var clearUnlock = function () {
      unlockListeners.forEach(function (entry) {
        document.removeEventListener(entry[0], entry[1], entry[2]);
      });
      unlockListeners = [];
      unlockArmed = false;
    };

    var armUnlock = function () {
      if (unlockArmed) return;
      unlockArmed = true;

      var unlock = function (event) {
        if (event && event.target && event.target.closest &&
            event.target.closest('[data-music], [data-music-toggle]')) {
          return;
        }
        var result = audio.play();
        if (result && typeof result.catch === 'function') {
          result.catch(function () {});
        }
      };

      var events = [
        ['pointerdown', { capture: true }],
        ['touchstart', { capture: true, passive: true }],
        ['keydown', { capture: true }],
        ['wheel', { capture: true, passive: true }]
      ];

      events.forEach(function (entry) {
        var options = Object.assign({ once: true }, entry[1]);
        document.addEventListener(entry[0], unlock, options);
        unlockListeners.push([entry[0], unlock, options]);
      });
    };

    var tryAutoplay = function () {
      if (!audio.paused || autoplayAttempted) return;
      autoplayAttempted = true;

      var result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function () {
          armUnlock();
          showMusicHint();
        });
      } else if (audio.paused) {
        armUnlock();
      }
    };

    audio.addEventListener('playing', clearUnlock);

    if (AUTO_MUSIC.enabled) {
      doc.addEventListener('wedding:ready', function () {
        window.setTimeout(tryAutoplay, 350);
      }, { once: true });

      /* 首屏还没 ready 时用户就交互，也允许提前开始 */
      armUnlock();
    }

    var tryPlay = function () {
      var result = audio.play();
      if (result && typeof result.then === 'function') {
        result.then(function () {
          pendingResume = false;
        }).catch(function () {
          setMusicUI(false);
          if (musicState) musicState.textContent = '播放失败，请再点一次';
          showToast('音乐没有播放成功，请再点一次');
        });
      }
    };

    var toggleMusic = function () {
      if (audio.paused) {
        tryPlay();
      } else {
        pendingResume = false;
        audio.pause();
      }
    };

    if (musicBtn) musicBtn.addEventListener('click', toggleMusic);
    if (musicToggle) {
      musicToggle.addEventListener('click', function () {
        toggleMusic();
      });
    }

    audio.addEventListener('play', function () {
      setMusicUI(true);
      hideMusicHint();
    });
    audio.addEventListener('pause', function () { setMusicUI(false); });
    audio.addEventListener('error', function () {
      setMusicUI(false);
      showToast('背景音乐加载失败');
    });

    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) {
        pendingResume = !audio.paused;
        if (pendingResume) audio.pause();
      } else if (pendingResume) {
        tryPlay();
      }
    });
  }

  /* ---------------------------------------------------------
     6. 右侧导航高亮 / 底部胶囊淡出
     --------------------------------------------------------- */
  var railItems = $$('[data-rail]');
  var railSections = railItems.map(function (item) {
    return { item: item, section: doc.getElementById(item.getAttribute('data-rail')) };
  }).filter(function (entry) { return entry.section; });

  if ('IntersectionObserver' in window && railSections.length) {
    var railObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        railSections.forEach(function (pair) {
          if (pair.section !== entry.target) return;
          pair.item.classList.toggle('is-active', entry.isIntersecting);
        });
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    railSections.forEach(function (pair) { railObserver.observe(pair.section); });
  }

  var rail = $('.rail');
  var cover = $('.cover');
  var scrollTick = false;

  /* 封面保持干净：导航栏等滚过首屏再出现；音乐按钮在纸底上换成纸色 */
  if (rail) rail.classList.add('is-hidden');

  function syncChrome() {
    var y = window.scrollY;
    var coverHeight = cover ? cover.offsetHeight : 600;

    if (rail) rail.classList.toggle('is-hidden', y < 80);

    if (musicBtn) {
      musicBtn.classList.toggle('on-paper', y > coverHeight - 10);
    }
  }

  syncChrome();

  window.addEventListener('scroll', function () {
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(function () {
      syncChrome();
      scrollTick = false;
    });
  }, { passive: true });

  window.addEventListener('resize', syncChrome);

  /* ---------------------------------------------------------
     7. 更多面板
     --------------------------------------------------------- */
  var sheet = $('.sheet');
  var sheetOpeners = $$('[data-sheet-open]');
  var sheetClosers = sheet ? $$('[data-close-sheet]', sheet) : [];

  function lockBody() {
    body.classList.add('is-locked');
  }

  function unlockBody() {
    var lightboxOpen = $('.lightbox') && $('.lightbox').open;
    if ((!sheet || !sheet.open) && !lightboxOpen) body.classList.remove('is-locked');
  }

  function openSheet() {
    if (!sheet) return;
    var lb = $('.lightbox');
    if (lb && lb.open) lb.close();
    if (typeof sheet.showModal === 'function') {
      sheet.showModal();
      lockBody();
      syncAutoScroll();
      var sheetTitle = $('.sheet__title', sheet);
      if (sheetTitle) sheetTitle.focus();
    }
  }

  function closeSheet() {
    if (sheet && sheet.open) sheet.close();
  }

  sheetOpeners.forEach(function (el) {
    el.addEventListener('click', openSheet);
  });

  sheetClosers.forEach(function (el) {
    el.addEventListener('click', function () {
      closeSheet();
    });
  });

  if (sheet) {
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet) closeSheet();
    });
    sheet.addEventListener('close', function () {
      unlockBody();
      syncAutoScroll();
    });
    sheet.addEventListener('cancel', function () {
      window.setTimeout(function () {
        unlockBody();
        syncAutoScroll();
      }, 0);
    });
  }

  /* ---------------------------------------------------------
     8. 照片灯箱
     --------------------------------------------------------- */
  var lightbox = $('.lightbox');
  var lightboxImg = $('[data-lightbox-img]');
  var lightboxCap = $('[data-lightbox-cap]');
  var photoButtons = $$('.mosaic__item');
  var photos = photoButtons.map(function (btn) {
    var img = btn.querySelector('img');
    return { thumb: img, src: img ? img.getAttribute('src') : '', alt: img ? img.getAttribute('alt') : '' };
  });
  var photoIndex = 0;

  function renderPhoto() {
    if (!lightboxImg || !photos.length) return;
    var photo = photos[photoIndex];
    lightboxImg.src = photo.src;
    lightboxImg.alt = photo.alt;
    if (lightboxCap) {
      lightboxCap.textContent = 'OUR LOVE STORY · ' + pad(photoIndex + 1) + ' / ' + pad(photos.length);
    }
  }

  function openLightbox(index) {
    if (!lightbox) return;
    if (sheet && sheet.open) sheet.close();
    photoIndex = index;
    renderPhoto();
    if (typeof lightbox.showModal === 'function') {
      lightbox.showModal();
      lockBody();
      syncAutoScroll();
    }
  }

  function closeLightbox() {
    if (lightbox && lightbox.open) lightbox.close();
  }

  function stepPhoto(direction) {
    if (!photos.length) return;
    photoIndex = (photoIndex + direction + photos.length) % photos.length;
    renderPhoto();
  }

  photoButtons.forEach(function (btn, index) {
    btn.addEventListener('click', function () {
      openLightbox(index);
    });
  });

  if (lightbox) {
    var closeBtn = $('[data-lightbox-close]', lightbox);
    var prevPhoto = $('[data-lightbox-prev]', lightbox);
    var nextPhoto = $('[data-lightbox-next]', lightbox);

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevPhoto) prevPhoto.addEventListener('click', function () { stepPhoto(-1); });
    if (nextPhoto) nextPhoto.addEventListener('click', function () { stepPhoto(1); });

    lightbox.addEventListener('close', function () {
      unlockBody();
      syncAutoScroll();
    });
    lightbox.addEventListener('cancel', function () {
      window.setTimeout(function () {
        unlockBody();
        syncAutoScroll();
      }, 0);
    });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox || event.target.classList.contains('lightbox__figure')) {
        closeLightbox();
      }
    });

    lightbox.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepPhoto(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepPhoto(1);
      }
    });

    var touchStartX = null;
    var figure = $('.lightbox__figure', lightbox);

    if (figure) {
      figure.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        touchStartX = event.clientX;
      });

      figure.addEventListener('pointerup', function (event) {
        if (touchStartX === null) return;
        var delta = event.clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) > 45) stepPhoto(delta < 0 ? 1 : -1);
      });

      figure.addEventListener('pointercancel', function () {
        touchStartX = null;
      });
    }
  }

  /* ---------------------------------------------------------
     9. 自动下滑
     无任何界面：手动滚动 / 打开面板 / 切后台暂停，
     打断结束后 2 秒自动继续，不弹提示。
     速度只改顶部 AUTO_SCROLL.speed。
     --------------------------------------------------------- */
  var autoScroll = {
    enabled: AUTO_SCROLL.enabled,
    speed: AUTO_SCROLL.speed,
    ready: false,
    active: false,
    raf: null,
    timer: null,
    y: 0,
    last: 0
  };

  /* 系统开启“减弱动效”时不自动滚动 */
  if (reduceMotion) autoScroll.enabled = false;

  function clearAutoTimer() {
    if (autoScroll.timer) {
      window.clearTimeout(autoScroll.timer);
      autoScroll.timer = null;
    }
  }

  function maxScrollTop() {
    return Math.max(0, doc.documentElement.scrollHeight - window.innerHeight);
  }

  function autoBlocked() {
    return doc.hidden || (sheet && sheet.open) || (lightbox && lightbox.open);
  }

  function stopAutoScroll() {
    if (autoScroll.raf) {
      window.cancelAnimationFrame(autoScroll.raf);
      autoScroll.raf = null;
    }
    if (autoScroll.active) {
      autoScroll.active = false;
      doc.documentElement.style.scrollBehavior = '';
    }
  }

  function finishAutoScroll() {
    autoScroll.raf = null;
    autoScroll.active = false;
    autoScroll.enabled = false;
    doc.documentElement.style.scrollBehavior = '';
    clearAutoTimer();
  }

  function autoScrollFrame(now) {
    if (!autoScroll.active) return;

    if (!autoScroll.last) autoScroll.last = now;
    var delta = Math.min(now - autoScroll.last, 100);
    autoScroll.last = now;

    if (autoBlocked()) {
      stopAutoScroll();
      return;
    }

    var actual = window.scrollY;
    if (Math.abs(actual - autoScroll.y) > 14) autoScroll.y = actual;

    var limit = maxScrollTop();
    autoScroll.y += autoScroll.speed * delta / 1000;

    if (autoScroll.y >= limit) {
      window.scrollTo(0, limit);
      finishAutoScroll();
      return;
    }

    window.scrollTo(0, autoScroll.y);
    autoScroll.raf = window.requestAnimationFrame(autoScrollFrame);
  }

  function startAutoScroll() {
    clearAutoTimer();
    if (!autoScroll.enabled || !autoScroll.ready || autoScroll.active || autoBlocked()) {
      return;
    }

    var limit = maxScrollTop();
    if (window.scrollY >= limit - 2) window.scrollTo(0, 0);

    autoScroll.active = true;
    autoScroll.last = 0;
    autoScroll.y = window.scrollY;
    doc.documentElement.style.scrollBehavior = 'auto';
    autoScroll.raf = window.requestAnimationFrame(autoScrollFrame);
  }

  function scheduleAutoStart(delay) {
    clearAutoTimer();
    if (!autoScroll.enabled || !autoScroll.ready || autoBlocked()) return;

    autoScroll.timer = window.setTimeout(function () {
      autoScroll.timer = null;
      startAutoScroll();
    }, Math.max(0, delay));
  }

  /* 手动滚动等打断：暂停，2 秒后自动继续 */
  function interruptAutoScroll() {
    if (!autoScroll.enabled) return;
    clearAutoTimer();
    stopAutoScroll();
    scheduleAutoStart(AUTO_SCROLL.resume);
  }

  /* 面板 / 灯箱 / 后台切换：先暂停，恢复后再等 2 秒 */
  function syncAutoScroll() {
    if (autoBlocked()) {
      clearAutoTimer();
      stopAutoScroll();
      return;
    }

    if (autoScroll.enabled && autoScroll.ready) {
      scheduleAutoStart(AUTO_SCROLL.resume);
    }
  }

  doc.addEventListener('wedding:ready', function () {
    autoScroll.ready = true;
    if (autoScroll.enabled) scheduleAutoStart(AUTO_SCROLL.delay);
  }, { once: true });

  doc.addEventListener('visibilitychange', function () {
    syncAutoScroll();
  });

  window.addEventListener('resize', function () {
    if (autoScroll.active) autoScroll.y = window.scrollY;
  });

  window.addEventListener('wheel', function () {
    if (autoBlocked()) return;
    interruptAutoScroll();
  }, { passive: true });

  window.addEventListener('touchmove', function () {
    if (autoBlocked()) return;
    interruptAutoScroll();
  }, { passive: true });

  window.addEventListener('keydown', function (event) {
    if (autoBlocked()) return;
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].indexOf(event.key) === -1) {
      return;
    }
    if (event.target && event.target.closest &&
        event.target.closest('button, a, input, textarea, select')) {
      return;
    }
    interruptAutoScroll();
  });

  /* ---------------------------------------------------------
     10. 分享
     --------------------------------------------------------- */
  var shareButtons = $$('[data-share]');

  function copyLink() {
    var url = location.href.split('#')[0];

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('链接已复制，可以粘贴到微信里啦');
      }).catch(function () {
        showToast('请复制浏览器地址栏的链接分享');
      });
    } else {
      var temp = doc.createElement('textarea');
      temp.value = url;
      temp.setAttribute('readonly', '');
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      body.appendChild(temp);
      temp.select();

      try {
        doc.execCommand('copy');
        showToast('链接已复制，可以粘贴到微信里啦');
      } catch (error) {
        showToast('请复制浏览器地址栏的链接分享');
      }

      body.removeChild(temp);
    }
  }

  function shareInvitation() {
    var data = {
      title: doc.title,
      text: '我们要结婚了。2027 年 1 月 23 日，在武穴，等你来。',
      url: location.href.split('#')[0]
    };

    if (navigator.share) {
      navigator.share(data).catch(function (error) {
        if (error && error.name === 'AbortError') return;
        copyLink();
      });
    } else {
      copyLink();
    }
  }

  shareButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      /* 先收起面板，否则提示条会被 dialog 的顶层遮住 */
      closeSheet();
      shareInvitation();
    });
  });

  /* ---------------------------------------------------------
     11. 杂项
     --------------------------------------------------------- */
  /* 面板里的锚点：先关闭，再交给浏览器跳转 */
  $$('.sheet a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function () {
      closeSheet();
    });
  });

  /* 从 hash 进入时，等字体与封面就位后再定位 */
  if (location.hash) {
    window.addEventListener('load', function () {
      var targetEl = doc.querySelector(location.hash);
      if (targetEl) {
        window.setTimeout(function () {
          targetEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 700);
      }
    }, { once: true });
  }

  /* 键盘 Esc 已由 dialog 原生处理；这里仅防止叠加锁定 */
  doc.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      window.setTimeout(unlockBody, 0);
    }
  });
}());
