--
-- Windshaft test database
--
-- To use:
--
-- > dropdb windshaft_test
-- > createdb -EUTF8 windshaft_test
-- > psql -c 'create extension postgis' windshaft_test
-- > psql windshaft_test < windshaft.test.sql
--
--

--SET statement_timeout = 0;
--SET client_encoding = 'UTF8';
--SET standard_conforming_strings = off;
--SET check_function_bodies = false;
--SET client_min_messages = warning;
--SET escape_string_warning = off;
--SET search_path = public, pg_catalog;
--SET default_tablespace = '';
--SET default_with_oids = false;

-- public user role
DROP USER IF EXISTS test_ws_publicuser;
CREATE USER test_ws_publicuser WITH PASSWORD 'public';


-- first table
CREATE TABLE test_table (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL PRIMARY KEY,
    name character varying,
    address character varying,
    the_geom geometry,
    the_geom_webmercator geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

INSERT INTO test_table (updated_at, created_at, name, address, the_geom)
VALUES
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440');
UPDATE test_table SET the_geom_webmercator = ST_Transform(the_geom, 3857);

CREATE INDEX test_table_the_geom_idx ON test_table USING gist (the_geom);
CREATE INDEX test_table_the_geom_webmercator_idx ON test_table USING gist (the_geom_webmercator);

CREATE FUNCTION test_table_inserter(geometry, text) returns int AS $$
 INSERT INTO test_table(name, the_geom, the_geom_webmercator)
  SELECT $2, $1, ST_Transform($1, 3857) RETURNING cartodb_id;
$$ LANGUAGE 'sql' SECURITY DEFINER;

-- second table
CREATE TABLE test_table_2 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL PRIMARY KEY,
    name character varying,
    address character varying,
    the_geom geometry,
    the_geom_webmercator geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

INSERT INTO test_table_2 (updated_at, created_at, name, address, the_geom, the_geom_webmercator)
VALUES
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

CREATE INDEX test_table_2_the_geom_idx ON test_table_2 USING gist (the_geom);
CREATE INDEX test_table_2_the_geom_webmercator_idx ON test_table_2 USING gist (the_geom_webmercator);

--GRANT ALL ON TABLE test_table_2 TO postgres;

-- third table
CREATE TABLE test_table_3 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL PRIMARY KEY,
    name character varying,
    address character varying,
    the_geom geometry,
    the_geom_webmercator geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

INSERT INTO test_table_3 (updated_at, created_at, name, address, the_geom, the_geom_webmercator)
VALUES
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

CREATE INDEX test_table_3_the_geom_idx ON test_table_3 USING gist (the_geom);
CREATE INDEX test_table_3_the_geom_webmercator_idx ON test_table_3 USING gist (the_geom_webmercator);

CREATE TABLE test_big_poly (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL,
    name character varying,
    the_geom geometry(polygon) CHECK ( ST_Srid(the_geom) = 4326 ),
    the_geom_webmercator geometry(polygon) CHECK ( ST_Srid(the_geom_webmercator) = 3857 )
);
INSERT INTO test_big_poly (name, the_geom) VALUES ('west', 'SRID=4326;POLYGON((-180 -80, -180 80, 0 80, 0 -80, -180 -80))');
UPDATE test_big_poly SET the_geom_webmercator = ST_Transform(the_geom, 3857);
CREATE INDEX test_big_poly_the_geom_idx ON test_big_poly USING gist (the_geom);
CREATE INDEX test_big_poly_the_geom_webmercator_idx ON test_big_poly USING gist (the_geom_webmercator);


--GRANT ALL ON TABLE test_table_3 TO postgres;

CREATE TABLE _vovw_12_test_table (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL PRIMARY KEY,
    name character varying,
    address character varying,
    the_geom geometry,
    the_geom_webmercator geometry,
    CONSTRAINT enforce_dims_the_geom CHECK ((st_ndims(the_geom) = 2)),
    CONSTRAINT enforce_dims_the_geom_webmercator CHECK ((st_ndims(the_geom_webmercator) = 2)),
    CONSTRAINT enforce_geotype_the_geom CHECK (((geometrytype(the_geom) = 'POINT'::text) OR (the_geom IS NULL))),
    CONSTRAINT enforce_geotype_the_geom_webmercator CHECK (((geometrytype(the_geom_webmercator) = 'POINT'::text) OR (the_geom_webmercator IS NULL))),
    CONSTRAINT enforce_srid_the_geom CHECK ((st_srid(the_geom) = 4326)),
    CONSTRAINT enforce_srid_the_geom_webmercator CHECK ((st_srid(the_geom_webmercator) = 3857))
);

INSERT INTO _vovw_12_test_table (updated_at, created_at, name, address, the_geom)
VALUES
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440'),
 ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440');
UPDATE _vovw_12_test_table SET the_geom_webmercator = ST_Transform(the_geom, 3857);

CREATE INDEX _vovw_12_test_table_the_geom_idx ON _vovw_12_test_table USING gist (the_geom);
CREATE INDEX _vovw_12_test_table_the_geom_webmercator_idx ON _vovw_12_test_table USING gist (the_geom_webmercator);
