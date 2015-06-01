cd C:\Program Files\PostgreSQL\9.4\bin
dropdb -U postgres windshaft_test
createdb -U postgres -Ttemplate_postgis -EUTF8 windshaft_test
psql -U postgres windshaft_test < %~dp0/fixtures/windshaft.test.sql
pause