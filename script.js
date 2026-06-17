const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const $ = (id) => document.getElementById(id);

let items = [
  { name: 'Nasgor Sosis', qty: 1, price: 17000, people: ['Azka'] },
  { name: 'Bakmie Ayam + Balungan', qty: 2, price: 23500, people: ['Azka', 'Teman'] },
  { name: 'Nasgor Ayam', qty: 1, price: 20000, people: ['Teman'] },
  { name: 'Kwetiau', qty: 1, price: 23000, people: ['Azka'] }
];

let people = ['Azka', 'Teman'];
let latestResults = [];

function numberOnly(value) {
  return Number(value || 0);
}

function money(value) {
  return rupiah.format(Math.round(value || 0));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function renderItems() {
  const body = $('itemsBody');
  body.innerHTML = '';

  items.forEach((item, index) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <input value="${escapeHtml(item.name)}" data-field="name" data-index="${index}" />
      </td>
      <td>
        <input type="number" min="1" value="${item.qty}" data-field="qty" data-index="${index}" />
      </td>
      <td>
        <input type="number" min="0" value="${item.price}" data-field="price" data-index="${index}" />
      </td>
      <td>
        <select multiple data-field="people" data-index="${index}">
          ${people.map((p) => `
            <option value="${escapeHtml(p)}" ${item.people?.includes(p) ? 'selected' : ''}>
              ${escapeHtml(p)}
            </option>
          `).join('')}
        </select>
      </td>
      <td>
        <button class="remove-item" data-remove="${index}" type="button">×</button>
      </td>
    `;

    body.appendChild(tr);
  });

  updateSubtotal();
}

function renderPeople() {
  const list = $('peopleList');
  list.innerHTML = '';

  people.forEach((person, index) => {
    const row = document.createElement('div');
    row.className = 'person-row';

    row.innerHTML = `
      <input value="${escapeHtml(person)}" data-person-index="${index}" />
      <button class="remove-item" data-remove-person="${index}" type="button">×</button>
    `;

    list.appendChild(row);
  });
}

function updateSubtotal() {
  const subtotal = items.reduce((sum, item) => {
    return sum + numberOnly(item.qty) * numberOnly(item.price);
  }, 0);

  $('subtotal').value = subtotal;
  $('sumSubtotal').textContent = money(subtotal);

  return subtotal;
}

function suggestedFinalTotal() {
  const subtotal = updateSubtotal();

  return Math.max(
    0,
    subtotal
      - numberOnly($('discount').value)
      + numberOnly($('tax').value)
      + numberOnly($('service').value)
      + numberOnly($('otherFee').value)
      - numberOnly($('voucher').value)
      - numberOnly($('cashback').value)
  );
}

function calculate() {
  const subtotal = updateSubtotal();
  const finalTotal = Math.round(numberOnly($('finalTotal').value) || suggestedFinalTotal());

  if (subtotal <= 0) {
    showToast('Subtotal masih kosong. Tambahkan item dulu.');
    return;
  }

  if (finalTotal < 0) {
    showToast('Total akhir tidak valid.');
    return;
  }

  const factor = finalTotal / subtotal;

  let rows = items.map((item, index) => {
    const qty = Math.max(1, numberOnly(item.qty));
    const initialTotal = qty * numberOnly(item.price);
    const rawAdjusted = initialTotal * factor;
    const adjustedTotal = Math.ceil(rawAdjusted);

    return {
      index,
      name: item.name || `Item ${index + 1}`,
      qty,
      initialTotal,
      rawAdjusted,
      adjustedTotal,
      perItem: Math.ceil(adjustedTotal / qty),
      difference: adjustedTotal - initialTotal,
      people: item.people || []
    };
  });

  let roundedTotal = rows.reduce((sum, row) => sum + row.adjustedTotal, 0);
  let correction = roundedTotal - finalTotal;

  if (correction > 0) {
    rows.sort((a, b) => {
      return (b.adjustedTotal - b.rawAdjusted) - (a.adjustedTotal - a.rawAdjusted);
    });

    for (const row of rows) {
      if (correction <= 0) break;

      const cut = Math.min(correction, Math.max(0, row.adjustedTotal));
      row.adjustedTotal -= cut;
      correction -= cut;
    }
  } else if (correction < 0) {
    rows[rows.length - 1].adjustedTotal += Math.abs(correction);
  }

  rows.sort((a, b) => a.index - b.index).forEach((row) => {
    row.perItem = Math.ceil(row.adjustedTotal / row.qty);
    row.difference = row.adjustedTotal - row.initialTotal;
  });

  latestResults = rows;

  renderResults(rows, subtotal, finalTotal, factor);
  renderSplit(rows);
  showToast('Perhitungan selesai.');
}

function renderResults(rows, subtotal, finalTotal, factor) {
  $('resultsBody').innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.qty}</td>
      <td>${money(row.initialTotal)}</td>
      <td>${money(row.adjustedTotal)}</td>
      <td>${money(row.perItem)}</td>
      <td>${money(row.difference)}</td>
    </tr>
  `).join('');

  const totalCheck = rows.reduce((sum, row) => sum + row.adjustedTotal, 0);

  $('sumFinal').textContent = money(finalTotal);
  $('sumFactor').textContent = factor.toFixed(5);
  $('sumStatus').textContent = totalCheck === finalTotal
    ? 'Total cocok'
    : `Selisih ${money(totalCheck - finalTotal)}`;
}

function renderSplit(rows) {
  const split = {};

  people.forEach((p) => {
    split[p] = { total: 0, details: [] };
  });

  rows.forEach((row) => {
    const chosen = row.people?.length ? row.people : ['Tanpa Nama'];

    chosen.forEach((p) => {
      if (!split[p]) split[p] = { total: 0, details: [] };
    });

    const share = Math.ceil(row.adjustedTotal / chosen.length);
    let distributed = 0;

    chosen.forEach((person, i) => {
      const amount = i === chosen.length - 1
        ? row.adjustedTotal - distributed
        : share;

      distributed += amount;
      split[person].total += amount;
      split[person].details.push(`${row.name}: ${money(amount)}`);
    });
  });

  $('splitResults').innerHTML = Object.entries(split).map(([person, data]) => `
    <div class="split-card">
      <h3>${escapeHtml(person)}</h3>
      <strong>${money(data.total)}</strong>
      <ul>
        ${data.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('') || '<li>Belum ada item</li>'}
      </ul>
    </div>
  `).join('');
}

function addItem(item = { name: '', qty: 1, price: 0, people: [] }) {
  items.push(item);
  renderItems();
}

function resetAll() {
  items = [];
  people = ['Azka', 'Teman'];

  ['discount', 'tax', 'service', 'otherFee', 'voucher', 'cashback', 'finalTotal'].forEach((id) => {
    $(id).value = 0;
  });

  latestResults = [];
  renderPeople();
  renderItems();
  calculateSafeClear();

  $('ocrText').value = '';
  $('ocrStatus').textContent = 'Belum ada foto diupload.';
  $('receiptPreview').hidden = true;
}

function calculateSafeClear() {
  $('resultsBody').innerHTML = '';
  $('splitResults').innerHTML = '';
  $('sumFinal').textContent = 'Rp0';
  $('sumFactor').textContent = '0';
  $('sumStatus').textContent = 'Belum dihitung';
  updateSubtotal();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Berhasil disalin.');
  });
}

function resultText(splitOnly = false) {
  if (!latestResults.length) calculate();

  if (splitOnly) {
    return Array.from(document.querySelectorAll('.split-card'))
      .map((card) => card.innerText)
      .join('\n\n');
  }

  return latestResults.map((r) => {
    return `${r.name} | Qty ${r.qty} | Awal ${money(r.initialTotal)} | Final ${money(r.adjustedTotal)} | Per Item ${money(r.perItem)} | Selisih ${money(r.difference)}`;
  }).join('\n');
}

function exportExcel() {
  if (!latestResults.length) calculate();

  const data = latestResults.map((r) => ({
    'Nama Item': r.name,
    Qty: r.qty,
    'Harga Awal': r.initialTotal,
    'Harga Setelah Penyesuaian': r.adjustedTotal,
    'Harga Per Item': r.perItem,
    Selisih: r.difference
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, 'Hasil');
  XLSX.writeFile(wb, 'hasil-harga-final.xlsx');
}

function exportPDF() {
  if (!latestResults.length) calculate();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text('Hasil Harga Final Per Item', 14, 16);
  doc.autoTable({
    startY: 24,
    head: [['Nama Item', 'Qty', 'Harga Awal', 'Final', 'Per Item', 'Selisih']],
    body: latestResults.map((r) => [
      r.name,
      r.qty,
      money(r.initialTotal),
      money(r.adjustedTotal),
      money(r.perItem),
      money(r.difference)
    ])
  });

  doc.save('hasil-harga-final.pdf');
}

async function runOcr(file) {
  if (!file) return;

  const preview = $('receiptPreview');
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;

  $('ocrStatus').textContent = 'OCR sedang membaca struk...';

  try {
    const result = await Tesseract.recognize(file, 'ind+eng', {
      logger: (m) => {
        if (m.status) {
          $('ocrStatus').textContent = `${m.status} ${Math.round((m.progress || 0) * 100)}%`;
        }
      }
    });

    $('ocrText').value = result.data.text;
    $('ocrStatus').textContent = 'OCR selesai. Silakan cek/edit hasilnya.';
  } catch (err) {
    $('ocrStatus').textContent = 'OCR gagal. Coba foto lebih jelas.';
    console.error(err);
  }
}

function parseOcrText() {
  const text = $('ocrText').value;

  if (!text.trim()) {
    showToast('Teks OCR masih kosong.');
    return;
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const foundItems = [];

  let finalTotal = null;
  let tax = null;
  let service = null;
  let discount = null;

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    const nums = line.match(/\d+[\d.,]*/g)
      ?.map((n) => Number(n.replace(/[^\d]/g, '')))
      .filter((n) => n > 0) || [];

    const amount = nums[nums.length - 1];

    if (!amount) return;

    if (/total|grand|bayar|payment/.test(lower)) {
      finalTotal = amount;
    } else if (/pajak|tax|ppn/.test(lower)) {
      tax = amount;
    } else if (/service|layanan/.test(lower)) {
      service = amount;
    } else if (/diskon|disc|voucher|promo/.test(lower)) {
      discount = amount;
    } else if (amount >= 1000 && !/subtotal|cashback|kembali|tunai/.test(lower)) {
      const qtyMatch = line.match(/(?:x|qty|jumlah)\s*(\d+)|(\d+)\s*x/i);
      const qty = qtyMatch ? Number(qtyMatch[1] || qtyMatch[2]) : 1;

      const name = line
        .replace(/[\d.,xX@]+/g, ' ')
        .replace(/rp|idr/ig, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Item OCR';

      foundItems.push({
        name,
        qty,
        price: Math.round(amount / qty),
        people: []
      });
    }
  });

  if (foundItems.length) items = foundItems;
  if (finalTotal) $('finalTotal').value = finalTotal;
  if (tax) $('tax').value = tax;
  if (service) $('service').value = service;
  if (discount) $('discount').value = discount;

  renderItems();

  showToast(
    foundItems.length
      ? 'Data OCR berhasil dimasukkan.'
      : 'Item tidak terdeteksi otomatis. Edit manual dari teks OCR.'
  );
}

function bindEvents() {
  $('itemsBody').addEventListener('input', (e) => {
    const index = Number(e.target.dataset.index);
    const field = e.target.dataset.field;

    if (Number.isNaN(index) || !field) return;

    if (field === 'people') {
      items[index][field] = Array.from(e.target.selectedOptions).map((o) => o.value);
    } else {
      items[index][field] = field === 'name'
        ? e.target.value
        : numberOnly(e.target.value);
    }

    updateSubtotal();
  });

  $('itemsBody').addEventListener('click', (e) => {
    if (e.target.dataset.remove !== undefined) {
      items.splice(Number(e.target.dataset.remove), 1);
      renderItems();
    }
  });

  $('peopleList').addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.personIndex);

    if (!Number.isNaN(idx)) {
      people[idx] = e.target.value || `Orang ${idx + 1}`;
      renderItems();
    }
  });

  $('peopleList').addEventListener('click', (e) => {
    if (e.target.dataset.removePerson !== undefined) {
      people.splice(Number(e.target.dataset.removePerson), 1);
      renderPeople();
      renderItems();
    }
  });

  ['discount', 'tax', 'service', 'otherFee', 'voucher', 'cashback'].forEach((id) => {
    $(id).addEventListener('input', () => {
      $('finalTotal').placeholder = suggestedFinalTotal();
    });
  });

  $('addItemBtn').onclick = () => addItem();

  $('addPersonBtn').onclick = () => {
    people.push(`Orang ${people.length + 1}`);
    renderPeople();
    renderItems();
  };

  $('calculateBtn').onclick = calculate;
  $('resetBtn').onclick = resetAll;
  $('copyBtn').onclick = () => copyText(resultText(false));
  $('copySplitBtn').onclick = () => copyText(resultText(true));
  $('excelBtn').onclick = exportExcel;
  $('pdfBtn').onclick = exportPDF;
  $('printBtn').onclick = () => window.print();
  $('parseOcrBtn').onclick = parseOcrText;
  $('receiptInput').onchange = (e) => runOcr(e.target.files[0]);

  $('themeToggle').onclick = () => {
    document.body.classList.toggle('dark');
    $('themeToggle').textContent = document.body.classList.contains('dark')
      ? '☀️ Light'
      : '🌙 Dark';
  };
}

bindEvents();
renderPeople();
renderItems();
calculate();
