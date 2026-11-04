-- Brand-new game-only store. NEVER touches auth.users/player_profiles or their passwords.
CREATE SCHEMA IF NOT EXISTS fantazia_internal;
REVOKE ALL ON SCHEMA fantazia_internal FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS fantazia_internal.runtime_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),secret_hash bytea NOT NULL,
 revision bigint NOT NULL DEFAULT 0,payload jsonb NOT NULL DEFAULT '{"accounts":{}}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fantazia_internal.runtime_state ENABLE ROW LEVEL SECURITY;
INSERT INTO fantazia_internal.runtime_state(id,secret_hash) VALUES(true,decode('8c58103c23c7f8f25c3643730d815dca1189936cb1235652bd02d4c6cc70ca67','hex')) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION fantazia_internal.authenticate(p_secret text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_secret IS NULL OR length(p_secret)<43 OR NOT EXISTS(SELECT 1 FROM fantazia_internal.runtime_state WHERE id AND secret_hash=sha256(convert_to(p_secret,'UTF8'))) THEN RAISE EXCEPTION 'runtime_denied' USING ERRCODE='42501'; END IF;
END;$$;
REVOKE ALL ON FUNCTION fantazia_internal.authenticate(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fantazia_runtime_read(p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM fantazia_internal.authenticate(p_secret);
 RETURN (SELECT jsonb_build_object('revision',revision,'payload',payload) FROM fantazia_internal.runtime_state WHERE id);
END;$$;
CREATE OR REPLACE FUNCTION public.fantazia_runtime_write(p_secret text,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE n bigint; BEGIN
 PERFORM fantazia_internal.authenticate(p_secret);
 IF jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_payload->'accounts') IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>8388608 THEN RAISE EXCEPTION 'invalid_state'; END IF;
 UPDATE fantazia_internal.runtime_state SET payload=p_payload,revision=revision+1,updated_at=now() WHERE id AND revision=p_revision RETURNING revision INTO n;
 IF n IS NULL THEN RAISE EXCEPTION 'stale_revision' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('revision',n);
END;$$;
REVOKE ALL ON FUNCTION public.fantazia_runtime_read(text),public.fantazia_runtime_write(text,bigint,jsonb) FROM PUBLIC,anon,authenticated;
-- 256-bit runtime secret is required IN ADDITION to the public anon API key.
GRANT EXECUTE ON FUNCTION public.fantazia_runtime_read(text),public.fantazia_runtime_write(text,bigint,jsonb) TO anon;
