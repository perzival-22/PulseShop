-- Add text comments and reviewer names to the existing reviews table
ALTER TABLE reviews 
ADD COLUMN comment TEXT,
ADD COLUMN reviewer_name TEXT;

-- (Optional but recommended) Update the refresh_product_rating function 
-- to ensure it still works perfectly, though it shouldn't be affected by new columns.