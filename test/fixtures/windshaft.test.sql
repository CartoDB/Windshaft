--
-- Windshaft test database
-- 
-- To use:
-- 
-- > dropdb -Upostgres -hlocalhost windshaft_test
-- > createdb -Upostgres -hlocalhost -Ttemplate_postgis -Opostgres -EUTF8 windshaft_test
-- > psql -Upostgres -hlocalhost windshaft_test < windshaft.test.sql
--
-- NOTE: requires a postgis template called template_postgis
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET search_path = public, pg_catalog;
SET default_tablespace = '';
SET default_with_oids = false;


-- first table
CREATE TABLE test_table (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
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

CREATE SEQUENCE test_table_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE test_table_cartodb_id_seq OWNED BY test_table.cartodb_id;

SELECT pg_catalog.setval('test_table_cartodb_id_seq', 60, true);

ALTER TABLE test_table ALTER COLUMN cartodb_id SET DEFAULT nextval('test_table_cartodb_id_seq'::regclass);

INSERT INTO test_table VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440');
INSERT INTO test_table VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440');
INSERT INTO test_table VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440');
INSERT INTO test_table VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440');
INSERT INTO test_table VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440');
UPDATE test_table SET the_geom_webmercator = ST_Transform(the_geom, 3857);

ALTER TABLE ONLY test_table ADD CONSTRAINT test_table_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX test_table_the_geom_idx ON test_table USING gist (the_geom);
CREATE INDEX test_table_the_geom_webmercator_idx ON test_table USING gist (the_geom_webmercator);

GRANT ALL ON TABLE test_table TO postgres;

-- second table
CREATE TABLE test_table_2 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
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

CREATE SEQUENCE test_table_2_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE test_table_2_cartodb_id_seq OWNED BY test_table_2.cartodb_id;

SELECT pg_catalog.setval('test_table_2_cartodb_id_seq', 60, true);

ALTER TABLE test_table_2 ALTER COLUMN cartodb_id SET DEFAULT nextval('test_table_2_cartodb_id_seq'::regclass);

INSERT INTO test_table_2 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241');
INSERT INTO test_table_2 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241');
INSERT INTO test_table_2 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241');
INSERT INTO test_table_2 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241');
INSERT INTO test_table_2 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

ALTER TABLE ONLY test_table_2 ADD CONSTRAINT test_table_2_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX test_table_2_the_geom_idx ON test_table_2 USING gist (the_geom);
CREATE INDEX test_table_2_the_geom_webmercator_idx ON test_table_2 USING gist (the_geom_webmercator);

GRANT ALL ON TABLE test_table_2 TO postgres;

-- third table
CREATE TABLE test_table_3 (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id integer NOT NULL,
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

CREATE SEQUENCE test_table_3_cartodb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE test_table_3_cartodb_id_seq OWNED BY test_table_3.cartodb_id;

SELECT pg_catalog.setval('test_table_3_cartodb_id_seq', 60, true);

ALTER TABLE test_table_3 ALTER COLUMN cartodb_id SET DEFAULT nextval('test_table_3_cartodb_id_seq'::regclass);

INSERT INTO test_table_3 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.314252', 1, 'Hawai', 'Calle de Pérez Galdós 9, Madrid, Spain', '0101000020E6100000A6B73F170D990DC064E8D84125364440', '0101000020110F000076491621312319C122D4663F1DCC5241');
INSERT INTO test_table_3 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.319101', 2, 'El Estocolmo', 'Calle de la Palma 72, Madrid, Spain', '0101000020E6100000C90567F0F7AB0DC0AB07CC43A6364440', '0101000020110F0000C4356B29423319C15DD1092DADCC5241');
INSERT INTO test_table_3 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.324', 3, 'El Rey del Tallarín', 'Plaza Conde de Toreno 2, Madrid, Spain', '0101000020E610000021C8410933AD0DC0CB0EF10F5B364440', '0101000020110F000053E71AC64D3419C10F664E4659CC5241');
INSERT INTO test_table_3 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.329509', 4, 'El Lacón', 'Manuel Fernández y González 8, Madrid, Spain', '0101000020E6100000BC5983F755990DC07D923B6C22354440', '0101000020110F00005DACDB056F2319C1EC41A980FCCA5241');
INSERT INTO test_table_3 VALUES ('2011-09-21 14:02:21.358706', '2011-09-21 14:02:21.334931', 5, 'El Pico', 'Calle Divino Pastor 12, Madrid, Spain', '0101000020E61000003B6D8D08C6A10DC0371B2B31CF364440', '0101000020110F00005F716E91992A19C17DAAA4D6DACC5241');

ALTER TABLE ONLY test_table_3 ADD CONSTRAINT test_table_3_pkey PRIMARY KEY (cartodb_id);

CREATE INDEX test_table_3_the_geom_idx ON test_table_3 USING gist (the_geom);
CREATE INDEX test_table_3_the_geom_webmercator_idx ON test_table_3 USING gist (the_geom_webmercator);

CREATE TABLE test_big_poly (
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    cartodb_id serial NOT NULL,
    name character varying,
    the_geom geometry(polygon, 4326),
    the_geom_webmercator geometry(polygon, 3857)
);
INSERT INTO test_big_poly (name, the_geom) VALUES ('west', 'SRID=4326;POLYGON((-180 -80, -180 80, 0 80, 0 -80, -180 -80))');
UPDATE test_big_poly SET the_geom_webmercator = ST_Transform(the_geom, 3857);
CREATE INDEX test_big_poly_the_geom_idx ON test_big_poly USING gist (the_geom);
CREATE INDEX test_big_poly_the_geom_webmercator_idx ON test_big_poly USING gist (the_geom_webmercator);

GRANT ALL ON TABLE test_table_3 TO postgres;
