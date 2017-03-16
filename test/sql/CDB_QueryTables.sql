-- Return an array of table names scanned by a given query
--
-- Requires PostgreSQL 9.x+
--
CREATE OR REPLACE FUNCTION CDB_QueryTablesText(query text)
RETURNS text[]
AS $$
DECLARE
  exp XML;
  tables text[];
  rec RECORD;
  rec2 RECORD;
BEGIN
  
  tables := '{}';

  FOR rec IN SELECT CDB_QueryStatements(query) q LOOP

    IF NOT ( rec.q ilike 'select%' or rec.q ilike 'with%' ) THEN
        --RAISE WARNING 'Skipping %', rec.q;
        CONTINUE;
    END IF;

    BEGIN
      EXECUTE 'EXPLAIN (FORMAT XML, VERBOSE) ' || rec.q INTO STRICT exp;
    EXCEPTION WHEN others THEN
      -- TODO: if error is 'relation "xxxxxx" does not exist', take xxxxxx as
      --       the affected table ?
      RAISE WARNING 'CDB_QueryTables cannot explain query: % (%: %)', rec.q, SQLSTATE, SQLERRM;
      RAISE EXCEPTION '%', SQLERRM;
      CONTINUE;
    END;

    -- Now need to extract all values of <Relation-Name>

    -- RAISE DEBUG 'Explain: %', exp;

    FOR rec2 IN WITH
      inp AS (
        SELECT
          xpath('//x:Relation-Name/text()', exp, ARRAY[ARRAY['x', 'http://www.postgresql.org/2009/explain']]) as x,
          xpath('//x:Relation-Name/../x:Schema/text()', exp, ARRAY[ARRAY['x', 'http://www.postgresql.org/2009/explain']]) as s
      )
      SELECT unnest(x)::text as p, unnest(s)::text as sc from inp
    LOOP
      -- RAISE DEBUG 'tab: %', rec2.p;
      -- RAISE DEBUG 'sc: %', rec2.sc;
      tables := array_append(tables, format('%s.%s', quote_ident(rec2.sc), quote_ident(rec2.p)));
    END LOOP;

    -- RAISE DEBUG 'Tables: %', tables;

  END LOOP;

  -- RAISE DEBUG 'Tables: %', tables;

  -- Remove duplicates and sort by name
  IF array_upper(tables, 1) > 0 THEN
    WITH dist as ( SELECT DISTINCT unnest(tables)::text as p ORDER BY p )
       SELECT array_agg(p) from dist into tables;
  END IF;

  --RAISE DEBUG 'Tables: %', tables;

  return tables;
END
$$ LANGUAGE 'plpgsql' VOLATILE STRICT;


-- Keep CDB_QueryTables with same signature for backwards compatibility.
-- It should probably be removed in the future.
CREATE OR REPLACE FUNCTION CDB_QueryTables(query text)
RETURNS name[]
AS $$
BEGIN
  RETURN CDB_QueryTablesText(query)::name[];
END
$$ LANGUAGE 'plpgsql' VOLATILE STRICT;
