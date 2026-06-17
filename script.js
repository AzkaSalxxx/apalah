const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const itemBody = document.getElementById("itemBody");
const finalTotalInput = document.getElementById("finalTotal");
const resultBox = document.getElementById("resultBox");
const statusText = document.getElementById("status");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
});

function formatRupiah(num) {
  return "Rp" + Number(num || 0).toLocaleString("id-ID");
}

function addRow(name = "", qty = 1, price = 0) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input value="${name}" placeholder="Nama item"></td>
    <td><input type="number" value="${qty}" min="1"></td>
    <td><input type="number" value="${price}" min="0"></td>
    <td class="adjusted">-</td>
    <td class="perItem">-</td>
    <td><button class="danger" onclick="this.closest('tr').remove()">Hapus</button></td>
  `;

  itemBody.appendChild(tr);
}

function getItems() {
  const rows = [...itemBody.querySelectorAll("tr")];

  return rows.map(row => {
    const inputs = row.querySelectorAll("input");

    return {
      row,
      name: inputs[0].value.trim() || "Tanpa Nama",
      qty: Number(inputs[1].value) || 1,
      price: Number(inputs[2].value) || 0,
      total: (Number(inputs[1].value) || 1) * (Number(inputs[2].value) || 0)
    };
  });
}

function calculate() {
  const items = getItems();
  const finalTotal = Number(finalTotalInput.value);

  if (!items.length) {
    alert("Tambahkan item dulu.");
    return;
  }

  if (!finalTotal || finalTotal <= 0) {
    alert("Masukkan total akhir.");
    return;
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  if (subtotal <= 0) {
    alert("Subtotal tidak valid.");
    return;
  }

  let resultText = "";
  resultText += `Subtotal Awal: ${formatRupiah(subtotal)}\n`;
  resultText += `Total Akhir: ${formatRupiah(finalTotal)}\n`;
  resultText += `Selisih: ${formatRupiah(finalTotal - subtotal)}\n\n`;

  items.forEach(item => {
    const ratio = item.total / subtotal;
    const adjustedTotal = Math.ceil(finalTotal * ratio);
    const perItem = Math.ceil(adjustedTotal / item.qty);

    item.row.querySelector(".adjusted").textContent = formatRupiah(adjustedTotal);
    item.row.querySelector(".perItem").textContent = formatRupiah(perItem);

    resultText += `${item.name}\n`;
    resultText += `Jumlah: ${item.qty}\n`;
    resultText += `Harga awal: ${formatRupiah(item.price)}\n`;
    resultText += `Setelah total: ${formatRupiah(adjustedTotal)}\n`;
    resultText += `Per item: ${formatRupiah(perItem)}\n\n`;
  });

  resultBox.textContent = resultText;
}

async function readImage() {
  const file = imageInput.files[0];

  if (!file) {
    alert("Upload foto dulu.");
    return;
  }

  statusText.textContent = "Sedang membaca foto...";

  try {
    const result = await Tesseract.recognize(file, "ind+eng", {
      logger: m => {
        if (m.status === "recognizing text") {
          statusText.textContent = `Membaca foto... ${Math.round(m.progress * 100)}%`;
        }
      }
    });

    const text = result.data.text;
    parseOCRText(text);
    statusText.textContent = "OCR selesai. Cek dan edit data jika perlu.";
  } catch (error) {
    console.error(error);
    statusText.textContent = "OCR gagal. Gunakan contoh data atau input manual.";
  }
}

function parseOCRText(text) {
  itemBody.innerHTML = "";

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  let foundTotal = false;

  lines.forEach(line => {
    const clean = line.replace(/[,.]/g, "");
    const numbers = clean.match(/\d{4,}/g);

    if (!numbers) return;

    const lastNumber = Number(numbers[numbers.length - 1]);

    if (/total|jumlah|grand/i.test(line)) {
      finalTotalInput.value = lastNumber;
      foundTotal = true;
      return;
    }

    const name = line
      .replace(/[0-9.,]/g, "")
      .replace(/rp/gi, "")
      .trim();

    if (name.length >= 2 && lastNumber > 0) {
      addRow(name, 1, lastNumber);
    }
  });

  if (!itemBody.children.length) {
    loadSample();
    statusText.textContent = "OCR kurang jelas. Contoh data dimuat.";
  }

  if (!foundTotal && !finalTotalInput.value) {
    finalTotalInput.value = "";
  }
}

function loadSample() {
  itemBody.innerHTML = "";

  addRow("Milky Fruity", 1, 11000);
  addRow("Jasmine Tea", 1, 10000);
  addRow("Mie", 2, 12000);

  finalTotalInput.value = 44000;
  resultBox.textContent = "Contoh data sudah dimuat. Klik Hitung.";
}

function copyResult() {
  navigator.clipboard.writeText(resultBox.textContent);
  alert("Hasil disalin.");
}

function resetAll() {
  imageInput.value = "";
  preview.src = "";
  preview.style.display = "none";
  itemBody.innerHTML = "";
  finalTotalInput.value = "";
  resultBox.textContent = "Belum ada hasil.";
  statusText.textContent = "";
}
