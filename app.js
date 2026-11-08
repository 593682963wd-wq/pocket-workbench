/* 掌上工作台 —— 纯前端 PWA，数据存 localStorage */
(function () {
  'use strict';

  var LS_KEY = 'offline_pocket_v1';
  // 一张页面持有写锁直到离页；读者保留输入但不能并发覆盖整个存储快照。
  var writerReady = false;
  var writerPending = false;
  var releaseWriter = null;
  function ensureWriter() {
    if (writerReady || writerPending || !navigator.locks) return;
    writerPending = true;
    navigator.locks.request(LS_KEY + ':writer', { ifAvailable: true }, function (lock) {
      writerPending = false;
      if (!lock) return;
      writerReady = true;
      state = load();
      return new Promise(function (resolve) { releaseWriter = resolve; });
    }).catch(function () { writerPending = false; writerReady = false; });
  }


  /* ---------- 数据 ---------- */
  var persistedRaw = null;
  var state = load();
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      persistedRaw = raw;
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultState();
  }
  function defaultState() {
    return {
      groups: [{ id: 'g1', name: '常用' }],
      links: [],
      todos: [],
      note: '',
      noteTs: null,
      theme: 'auto'
    };
  }
  function save() {
    if (!writerReady) {
      state = load();
      ensureWriter();
      toast(navigator.locks ? '另一页面正在编辑，当前修改未保存；关闭它后请重试' : '当前浏览器无法安全保存，请用最新版浏览器打开本机服务');
      return false;
    }
    try {
      // 存储事件尚未送到当前页时，也拒绝用旧快照覆盖另一页的新内容。
      if (localStorage.getItem(LS_KEY) !== persistedRaw) {
        state = load();
        toast('其他页面已更新，当前修改未保存，请刷新后重试');
        return false;
      }
      var raw = JSON.stringify(state);
      localStorage.setItem(LS_KEY, raw);
      persistedRaw = raw;
      return true;
    } catch (e) {
      state = load();
      toast('保存失败：存储空间不足，当前修改尚未保存');
      return false;
    }
  }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- 问候 + 时钟 ---------- */
  function tick() {
    var now = new Date();
    var h = now.getHours();
    var greet = h < 5 ? '夜深了' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    $('greeting').textContent = greet;
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    $('clock').textContent = String(h).padStart(2, '0') + ':' + mm + ':' + ss;
    var wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    $('date').textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + wd;
  }
  setInterval(tick, 1000);

  /* ---------- 网址分组 ---------- */
  var currentGroup = 'all';
  function renderLinks() {
    var tabs = $('groupTabs');
    tabs.innerHTML = '';
    var allTab = document.createElement('button');
    allTab.className = 'group-tab' + (currentGroup === 'all' ? ' active' : '');
    allTab.textContent = '全部';
    allTab.addEventListener('click', function () { currentGroup = 'all'; renderLinks(); });
    tabs.appendChild(allTab);
    state.groups.forEach(function (g) {
      var b = document.createElement('button');
      b.className = 'group-tab' + (currentGroup === g.id ? ' active' : '');
      b.textContent = g.name;
      b.addEventListener('click', function () { currentGroup = g.id; renderLinks(); });
      tabs.appendChild(b);
    });

    var list = state.links.filter(function (l) { return currentGroup === 'all' || l.group === currentGroup; });
    var grid = $('linksGrid');
    grid.innerHTML = '';
    $('linksEmpty').classList.toggle('show', list.length === 0);
    list.forEach(function (l) {
      var a = document.createElement('a');
      a.className = 'link-item' + (state.editing ? ' editing' : '');
      try { if (!['http:', 'https:'].includes(new URL(l.url).protocol)) return; } catch (e) { return; }
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      var icon = document.createElement('div');
      icon.className = 'licon';
      icon.textContent = firstChar(l.name);
      var name = document.createElement('div');
      name.className = 'lname';
      name.textContent = l.name;
      var del = document.createElement('button');
      del.className = 'ldel';
      del.textContent = '✕';
      del.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        state.links = state.links.filter(function (x) { return x.id !== l.id; });
        if (save()) toast('已删除');
        renderLinks();
      });
      a.appendChild(icon); a.appendChild(name); a.appendChild(del);
      grid.appendChild(a);
    });
  }
  function hostOf(u) {
    try { return new URL(u).hostname; } catch (e) { return u; }
  }
  function firstChar(s) { return (s || '?').trim().charAt(0).toUpperCase(); }

  $('btnAddLink').addEventListener('click', openLinkModal);
  $('fabAdd').addEventListener('click', openLinkModal);
  function openLinkModal() {
    fillGroupSelect($('linkGroup'));
    $('linkName').value = '';
    $('linkUrl').value = '';
    $('linkModal').hidden = false;
    setTimeout(function () { $('linkName').focus(); }, 120);
  }
  function fillGroupSelect(sel) {
    sel.innerHTML = '';
    state.groups.forEach(function (g) {
      var o = document.createElement('option');
      o.value = g.id; o.textContent = g.name;
      sel.appendChild(o);
    });
  }
  $('btnLinkCancel').addEventListener('click', function () { $('linkModal').hidden = true; });
  $('btnLinkSave').addEventListener('click', function () {
    var name = $('linkName').value.trim();
    var url = $('linkUrl').value.trim();
    if (!name || !url) { toast('名称和网址都要填'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { var parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); } catch (e) { toast('请输入不带账号密码的 HTTP(S) 网址'); return; }
    state.links.unshift({ id: uid(), name: name, url: url, group: $('linkGroup').value });
    if (!save()) return;
    renderLinks();
    $('linkModal').hidden = true;
    toast('已添加');
  });

  /* 分组管理 */
  $('btnManageGroups').addEventListener('click', function () {
    renderGroupList();
    $('groupInput').value = '';
    $('groupModal').hidden = false;
  });
  $('groupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('groupInput').value.trim();
    if (!name) return;
    if (state.groups.some(function (g) { return g.name === name; })) { toast('分组已存在'); return; }
    state.groups.push({ id: uid(), name: name });
    if (!save()) { renderGroupList(); renderLinks(); return; }
    renderGroupList(); renderLinks();
  });
  function renderGroupList() {
    var ul = $('groupManageList');
    ul.innerHTML = '';
    state.groups.forEach(function (g) {
      var li = document.createElement('li');
      li.className = 'group-manage-item';
      var span = document.createElement('span');
      span.textContent = g.name;
      var count = state.links.filter(function (l) { return l.group === g.id; }).length;
      var c = document.createElement('span');
      c.className = 'count';
      c.textContent = count + ' 个';
      var del = document.createElement('button');
      del.className = 'gdel-btn';
      del.textContent = '删除';
      del.addEventListener('click', function () {
        if (state.groups.length <= 1) { toast('至少保留一个分组'); return; }
        state.links = state.links.filter(function (l) { return l.group !== g.id; });
        state.groups = state.groups.filter(function (x) { return x.id !== g.id; });
        if (currentGroup === g.id) currentGroup = 'all';
        if (!save()) { renderGroupList(); renderLinks(); return; }
        renderGroupList(); renderLinks();
        toast('已删除分组');
      });
      li.appendChild(span); li.appendChild(c); li.appendChild(del);
      ul.appendChild(li);
    });
  }
  $('btnGroupDone').addEventListener('click', function () { $('groupModal').hidden = true; });
  $('groupModal').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });
  $('linkModal').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

  /* ---------- 待办 ---------- */
  function renderTodos() {
    var ul = $('todoList');
    ul.innerHTML = '';
    var undone = state.todos.filter(function (t) { return !t.done; }).length;
    $('todoCount').textContent = undone + ' 项未完成';
    state.todos.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');
      var check = document.createElement('button');
      check.className = 'todo-check';
      check.textContent = t.done ? '✓' : '';
      check.setAttribute('aria-label', '完成');
      check.addEventListener('click', function () {
        t.done = !t.done;
        save(); renderTodos();
      });
      var span = document.createElement('span');
      span.className = 'todo-text';
      span.textContent = t.text;
      var del = document.createElement('button');
      del.className = 'todo-del';
      del.textContent = '🗑';
      del.setAttribute('aria-label', '删除');
      del.addEventListener('click', function () {
        state.todos = state.todos.filter(function (x) { return x.id !== t.id; });
        save(); renderTodos();
      });
      li.appendChild(check); li.appendChild(span); li.appendChild(del);
      ul.appendChild(li);
    });
  }
  $('todoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('todoInput').value.trim();
    if (!text) return;
    state.todos.unshift({ id: uid(), text: text, done: false });
    if (!save()) { renderTodos(); return; }
    renderTodos();
    $('todoInput').value = '';
  });

  /* ---------- 便签 ---------- */
  var noteTimer = null;
  var noteDirty = false;
  function persistNote() {
    clearTimeout(noteTimer);
    noteTimer = null;
    state.note = $('noteText').value;
    state.noteTs = Date.now();
    var saved = save();
    if (saved) noteDirty = false;
    $('noteSaved').textContent = saved
      ? '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : '尚未保存，请保留文字并重试';
  }
  $('noteText').addEventListener('input', function () {
    noteDirty = true;
    clearTimeout(noteTimer);
    $('noteSaved').textContent = '输入中…';
    noteTimer = setTimeout(persistNote, 600);
  });
  // 离页时定时器可能永不执行，先同步冲刷尚未保存的便签。
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && noteTimer !== null) persistNote();
  });
  window.addEventListener('pagehide', function () {
    if (noteTimer !== null) persistNote();
    writerReady = false;
    if (releaseWriter) { releaseWriter(); releaseWriter = null; }
  });
  window.addEventListener('pageshow', ensureWriter);
  window.addEventListener('focus', ensureWriter);

  /* ---------- 主题 ---------- */
  function applyTheme() {
    var t = state.theme;
    var dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"][media]');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function (m) { m.setAttribute('content', dark ? '#0f1420' : '#4f8cff'); });
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (state.theme === 'auto') applyTheme();
  });

  /* ---------- 设置 ---------- */
  $('btnSettings').addEventListener('click', function () {
    $('setTheme').value = state.theme;
    $('settingsModal').hidden = false;
  });
  $('btnSettingsCancel').addEventListener('click', function () { $('settingsModal').hidden = true; });
  $('btnSettingsSave').addEventListener('click', function () {
    state.theme = $('setTheme').value;
    if (!save()) return;
    $('settingsModal').hidden = true;
    applyTheme();
    toast('设置已保存');
  });
  $('settingsModal').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

  /* ---------- 长按进入编辑模式（删除网址） ---------- */
  var pressTimer = null;
  document.addEventListener('touchstart', function (e) {
    var target = e.target.closest('.link-item');
    if (!target) return;
    pressTimer = setTimeout(function () {
      state.editing = !state.editing;
      renderLinks();
      toast(state.editing ? '编辑模式：点 ✕ 删除' : '已退出编辑模式');
    }, 600);
  }, { passive: true });
  document.addEventListener('touchend', function () { clearTimeout(pressTimer); }, { passive: true });
  document.addEventListener('touchmove', function () { clearTimeout(pressTimer); }, { passive: true });

  /* ---------- 初始化 ---------- */
  function init() {
    applyTheme();
    tick();
    $('noteText').value = state.note || '';
    if (state.noteTs) {
      $('noteSaved').textContent = '已保存 ' + new Date(state.noteTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    renderLinks();
    renderTodos();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 离线能力为增强项，失败不阻塞 */ });
    }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.modal-mask').forEach(function (m) { m.hidden = true; }); });
  init();
  ensureWriter();
  window.addEventListener('storage', function (event) {
    if (event.key !== LS_KEY || event.newValue === persistedRaw) return;
    if (noteDirty) {
      $('noteSaved').textContent = '其他页面已更新，本页便签尚未保存';
      return;
    }
    state = load();
    applyTheme();
    renderLinks();
    renderTodos();
    $('noteText').value = state.note || '';
    $('noteSaved').textContent = state.noteTs ? '已同步其他页面保存的便签' : '';
  });
})();
