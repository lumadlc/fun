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
    wrap.innerHTML = `
      <a href="/dashboard.html" class="btn btn-ghost">Профиль</a>
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
