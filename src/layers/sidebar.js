const SOURCES = {
  dwd: 'DWD',
  nina: 'BBK/NINA'
};

export function initSidebar() {
  const container = document.getElementById('sidebar');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'sidebar-header';
  header.innerHTML = '<strong>Warnungen</strong><span style="color: var(--accent); font-size: 0.9rem;">Live</span>';

  const tabs = document.createElement('div');
  tabs.className = 'sidebar-tabs';

  const body = document.createElement('div');
  body.className = 'sidebar-body';

  const state = {
    active: 'dwd',
    data: {
      dwd: [],
      nina: []
    }
  };

  const render = () => {
    body.innerHTML = '';
    const items = state.data[state.active];
    if (!items.length) {
      const p = document.createElement('p');
      p.textContent = 'Keine aktiven Warnungen.';
      body.appendChild(p);
      return;
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'warning-card';
      card.style.borderLeftColor = item.color;

      const title = document.createElement('div');
      title.className = 'warning-title';
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'warning-meta';
      meta.textContent = item.validity;

      const bodyText = document.createElement('div');
      bodyText.className = 'warning-body';
      bodyText.textContent = item.description;

      card.appendChild(title);
      if (item.validity) card.appendChild(meta);
      if (item.description) card.appendChild(bodyText);
      card.addEventListener('click', () => {
        const lines = [item.title];
        if (item.validity) lines.push(`Zeitraum: ${item.validity}`);
        if (item.description) lines.push(item.description);
        alert(lines.join('\n\n'));
      });
      body.appendChild(card);
    }
  };

  const makeTab = (key) => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-tab';
    btn.textContent = SOURCES[key];
    btn.addEventListener('click', () => {
      state.active = key;
      for (const child of tabs.children) child.classList.remove('active');
      btn.classList.add('active');
      render();
    });
    if (key === state.active) btn.classList.add('active');
    return btn;
  };

  tabs.appendChild(makeTab('dwd'));
  tabs.appendChild(makeTab('nina'));

  container.appendChild(header);
  container.appendChild(tabs);
  container.appendChild(body);

  render();

  return {
    updateWarnings: (source, items) => {
      state.data[source] = items;
      render();
    }
  };
}
