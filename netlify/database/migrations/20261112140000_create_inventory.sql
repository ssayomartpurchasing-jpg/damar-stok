CREATE TABLE damar_items (
 kode text PRIMARY KEY CHECK (length(trim(kode)) BETWEEN 1 AND 200),
 nama text NOT NULL, satuan text NOT NULL,
 stok numeric(18,3) NOT NULL CHECK (stok >= 0)
);
CREATE UNIQUE INDEX damar_items_code ON damar_items (lower(kode));
CREATE TABLE damar_batches (
 fingerprint text PRIMARY KEY, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE damar_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kode text NOT NULL REFERENCES damar_items(kode), nama text NOT NULL,
 satuan text NOT NULL, tanggal date NOT NULL,
 jenis text NOT NULL CHECK (jenis IN ('masuk','keluar')),
 jumlah numeric(18,3) NOT NULL CHECK (jumlah > 0),
 keterangan text NOT NULL DEFAULT '', actor text NOT NULL,
 batch text NOT NULL REFERENCES damar_batches(fingerprint)
);
CREATE INDEX damar_history_date ON damar_history(tanggal);
