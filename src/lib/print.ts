/**
 * Creates a full HTML document, writes it to a blob URL,
 * opens it in a new tab and triggers print.
 * No popup permission needed — uses blob: URLs instead of window.open().
 */
export function printHtml(html: string, title = 'Ovano Energies') {
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
    .meta { font-size: 11px; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .right { text-align: right; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .card .label { font-size: 11px; color: #64748b; }
    .card .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .green { color: #16a34a; } .red { color: #dc2626; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
    .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 32px; }
    .no-print { display: flex; gap: 10px; margin-bottom: 24px; }
    .btn { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-primary { background: #6366f1; color: #fff; }
    .btn-secondary { background: #f1f5f9; color: #1e293b; border: 1px solid #e2e8f0; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      @page { margin: 18mm; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn btn-primary" onclick="window.print()">Print</button>
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
  </div>
  ${html}
</body>
</html>`;

  const blob = new Blob([doc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');

  // Revoke the object URL after the tab has loaded
  if (tab) {
    tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  } else {
    // Fallback: if new tab is blocked, trigger direct download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
