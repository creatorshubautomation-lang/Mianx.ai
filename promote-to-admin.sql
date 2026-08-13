-- ============================================================
-- Mianx.ai — Promote User to ADMIN
-- ============================================================
-- Run this in Supabase SQL Editor if your first signup didn't
-- become ADMIN automatically (e.g., due to DB connection issues
-- during earlier attempts).
--
-- HOW TO USE:
--   1. Open Supabase SQL Editor
--      (https://supabase.com/dashboard/project/YOUR_REF/sql/new)
--   2. Paste this entire file
--   3. Edit the email below to match YOUR email
--   4. Click "Run" (Ctrl+Enter)
-- ============================================================

-- Step 1: See all current users and their roles
SELECT email, name, role, "createdAt"
FROM "User"
ORDER BY "createdAt" ASC;

-- Step 2: Promote YOUR account to ADMIN
-- 👇 REPLACE THIS EMAIL WITH YOUR ACTUAL EMAIL 👇
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'creatorshubautomation@gmail.com';

-- Step 3: Verify the change
SELECT email, name, role
FROM "User"
WHERE email = 'creatorshubautomation@gmail.com';

-- ✅ After running this:
--   - Refresh your browser (logout + login again for safety)
--   - Visit https://mianx-ai.vercel.app
--   - Click your avatar (top right) → "Admin Panel" should now work
--
-- 📌 Note: The Admin Panel menu item is only visible to ADMIN users.
--          Other signed-up users will NOT see it.
-- ============================================================
