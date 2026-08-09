// 学生ジャンカーの会 — interactions
// scroll reveals + circuit trace draw-in + address copy button + build registry

// ============================================================
// サイト管理者へ: この2つを実際のURLに書き換えてください。
//
// FORM_URL:
//   建造物登録用のGoogleフォームのURL（フォーム編集画面右上の「送信」→リンクをコピー）
//
// SHEET_CSV_URL:
//   フォームの回答が入っているGoogleスプレッドシートを開き、
//   ファイル → 共有 → ウェブに公開 → 「カンマ区切り値(.csv)」を選んで公開し、
//   発行されたURLをここに貼り付ける。
//   （スプレッドシートの1行目はヘッダー行にしてください。列の並びは
//    「建造物名, X, Y, Z, 登録者, メモ」を想定しています。Googleフォームの
//    デフォルトどおりならタイムスタンプ列が先頭に付きますが、それも問題ありません）
// ============================================================
const FORM_URL = 'https://forms.gle/hrn5p6Dyiq4DTxAh8';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTnOX6oYgIolISQVZtsCiIDgKQWoN3W8bVSgxDdrXCfyfOAcWD310KixY8LoRebih98j5I8Zc34cTxN/pub?output=csv';

(() => {
  const revealTargets = document.querySelectorAll('.reveal');
  const traces = document.querySelectorAll('.pcb-traces .trace');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealTargets.forEach((el) => io.observe(el));

  // light up circuit traces as the page is scrolled
  const traceIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('lit');
      }
    });
  }, { threshold: 0.05 });

  traces.forEach((t) => traceIO.observe(t));

  // copy server address
  const copyBtn = document.getElementById('copyBtn');
  const addressEl = document.getElementById('serverAddress');

  if (copyBtn && addressEl) {
    copyBtn.addEventListener('click', async () => {
      const text = addressEl.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        // clipboard API unavailable — fall back silently
      }
      const original = copyBtn.textContent;
      copyBtn.textContent = 'COPIED';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = original;
        copyBtn.classList.remove('copied');
      }, 1500);
    });
  }

  // ---------- build registry ----------

  const formLink = document.getElementById('formLink');
  if (formLink) formLink.href = FORM_URL;

  const heroFormLink = document.getElementById('heroFormLink');
  if (heroFormLink) heroFormLink.href = FORM_URL;

  const bomBody = document.getElementById('bomBody');
  const searchInput = document.getElementById('registrySearch');

  // header name candidates -> internal field, so this still works
  // whichever wording the form questions ended up using
  const HEADER_MAP = {
    name: ['建造物名', '名称', '名前', 'タイトル'],
    x: ['x', 'x座標', 'X座標'],
    y: ['y', 'y座標', 'Y座標'],
    z: ['z', 'z座標', 'Z座標'],
    registrant: ['登録者', '登録者名', '名前（登録者）', 'ユーザー名'],
    note: ['メモ', '備考', 'コメント'],
  };

  function findColumn(headers, candidates) {
    const lower = headers.map((h) => (h || '').trim().toLowerCase());
    for (const cand of candidates) {
      const idx = lower.indexOf(cand.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function renderState(message, isError) {
    bomBody.innerHTML = '';
    const row = document.createElement('tr');
    row.className = 'bom-state' + (isError ? ' is-error' : '');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'mono';
    cell.textContent = message;
    row.appendChild(cell);
    bomBody.appendChild(row);
  }

  function renderRows(entries) {
    bomBody.innerHTML = '';

    if (entries.length === 0) {
      renderState('まだ登録がありません。最初の建造物を登録してみよう。', false);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = entry.name || '(無題)';

      const coordTd = document.createElement('td');
      coordTd.className = 'coord';
      coordTd.textContent = `${entry.x || '-'}, ${entry.y || '-'}, ${entry.z || '-'}`;

      const regTd = document.createElement('td');
      regTd.textContent = entry.registrant || '-';

      const noteTd = document.createElement('td');
      noteTd.textContent = entry.note || '';

      tr.append(nameTd, coordTd, regTd, noteTd);
      tr.dataset.search = `${entry.name} ${entry.registrant}`.toLowerCase();
      bomBody.appendChild(tr);
    });
  }

  function applySearchFilter() {
    if (!searchInput) return;
    const q = searchInput.value.trim().toLowerCase();
    const rows = bomBody.querySelectorAll('tr:not(.bom-state)');
    rows.forEach((row) => {
      const match = !q || (row.dataset.search || '').includes(q);
      row.style.display = match ? '' : 'none';
    });
  }

  function loadRegistry() {
    if (!bomBody) return;

    if (SHEET_CSV_URL.includes('REPLACE_WITH_YOUR_SHEET_ID')) {
      renderState('サイト管理者へ: SHEET_CSV_URL が未設定です（script.js を確認してください）。', true);
      return;
    }

    if (typeof Papa === 'undefined') {
      renderState('読み込みに失敗しました。ページを再読み込みしてください。', true);
      return;
    }

    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (!rows || rows.length < 2) {
          renderState('まだ登録がありません。最初の建造物を登録してみよう。', false);
          return;
        }

        const headers = rows[0];
        const col = {
          name: findColumn(headers, HEADER_MAP.name),
          x: findColumn(headers, HEADER_MAP.x),
          y: findColumn(headers, HEADER_MAP.y),
          z: findColumn(headers, HEADER_MAP.z),
          registrant: findColumn(headers, HEADER_MAP.registrant),
          note: findColumn(headers, HEADER_MAP.note),
        };

        const entries = rows.slice(1).map((r) => ({
          name: col.name !== -1 ? r[col.name] : '',
          x: col.x !== -1 ? r[col.x] : '',
          y: col.y !== -1 ? r[col.y] : '',
          z: col.z !== -1 ? r[col.z] : '',
          registrant: col.registrant !== -1 ? r[col.registrant] : '',
          note: col.note !== -1 ? r[col.note] : '',
        })).filter((e) => e.name || e.x || e.y || e.z);

        renderRows(entries);
      },
      error: () => {
        renderState('読み込みに失敗しました。スプレッドシートの公開設定を確認してください。', true);
      },
    });
  }

  if (searchInput) searchInput.addEventListener('input', applySearchFilter);

  loadRegistry();
})();
