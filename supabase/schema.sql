-- Consolidated schema snapshot — the source of truth for this project's
-- database structure.
--
-- Pre-release, migrations in supabase/migrations/*.sql are treated as
-- ephemeral: they are replayed to stand up a local stack, but are not a
-- stable history and may be squashed or rewritten. This file is the
-- authoritative description of the final schema. To bootstrap a database,
-- apply this file directly instead of replaying every migration.
--
-- Target must be a Supabase database (or one providing the `auth` schema):
-- the public schema has foreign keys to auth.users and RLS policies that
-- call auth.uid().
--
-- Regenerate after any schema change, from a fresh DB with all migrations
-- applied:
--     supabase db dump --local --schema public -f supabase/schema.sql
-- then re-add this header. Verified to apply cleanly (psql -v ON_ERROR_STOP=1)
-- against a fresh database with the auth baseline present.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_assignee_is_individual"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if not exists (select 1 from owners where id = new.assignee_id and is_individual) then
    raise exception 'assignee_id must reference an individual owner (is_individual = true)';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_assignee_is_individual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."default_owner"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select id from owners where auth_user_id = auth.uid() limit 1;
$$;


ALTER FUNCTION "public"."default_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_own_owner"("check_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from owners where id = check_owner_id and auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_own_owner"("check_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_project_priority"() RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(max(priority), -1) + 1 from projects where owner_id = auth.uid();
$$;


ALTER FUNCTION "public"."next_project_priority"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owner_is_visible"("target_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select is_own_owner(target_owner_id)
    or exists (
      select 1
      from owner_visibility ov
      where ov.visible_owner_id = target_owner_id
        and is_own_owner(ov.viewer_id)
    );
$$;


ALTER FUNCTION "public"."owner_is_visible"("target_owner_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "public"."default_owner"() NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_id" "uuid",
    "recurrence_freq" "text",
    "recurrence_weekday" smallint,
    "room_id" "uuid",
    "assignee_id" "uuid" DEFAULT "public"."default_owner"() NOT NULL,
    "project_id" "uuid",
    CONSTRAINT "reminders_recurrence_freq_check" CHECK (("recurrence_freq" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "reminders_recurrence_weekday_check" CHECK ((("recurrence_weekday" >= 0) AND ("recurrence_weekday" <= 6))),
    CONSTRAINT "reminders_recurrence_weekday_requires_weekly" CHECK ((("recurrence_weekday" IS NULL) OR ("recurrence_freq" = 'weekly'::"text"))),
    CONSTRAINT "reminders_title_check" CHECK (("char_length"("title") > 0))
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_reminder_assignee"("target_reminder_id" "uuid", "new_assignee_id" "uuid") RETURNS "public"."reminders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  result reminders;
begin
  if not exists (
    select 1 from reminders r where r.id = target_reminder_id and owner_is_visible(r.owner_id)
  ) then
    raise exception 'reminder not found or not visible';
  end if;

  if not exists (select 1 from owners where id = new_assignee_id and is_individual) then
    raise exception 'assignee_id must reference an individual owner (is_individual = true)';
  end if;

  update reminders set assignee_id = new_assignee_id where id = target_reminder_id
  returning * into result;

  return result;
end;
$$;


ALTER FUNCTION "public"."reassign_reminder_assignee"("target_reminder_id" "uuid", "new_assignee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_reminder_owner"("target_reminder_id" "uuid", "new_owner_id" "uuid") RETURNS "public"."reminders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  result reminders;
begin
  if not exists (
    select 1 from reminders r where r.id = target_reminder_id and owner_is_visible(r.owner_id)
  ) then
    raise exception 'reminder not found or not visible';
  end if;

  update reminders set owner_id = new_owner_id where id = target_reminder_id
  returning * into result;

  return result;
end;
$$;


ALTER FUNCTION "public"."reassign_reminder_owner"("target_reminder_id" "uuid", "new_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "radius_m" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "locations_name_check" CHECK (("char_length"("name") > 0)),
    CONSTRAINT "locations_radius_m_check" CHECK (("radius_m" > 0))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_visibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "viewer_id" "uuid" NOT NULL,
    "visible_owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_visibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "auth_user_id" "uuid",
    "name" "text" NOT NULL,
    "is_individual" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "owners_check" CHECK ((("auth_user_id" IS NULL) OR "is_individual")),
    CONSTRAINT "owners_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "priority" integer DEFAULT "public"."next_project_priority"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rooms_name_check" CHECK (("char_length"("name") > 0))
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_visibility"
    ADD CONSTRAINT "owner_visibility_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_visibility"
    ADD CONSTRAINT "owner_visibility_viewer_id_visible_owner_id_key" UNIQUE ("viewer_id", "visible_owner_id");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_creator_id_name_key" UNIQUE ("creator_id", "name");



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_name_key" UNIQUE ("owner_id", "name");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



CREATE INDEX "locations_owner_id_idx" ON "public"."locations" USING "btree" ("owner_id");



CREATE INDEX "projects_owner_id_idx" ON "public"."projects" USING "btree" ("owner_id");



CREATE INDEX "projects_priority_idx" ON "public"."projects" USING "btree" ("priority");



CREATE INDEX "reminders_assignee_id_idx" ON "public"."reminders" USING "btree" ("assignee_id");



CREATE INDEX "reminders_due_at_idx" ON "public"."reminders" USING "btree" ("due_at") WHERE ("completed_at" IS NULL);



CREATE INDEX "reminders_location_id_idx" ON "public"."reminders" USING "btree" ("location_id");



CREATE INDEX "reminders_owner_id_idx" ON "public"."reminders" USING "btree" ("owner_id");



CREATE INDEX "reminders_project_id_idx" ON "public"."reminders" USING "btree" ("project_id");



CREATE INDEX "reminders_room_id_idx" ON "public"."reminders" USING "btree" ("room_id");



CREATE INDEX "rooms_location_id_idx" ON "public"."rooms" USING "btree" ("location_id");



CREATE OR REPLACE TRIGGER "locations_set_updated_at" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "owners_set_updated_at" BEFORE UPDATE ON "public"."owners" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "projects_set_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "reminders_check_assignee" BEFORE INSERT OR UPDATE OF "assignee_id" ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."check_assignee_is_individual"();



CREATE OR REPLACE TRIGGER "reminders_set_updated_at" BEFORE UPDATE ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "rooms_set_updated_at" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_visibility"
    ADD CONSTRAINT "owner_visibility_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_visibility"
    ADD CONSTRAINT "owner_visibility_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_visibility"
    ADD CONSTRAINT "owner_visibility_visible_owner_id_fkey" FOREIGN KEY ("visible_owner_id") REFERENCES "public"."owners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owners"
    ADD CONSTRAINT "owners_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view the owners directory" ON "public"."owners" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Owners can access visible reminders" ON "public"."reminders" FOR SELECT USING ("public"."owner_is_visible"("owner_id"));



CREATE POLICY "Owners can delete visible reminders" ON "public"."reminders" FOR DELETE USING ("public"."owner_is_visible"("owner_id"));



CREATE POLICY "Owners can insert reminders they can see" ON "public"."reminders" FOR INSERT WITH CHECK ("public"."owner_is_visible"("owner_id"));



CREATE POLICY "Owners can update visible reminders" ON "public"."reminders" FOR UPDATE USING ("public"."owner_is_visible"("owner_id")) WITH CHECK ("public"."owner_is_visible"("owner_id"));



CREATE POLICY "Users can delete their own locations" ON "public"."locations" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can delete their own owner rows" ON "public"."owners" FOR DELETE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can delete their own projects" ON "public"."projects" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can delete their own rooms" ON "public"."rooms" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can delete their own visibility grants" ON "public"."owner_visibility" FOR DELETE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can insert their own locations" ON "public"."locations" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert their own projects" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert their own rooms" ON "public"."rooms" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own owner rows" ON "public"."owners" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can manage their own visibility grants" ON "public"."owner_visibility" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can update their own locations" ON "public"."locations" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can update their own owner rows" ON "public"."owners" FOR UPDATE USING (("auth"."uid"() = "creator_id")) WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can update their own projects" ON "public"."projects" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can update their own rooms" ON "public"."rooms" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can update their own visibility grants" ON "public"."owner_visibility" FOR UPDATE USING (("auth"."uid"() = "creator_id")) WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can view relevant visibility grants" ON "public"."owner_visibility" FOR SELECT USING ((("auth"."uid"() = "creator_id") OR "public"."is_own_owner"("viewer_id")));



CREATE POLICY "Users can view their own locations" ON "public"."locations" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can view their own projects" ON "public"."projects" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can view their own rooms" ON "public"."rooms" FOR SELECT USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_visibility" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reminders" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reminders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reminders" TO "service_role";



REVOKE ALL ON FUNCTION "public"."reassign_reminder_assignee"("target_reminder_id" "uuid", "new_assignee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_reminder_assignee"("target_reminder_id" "uuid", "new_assignee_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."reassign_reminder_owner"("target_reminder_id" "uuid", "new_owner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_reminder_owner"("target_reminder_id" "uuid", "new_owner_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owner_visibility" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owner_visibility" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owner_visibility" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owners" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owners" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."owners" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rooms" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rooms" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rooms" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
