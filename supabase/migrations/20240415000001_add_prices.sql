-- Create designator_prices table
CREATE TABLE IF NOT EXISTS designator_prices (
  designator TEXT PRIMARY KEY,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE designator_prices ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users" ON designator_prices
  FOR SELECT USING (true);

-- Allow all access to admin users (role = 'admin' in app_users)
-- Note: This assumes app_users table exists and has role column
CREATE POLICY "Allow all access to admins" ON designator_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.username = auth.jwt()->>'username' 
      AND app_users.role = 'admin'
    )
  );
