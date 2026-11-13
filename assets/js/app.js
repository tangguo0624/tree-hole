/* ==========================================================================
   树洞 · Tree Hole —— 交互逻辑
   分层：Store（localStorage 适配）/ Format（纯函数）/ Render（DOM）/ Controller（事件）
   无第三方依赖，无构建步骤
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'treehole.posts.v1';
  var MAX_LENGTH = 300;
  var WARN_THRESHOLD = 280;
  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  var els = {
    form: document.getElementById('composerForm'),
    input: document.getElementById('postContent'),
    counter: document.getElementById('charCount'),
    submit: document.getElementById('submitBtn'),
    list: document.getElementById('postList'),
    empty: document.getElementById('emptyState'),
    count: document.getElementById('voiceCount'),
    toast: document.getElementById('toast'),
    dock: document.querySelector('.dock'),
    about: document.getElementById('about')
  };

  var posts = [];
  var toastTimer = null;
  var storageBroken = false;

  /* ---------------------------------------------------------------- Store */

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizePost(item) {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.content !== 'string' || !item.content.trim()) return null;
    if (typeof item.createdAt !== 'number' || !isFinite(item.createdAt)) return null;
    return {
      id: item.id ? String(item.id) : createId(),
      content: item.content.slice(0, MAX_LENGTH),
      createdAt: item.createdAt
    };
  }

  function loadPosts() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      storageBroken = true;
      console.warn('[树洞] 本地存储不可用，本次内容不会保存。', err);
      showToast('浏览器禁用了本地存储，内容仅在本次打开期间可见');
      return [];
    }

    if (!raw) return [];

    try {
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('本地数据格式不是数组');
      var cleaned = data.map(normalizePost).filter(Boolean);
      cleaned.sort(function (a, b) { return b.createdAt - a.createdAt; });
      return cleaned;
    } catch (err) {
      console.warn('[树洞] 本地数据解析失败，已按空列表展示。', err);
      return [];
    }
  }

  function savePosts() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (err) {
      storageBroken = true;
      console.warn('[树洞] 写入本地存储失败。', err);
      showToast('存储空间不可用，这条心事只留在当前页面');
      return false;
    }
  }

  /* --------------------------------------------------------------- Format */

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatRelativeTime(timestamp) {
    var diff = Date.now() - timestamp;
    if (diff < MINUTE) return '刚刚';
    if (diff < HOUR) return Math.floor(diff / MINUTE) + ' 分钟前';
    if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前';
    if (diff < 7 * DAY) return Math.floor(diff / DAY) + ' 天前';

    var date = new Date(timestamp);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /* --------------------------------------------------------------- Render */

  function buildPostNode(post) {
    var item = document.createElement('li');
    item.className = 'post';
    item.dataset.id = post.id;

    var avatar = document.createElement('div');
    avatar.className = 'post__avatar';
    avatar.setAttribute('aria-hidden', 'true');

    var body = document.createElement('div');
    body.className = 'post__body';

    var time = document.createElement('time');
    time.className = 'post__time';
    time.dateTime = new Date(post.createdAt).toISOString();
    time.textContent = formatRelativeTime(post.createdAt);

    var content = document.createElement('p');
    content.className = 'post__content';
    /* textContent 输出，天然防止 HTML 注入 */
    content.textContent = post.content;

    body.appendChild(time);
    body.appendChild(content);
    item.appendChild(avatar);
    item.appendChild(body);
    return item;
  }

  function renderList() {
    var fragment = document.createDocumentFragment();
    posts.forEach(function (post) {
      fragment.appendChild(buildPostNode(post));
    });

    els.list.replaceChildren(fragment);
    els.empty.hidden = posts.length > 0;
    els.count.textContent = String(posts.length);

    var nodes = els.list.children;
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].style.animationDelay = Math.min(i, 6) * 26 + 'ms';
    }
  }

  function refreshTimes() {
    var nodes = els.list.children;
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var post = posts.filter(function (p) { return p.id === node.dataset.id; })[0];
      var time = node.querySelector('.post__time');
      if (!post || !time) continue;
      time.textContent = formatRelativeTime(post.createdAt);
    }
  }

  function updateCounter() {
    var length = els.input.value.length;
    els.counter.textContent = length + ' / ' + MAX_LENGTH;
    els.counter.classList.toggle('is-warn', length >= WARN_THRESHOLD);
    els.submit.disabled = els.input.value.trim().length === 0;
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2400);
  }

  /* ----------------------------------------------------------- Controller */

  function handleSubmit(event) {
    if (event) event.preventDefault();

    var content = els.input.value.trim();
    if (!content) {
      els.input.focus();
      return;
    }

    var post = {
      id: createId(),
      content: content.slice(0, MAX_LENGTH),
      createdAt: Date.now()
    };

    posts.unshift(post);
    savePosts();
    renderList();

    els.input.value = '';
    updateCounter();
    els.input.focus();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(storageBroken ? '已投进树洞（未写入本地存储）' : '已投进树洞，叶子替你说完了');
  }

  function handleScrollState() {
    document.body.classList.toggle('is-scrolled', window.scrollY > 80);
  }

  function initDock() {
    window.addEventListener('scroll', handleScrollState, { passive: true });
    handleScrollState();

    if (!els.dock) return;

    els.dock.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      var action = trigger.dataset.action;

      if (action === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (action === 'compose') {
        els.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        els.input.focus({ preventScroll: true });
        return;
      }

      if (action === 'about' && els.about) {
        els.about.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function init() {
    if (!els.form || !els.input || !els.list) return;

    posts = loadPosts();
    renderList();
    updateCounter();

    els.form.addEventListener('submit', handleSubmit);

    els.input.addEventListener('input', updateCounter);

    els.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleSubmit(event);
      }
    });

    initDock();

    window.setInterval(refreshTimes, MINUTE);
    window.addEventListener('focus', refreshTimes);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
