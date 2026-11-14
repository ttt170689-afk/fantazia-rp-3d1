-- Additive migration. Requires backend/storage.sql and the existing MAIN profiles/access tables.
-- Never creates Auth users, changes approvals, rotates secrets or touches runtime_state.
CREATE TABLE IF NOT EXISTS fantazia_internal.launcher_login_codes (
  main_uid uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash bytea NOT NULL UNIQUE CHECK (octet_length(code_hash)=32),
  sealed_session text NOT NULL CHECK (length(sealed_session) BETWEEN 40 AND 7500),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '2 minutes')
);
ALTER TABLE fantazia_internal.launcher_login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fantazia_internal.launcher_login_codes FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fantazia_internal.launcher_login_allowed(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users u JOIN public.player_profiles p ON p.id=u.id
    WHERE u.id=p_uid AND u.email_confirmed_at IS NOT NULL)
  AND (EXISTS(SELECT 1 FROM public.creator_roles r WHERE r.user_id=p_uid AND r.role='creator_admin')
    OR EXISTS(SELECT 1 FROM public.beta_access a WHERE a.user_id=p_uid AND a.game_id='fantazia' AND a.state='approved'));
$$;
REVOKE ALL ON FUNCTION fantazia_internal.launcher_login_allowed(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fantazia_launcher_code_issue(p_secret text,p_main_uid uuid,p_code_hash text,p_sealed_session text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t timestamptz:=clock_timestamp(); expiry timestamptz;
BEGIN
  PERFORM fantazia_internal.authenticate(p_secret);
  IF p_main_uid IS NULL OR NOT fantazia_internal.launcher_login_allowed(p_main_uid) THEN RAISE EXCEPTION 'launcher_access_denied' USING ERRCODE='42501'; END IF;
  IF p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' OR p_sealed_session IS NULL OR length(p_sealed_session) NOT BETWEEN 40 AND 7500 THEN RAISE EXCEPTION 'invalid_code_payload'; END IF;
  DELETE FROM fantazia_internal.launcher_login_codes WHERE expires_at <= t;
  INSERT INTO fantazia_internal.launcher_login_codes AS existing(main_uid,code_hash,sealed_session,issued_at,expires_at)
    VALUES(p_main_uid,decode(p_code_hash,'hex'),p_sealed_session,t,t+interval '2 minutes')
  ON CONFLICT(main_uid) DO UPDATE SET code_hash=excluded.code_hash,sealed_session=excluded.sealed_session,issued_at=excluded.issued_at,expires_at=excluded.expires_at
    WHERE existing.issued_at <= t-interval '30 seconds'
  RETURNING expires_at INTO expiry;
  IF expiry IS NULL THEN RAISE EXCEPTION 'launcher_code_cooldown' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('expires_at',expiry);
END;
$$;
REVOKE ALL ON FUNCTION public.fantazia_launcher_code_issue(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fantazia_launcher_code_issue(text,uuid,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fantazia_launcher_code_consume(p_secret text,p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item fantazia_internal.launcher_login_codes;
BEGIN
  PERFORM fantazia_internal.authenticate(p_secret);
  IF p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  -- A single atomic DELETE is the redemption lock across all server instances.
  DELETE FROM fantazia_internal.launcher_login_codes WHERE code_hash=decode(p_code_hash,'hex') RETURNING * INTO item;
  IF NOT FOUND OR item.expires_at<=clock_timestamp() OR NOT fantazia_internal.launcher_login_allowed(item.main_uid) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('main_uid',item.main_uid,'sealed_session',item.sealed_session);
END;
$$;
REVOKE ALL ON FUNCTION public.fantazia_launcher_code_consume(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fantazia_launcher_code_consume(text,text) TO anon, authenticated;
