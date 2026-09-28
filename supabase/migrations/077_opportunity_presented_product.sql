-- Optional sales presentation detail; independent of production products.
ALTER TABLE public.opportunities
  ADD COLUMN presented_product text,
  ADD CONSTRAINT opportunities_presented_product_check CHECK (
    presented_product IS NULL OR (
      presented_product = btrim(presented_product)
      AND char_length(presented_product) BETWEEN 1 AND 200
    )
  );
COMMENT ON COLUMN public.opportunities.presented_product IS
  'Product currently being presented. Optional advisor-entered sales description; does not imply sale, issuance, or compensation.';
