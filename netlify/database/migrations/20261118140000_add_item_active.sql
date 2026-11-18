ALTER TABLE damar_items ADD COLUMN aktif boolean NOT NULL DEFAULT true;
ALTER TABLE damar_items ADD CONSTRAINT damar_inactive_zero_stock CHECK (aktif OR stok = 0);
