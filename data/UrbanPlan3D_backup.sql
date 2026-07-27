


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" integer NOT NULL,
    "user_id" integer,
    "project_id" integer,
    "action_type" character varying(50) NOT NULL,
    "details" "jsonb",
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."blocked_ips" (
    "id" integer NOT NULL,
    "ip_address" character varying(45) NOT NULL,
    "reason" character varying(255) DEFAULT 'Exceso de solicitudes'::character varying NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."blocked_ips" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."blocked_ips_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."blocked_ips_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."blocked_ips_id_seq" OWNED BY "public"."blocked_ips"."id";



CREATE TABLE IF NOT EXISTS "public"."invalidated_tokens" (
    "id" integer NOT NULL,
    "token" "text" NOT NULL,
    "invalidated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."invalidated_tokens" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invalidated_tokens_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invalidated_tokens_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."invalidated_tokens_id_seq" OWNED BY "public"."invalidated_tokens"."id";



CREATE TABLE IF NOT EXISTS "public"."project_features" (
    "id" integer NOT NULL,
    "project_id" integer,
    "feature_data" "jsonb" NOT NULL
);


ALTER TABLE "public"."project_features" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."project_features_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_features_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_features_id_seq" OWNED BY "public"."project_features"."id";



CREATE TABLE IF NOT EXISTS "public"."project_lot_metrics_snapshots" (
    "id" integer NOT NULL,
    "snapshot_id" integer,
    "lot_id" integer,
    "name" "text",
    "base_area" double precision,
    "occupied_area" double precision,
    "built_area" double precision,
    "green_area" double precision,
    "cos" double precision,
    "cus" double precision
);


ALTER TABLE "public"."project_lot_metrics_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."project_lot_metrics_snapshots_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_lot_metrics_snapshots_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_lot_metrics_snapshots_id_seq" OWNED BY "public"."project_lot_metrics_snapshots"."id";



CREATE TABLE IF NOT EXISTS "public"."project_metrics_snapshots" (
    "id" integer NOT NULL,
    "project_id" integer,
    "total_base_area" double precision,
    "total_occupied_area" double precision,
    "total_built_area" double precision,
    "total_green_area" double precision,
    "cos" double precision,
    "cus" double precision,
    "estimated_population" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_metrics_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."project_metrics_snapshots_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_metrics_snapshots_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_metrics_snapshots_id_seq" OWNED BY "public"."project_metrics_snapshots"."id";



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" integer NOT NULL,
    "user_id" integer,
    "name" character varying(255) NOT NULL,
    "next_id" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "map_center_lng" double precision DEFAULT '-99.1332'::numeric,
    "map_center_lat" double precision DEFAULT 19.4326,
    "map_zoom" double precision DEFAULT 13,
    "map_pitch" double precision DEFAULT 65,
    "map_bearing" double precision DEFAULT '-20'::integer
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."projects_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."projects_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."projects_id_seq" OWNED BY "public"."projects"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "username" character varying(50) NOT NULL,
    "email" character varying(100) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "full_name" character varying(100),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."blocked_ips" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."blocked_ips_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."invalidated_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."invalidated_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project_features" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."project_features_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project_lot_metrics_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."project_lot_metrics_snapshots_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project_metrics_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."project_metrics_snapshots_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."projects" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."projects_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocked_ips"
    ADD CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invalidated_tokens"
    ADD CONSTRAINT "invalidated_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invalidated_tokens"
    ADD CONSTRAINT "invalidated_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."project_features"
    ADD CONSTRAINT "project_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_lot_metrics_snapshots"
    ADD CONSTRAINT "project_lot_metrics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_metrics_snapshots"
    ADD CONSTRAINT "project_metrics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_blocked_ips_active" ON "public"."blocked_ips" USING "btree" ("ip_address", "is_active", "expires_at");



CREATE INDEX "idx_blocked_ips_expires" ON "public"."blocked_ips" USING "btree" ("expires_at") WHERE ("is_active" = true);



CREATE INDEX "idx_lot_metrics_snapshot" ON "public"."project_lot_metrics_snapshots" USING "btree" ("snapshot_id");



CREATE INDEX "idx_metrics_project" ON "public"."project_metrics_snapshots" USING "btree" ("project_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_features"
    ADD CONSTRAINT "project_features_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_lot_metrics_snapshots"
    ADD CONSTRAINT "project_lot_metrics_snapshots_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."project_metrics_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_metrics_snapshots"
    ADD CONSTRAINT "project_metrics_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_ips" TO "anon";
GRANT ALL ON TABLE "public"."blocked_ips" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_ips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blocked_ips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invalidated_tokens" TO "anon";
GRANT ALL ON TABLE "public"."invalidated_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."invalidated_tokens" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invalidated_tokens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invalidated_tokens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invalidated_tokens_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."project_features" TO "anon";
GRANT ALL ON TABLE "public"."project_features" TO "authenticated";
GRANT ALL ON TABLE "public"."project_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."project_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."project_lot_metrics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."project_lot_metrics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."project_lot_metrics_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_lot_metrics_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."project_lot_metrics_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_lot_metrics_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."project_metrics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."project_metrics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."project_metrics_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_metrics_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."project_metrics_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_metrics_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































