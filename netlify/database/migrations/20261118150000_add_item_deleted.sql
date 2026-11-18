-- Preserve history foreign keys while removing zero-stock items from the master.
ALTER TABLE damar_items ADD COLUMN dihapus boolean NOT NULL DEFAULT false;
ALTER TABLE damar_items ADD CONSTRAINT damar_deleted_zero_stock
 CHECK (NOT dihapus OR (stok = 0 AND NOT aktif));
