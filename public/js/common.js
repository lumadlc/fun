async function fetchMe() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function renderHeaderActions(me) {
  const wrap = document.getElementById('header-actions');
  if (!wrap) return;
  if (me) {
    let adminBtn = '';
    if (me.is_admin) {
      adminBtn = `
        <a href="/admin.html" class="btn btn-ghost" title="Админ панель">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21 3l-5 9h5l-6.891 7.086a6.5 6.5 0 1 1 -8.855 -9.506l7.746 -6.58l-1 5l9 -5" /><path d="M7 14.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" /></svg>
        </a>
      `;
    }
    wrap.innerHTML = `
      ${adminBtn}
      <div class="header-user-profile">
        <div class="header-avatar">${me.username[0].toUpperCase()}</div>
        <a href="/dashboard.html" class="btn btn-ghost">Личный кабинет</a>
      </div>
    `;
  } else {
    wrap.innerHTML = `
      <a href="/auth.html?tab=login" class="btn btn-ghost">Войти</a>
      <a href="/auth.html?tab=register" class="btn btn-primary">Регистрация</a>
    `;
  }
}

async function initHeader() {
  const me = await fetchMe();
  renderHeaderActions(me);
  return me;
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
});
