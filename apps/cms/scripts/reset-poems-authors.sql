-- Drops every poem and author record and table; the next CMS start recreates them
-- empty from the current schema. Cities, media, users and other content stay.
BEGIN;

DO $$
DECLARE
  target record;
BEGIN
  -- Homepage selections and edit locks must not point at dropped records.
  FOR target IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name NOT SIMILAR TO '\_?(poems|authors)(\_%)?'
      AND (column_name IN ('poems_id', 'authors_id') OR column_name LIKE '%feature\_poem\_id')
  LOOP
    IF target.table_name LIKE '%\_rels' THEN
      EXECUTE format('DELETE FROM %I WHERE %I IS NOT NULL', target.table_name, target.column_name);
    ELSE
      EXECUTE format('UPDATE %I SET %I = NULL', target.table_name, target.column_name);
    END IF;
  END LOOP;

  FOR target IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename SIMILAR TO '\_?(poems|authors)(\_%)?'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', target.tablename);
  END LOOP;

  FOR target IN
    SELECT typname FROM pg_type
    WHERE typnamespace = current_schema()::regnamespace AND typtype = 'e'
      AND typname SIMILAR TO 'enum\_\_?(poems|authors)\_%'
  LOOP
    EXECUTE format('DROP TYPE %I', target.typname);
  END LOOP;
END $$;

COMMIT;
