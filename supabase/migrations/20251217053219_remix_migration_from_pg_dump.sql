CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: game_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_code text NOT NULL,
    game_type text NOT NULL,
    game_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    player_count integer DEFAULT 1 NOT NULL,
    max_players integer DEFAULT 2 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: game_rooms game_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_pkey PRIMARY KEY (id);


--
-- Name: game_rooms game_rooms_room_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_room_code_key UNIQUE (room_code);


--
-- Name: game_rooms update_game_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON public.game_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: game_rooms Anyone can create game rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create game rooms" ON public.game_rooms FOR INSERT WITH CHECK (true);


--
-- Name: game_rooms Anyone can delete game rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete game rooms" ON public.game_rooms FOR DELETE USING (true);


--
-- Name: game_rooms Anyone can update game rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update game rooms" ON public.game_rooms FOR UPDATE USING (true);


--
-- Name: game_rooms Anyone can view game rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view game rooms" ON public.game_rooms FOR SELECT USING (true);


--
-- Name: game_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


