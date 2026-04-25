const HEADER_LABELS = {
  'rev-sym': 'Rev-Sym',
  'iata-req': 'IATA-Req',
  'onu': 'ONU',
  'Nombre apropiado de envío/Descripción': 'Nombre',
  'Clase o Div. (Peligros sec.)': 'Clase',
  'Etiqueta(s) de peligro': 'Etiqueta',
  'Grp. De emb.': 'Grp Emb',
  'EQ': 'EQ',
  'APCCL-embalaje': 'APCCL Emb',
  'APCCL-neta-máx-bulto': 'APCCL Neta',
  'APC-embalaje': 'APC Emb',
  'APC-neta-máx-bulto': 'APC Neta',
  'AC-embalaje': 'AC Emb',
  'AC-neta-máx-bulto': 'AC Neta',
  'Disp-espec': 'Disp Espec',
  'CRE': 'CRE',
  'ingles': 'Inglés'
}

const PDF_PATHS = {
  'APCCL-embalaje': 'PDF/PI',
  'APC-embalaje': 'PDF/PI',
  'AC-embalaje': 'PDF/PI',
  'EQ': 'PDF/E',
  'Disp-espec': 'PDF/DE',
}

const INVALID_VALUES = new Set(['prohibido', 'no restringido', 'nan', '—', '', null, undefined])
const EMBALAJE_COLS = ['APCCL Emb', 'APC Emb', 'AC Emb']

let columnasEmbMap = null
async function loadColumnasEmbalaje() {
  if (columnasEmbMap) return columnasEmbMap
  const res = await fetch('columnas_embalaje.json')
  columnasEmbMap = await res.json()
  return columnasEmbMap
}

function isInvalid(val) {
  if (val === null || val === undefined) return true
  return INVALID_VALUES.has(String(val).toLowerCase().trim())
}

function parseClaseImages(claseRaw) {
  if (!claseRaw || claseRaw === 'nan') return []
  const nums = claseRaw.match(/\d+(\.\d+)?[A-Z]*/g) || []
  const imgs = []
  const seen = new Set()
  for (const n of nums) {
    const base = n.replace(/[A-Z]+$/, '')
    if (seen.has(base)) continue
    seen.add(base)
    let file
    if (base.startsWith('1.')) {
      const div = base.substring(0, 3)
      file = div + '.png'
    } else {
      file = base + '.png'
    }
    imgs.push(file)
  }
  return imgs
}

function buildExtraEtiqImgs(etiqRaw, isLitio) {
  let html = ''
  if (/mantener\s+alejado\s+del\s+calor/i.test(etiqRaw)) {
    html += `<img src="Etiquetas/alejada-del-calor.png" alt="Mantener alejado del calor" title="Mantener alejado del calor" style="height:140px;margin-right:8px;">`
  }
  if (/l[ií]quido\s+criog[eé]nico/i.test(etiqRaw)) {
    html += `<img src="Etiquetas/criogenic.png" alt="Líquido criogénico" title="Líquido criogénico" style="height:140px;margin-right:8px;">`
  }
  if (/materiales?\s+magnetizad[oa]s?/i.test(etiqRaw)) {
    html += `<img src="Etiquetas/magentizado.png" alt="Materiales magnetizados" title="Materiales magnetizados" style="height:140px;margin-right:8px;">`
  }
  if (isLitio) {
    html += `<img src="Etiquetas/litio.png" alt="Batería de litio / ión sodio" title="Batería de litio / ión sodio" style="height:140px;margin-right:8px;">`
  }
  if (/fisible/i.test(etiqRaw)) {
    html += `<img src="Etiquetas/fissible.png" alt="Fisible" title="Fisible" style="height:140px;margin-right:8px;">`
  }
  if (/sustancias?\s+nocivas?\s+para\s+el\s+medio\s+ambiente/i.test(etiqRaw)) {
    html += `<img src="Etiquetas/peligro-al-medio-ambiente.png" alt="Sustancias nocivas para el medio ambiente" title="Sustancias nocivas para el medio ambiente" style="height:140px;margin-right:8px;">`
  }
  return html
}

async function showEtiquetas(row, container) {
  const columnasEmb = await loadColumnasEmbalaje()
  const headers = [...container.querySelectorAll('thead th')].map(th => th.textContent.trim())
  const cells = [...row.querySelectorAll('td')]

  const claseIdx = headers.indexOf('Clase')
  const claseRaw = claseIdx >= 0 ? cells[claseIdx]?.textContent.trim() : ''
  let claseImgFiles = parseClaseImages(claseRaw)

  const etiqIdx = headers.indexOf('Etiqueta')
  const etiqRaw = etiqIdx >= 0 ? cells[etiqIdx]?.textContent || '' : ''
  const isLitio = /bat\w*\s+(?:de\s+)?litio|bat\w*\s+(?:de\s+)?i[oó]n\s+sodio/i.test(etiqRaw)
  if (isLitio) {
    claseImgFiles = claseImgFiles.map(f => f === '9.png' ? '9-litio.png' : f)
  }
  const etiquetaImgs = claseImgFiles.map(file =>
    `<img src="Etiquetas/${file}" alt="${file}" title="${file}" style="height:140px;margin-right:8px;">`
  ).join('')
  const extraEtiqImgs = buildExtraEtiqImgs(etiqRaw, isLitio)

  const piEntries = []
  for (const label of EMBALAJE_COLS) {
    const idx = headers.indexOf(label)
    const code = idx >= 0 ? cells[idx]?.textContent.trim() : null
    if (code && !isInvalid(code)) {
      piEntries.push({ code, origin: label })
    }
  }

  const detail = document.getElementById('embalaje-detail')

  if (piEntries.length === 0) {
    detail.innerHTML = '<p class="text-center text-muted mt-3">No hay PI válida para esta fila.</p>'
    return
  }

  const onuValue = document.getElementById('numInput').value

  const rowsHtml = piEntries.map(e => {
    const piExtra = e.origin === 'APCCL Emb'
      ? '<img src="Etiquetas/Y.png" alt="Carga Limitada" class="etq-img">'
      : e.origin === 'AC Emb'
        ? '<img src="Etiquetas/cargounicamente.png" alt="Cargo Aircraft Only" class="etq-img">'
        : ''
    const fullLabel = columnasEmb[e.origin] || e.origin
    return `
      <div class="etq-row" data-origin="${e.origin}" data-pi="${e.code}" data-label="${fullLabel.replace(/"/g, '&quot;')}">
        <div class="etq-type">
          <span class="etq-name">${fullLabel}</span>
        </div>
        <div class="etq-imgs">
          ${etiquetaImgs}${extraEtiqImgs}${piExtra}
        </div>
        <div class="etq-check"><span class="etq-check-circle">✓</span></div>
      </div>
    `
  }).join('')

  detail.innerHTML = `
    <div class="etq-list mt-4">${rowsHtml}</div>
    <div class="etq-actions mt-4 text-center">
      <button id="cotizarBtn" class="btn btn-primary btn-lg" disabled>Consultar / Cotizar</button>
    </div>
  `

  const cotizarBtn = document.getElementById('cotizarBtn')
  detail.querySelectorAll('.etq-row').forEach(card => {
    card.addEventListener('click', () => {
      const wasSelected = card.classList.contains('selected')
      detail.querySelectorAll('.etq-row.selected').forEach(c => c.classList.remove('selected'))
      if (!wasSelected) card.classList.add('selected')
      cotizarBtn.disabled = !detail.querySelector('.etq-row.selected')
    })
  })

}

function renderCell(col, val) {
  if (val === null || val === undefined || val === '') return '—'
  const folder = PDF_PATHS[col]
  if (folder && !isInvalid(val)) {
    const parts = String(val).split('\n').map(v => v.trim()).filter(Boolean)
    return parts.map(v =>
      isInvalid(v) ? v : `<a href="${folder}/${encodeURIComponent(v)}.pdf" target="_blank">${v}</a>`
    ).join(' ')
  }
  return val
}

function renderTable(rows) {
  const container = document.getElementById('results')

  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No results found.</p>'
    document.getElementById('embalaje-detail').innerHTML = ''
    return
  }

  document.getElementById('embalaje-detail').innerHTML = ''
  const columns = Object.keys(rows[0]).slice(1)
  const isHidden = col => {
    const label = HEADER_LABELS[col] || col
    return /neta|disp[\s-]?espec|ingl[eé]s|^eq$|^etiqueta$/i.test(label)
  }

  const headers = columns.map(col => {
    const label = HEADER_LABELS[col] || col
    const style = isHidden(col) ? ' style="display:none;"' : ''
    return `<th class="text-nowrap"${style}>${label}</th>`
  }).join('')

  const bodyRows = rows.map(row => {
    const cells = columns.map(col => {
      const val = row[col] ?? null
      const style = isHidden(col) ? ' style="display:none;"' : ''
      return `<td${style}>${renderCell(col, val)}</td>`
    }).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-bordered table-striped table-hover align-middle">
        <thead class="table-dark">
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  `

  container.querySelector('tbody').addEventListener('click', e => {
    const row = e.target.closest('tr')
    if (!row) return
    const prev = container.querySelector('tr.selected')
    if (prev) prev.classList.remove('selected')
    if (prev !== row) {
      row.classList.add('selected')
      showEtiquetas(row, container)
    } else {
      document.getElementById('embalaje-detail').innerHTML = ''
    }
  })
}

let tablaOnu = null
async function loadTablaOnu() {
  if (tablaOnu) return tablaOnu
  const res = await fetch('tabla_onu.json')
  tablaOnu = await res.json()
  return tablaOnu
}

async function fetchRows(value) {
  const data = await loadTablaOnu()
  const rows = data.filter(row => String(row.onu) === String(value))
  renderTable(rows)
}

document.getElementById('numInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click()
})

document.getElementById('searchBtn').addEventListener('click', () => {
  const raw = document.getElementById('numInput').value
  if (!raw) {
    alert('Please enter a number first.')
    return
  }
  const value = String(parseInt(raw, 10))
  fetchRows(value)
})
