import { Inventory } from '../types/inventory'
import { CSV_HEADER, exportInventoriesToCsv, inventoryToRow } from './exportCsv'

// Exportação de UM inventário, com os mesmos campos da planilha consolidada.

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'inventario'
  )
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)

/** Planilha (.csv, abre no Excel) com uma linha para o inventário. */
export function exportInventoryExcel(inventory: Inventory) {
  const date = new Date().toISOString().slice(0, 10)
  exportInventoriesToCsv([inventory], undefined, `inventario-${slug(inventory.title || 'processo')}-${date}.csv`)
}

/**
 * PDF: abre uma página de impressão com todos os campos e chama a impressão
 * do navegador, onde o usuário escolhe "Salvar como PDF".
 */
export function exportInventoryPdf(inventory: Inventory) {
  const row = inventoryToRow(inventory)
  const title = inventory.title || 'Inventário de Processo'
  const rows = CSV_HEADER.map(
    (label, idx) =>
      `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(row[idx] ?? '')).replace(/ \| /g, '<br>') || '—'}</td></tr>`
  ).join('')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — Inventário LGPD</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 12px; }
  header { border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 16px; }
  .eyebrow { color: #059669; font-weight: 700; font-size: 10px; letter-spacing: .6px; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 4px 0; }
  .meta { color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 7px 9px; border-bottom: 1px solid #e2e8f0; }
  th { width: 32%; color: #334155; background: #f8fafc; font-weight: 600; }
  tr { page-break-inside: avoid; }
  footer { margin-top: 18px; color: #94a3b8; font-size: 10px; }
  @page { margin: 16mm; }
</style>
</head>
<body>
  <header>
    <div class="eyebrow">Inventário LGPD — Guia 3 SGD/MGI</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  </header>
  <table>${rows}</table>
  <footer>Documento gerado pelo sistema de Inventário LGPD. O diagnóstico de risco é uma triagem automática e não substitui o parecer do Encarregado.</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 150) })</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
