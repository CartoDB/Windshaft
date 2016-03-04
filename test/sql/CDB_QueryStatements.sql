-- DUMMY IMPLEMENTATION
-- Ref: https://github.com/CartoDB/cartodb-postgresql/blob/master/scripts-available/CDB_QueryStatements.sql
-- Originally implemented in plpython for performance reasons

-- Return an array of statements found in the given query text
--
-- Regexp curtesy of Hubert Lubaczewski (depesz)
--
CREATE OR REPLACE FUNCTION CDB_QueryStatements(query text)
RETURNS SETOF TEXT AS $$
  with matches as (
    select regexp_matches($1, $regexp$((?:[^'"$;]+|"[^"]*"|'[^']*'|(\$[^$]*\$).*?\2)+)$regexp$, 'g') as m
  )
  select btrim(m[1]) from matches
$$
LANGUAGE SQL IMMUTABLE STRICT;
