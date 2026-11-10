-- One weight per option per dimension.
--
-- Scoring sums every option_scores row for a dimension, so a duplicated pair
-- is added to itself. Nothing currently creates one - the importer replaces a
-- scenario's scores rather than appending - but there was no constraint
-- stopping it either, and a wrong score is the kind of fault nobody notices.

-- Refuse rather than let the index fail on its own, which reports a row id
-- and leaves the operator to work out what it means.
DO $$
DECLARE dupes bigint;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT option_id, dimension_id FROM option_scores
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot add the unique index: % option/dimension pair(s) are duplicated. Those options are being scored more than once on the same dimension - deduplicate them first.', dupes;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "option_scores_option_id_dimension_id_key" ON "option_scores"("option_id", "dimension_id");
