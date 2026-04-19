-- Update lops table to support Warehouse vs BOQ
ALTER TABLE lops 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'warehouse',
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES lops(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lops_type ON lops(type);
CREATE INDEX IF NOT EXISTS idx_lops_parent_id ON lops(parent_id);
