-- Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  inputer_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update lops table to include inputer_name
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lops' AND column_name='inputer_name') THEN
    ALTER TABLE lops ADD COLUMN inputer_name TEXT;
  END IF;
END $$;
