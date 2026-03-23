-- PDF штрихкода (путь вида /barcodes/SKU.pdf, файлы в public/barcodes)

alter table public.products
  add column if not exists barcode_pdf_url text;
