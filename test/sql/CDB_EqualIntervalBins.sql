--
-- Calculate the equal interval bins for a given column
--
-- @param in_array A numeric array of numbers to determine the best
--                   to determine the bin boundary
--
-- @param breaks The number of bins you want to find.
--  
--
-- Returns: upper edges of bins
-- 
--

CREATE OR REPLACE FUNCTION CDB_EqualIntervalBins ( in_array NUMERIC[], breaks INT ) RETURNS NUMERIC[] as $$
DECLARE 
    diff numeric;
    min_val numeric;
    max_val numeric;
    tmp_val numeric;
    i INT := 1;
    reply numeric[];
BEGIN
    SELECT min(e), max(e) INTO min_val, max_val FROM ( SELECT unnest(in_array) e ) x WHERE e IS NOT NULL;
    diff = (max_val - min_val) / breaks::numeric;
    LOOP
        IF i < breaks THEN
            tmp_val = min_val + i::numeric * diff;
            reply = array_append(reply, tmp_val);
            i := i+1;
        ELSE
            reply = array_append(reply, max_val);
            EXIT;
        END IF;
    END LOOP;
    RETURN reply;
END;
$$ language plpgsql IMMUTABLE;
