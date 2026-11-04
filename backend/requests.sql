-- Additive: preserve all MAIN users, old approvals and audit rows.
ALTER TABLE public.beta_access ALTER COLUMN code_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.beta_request(p_game text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=public._beta_user(); inserted uuid;
BEGIN
 IF p_game IS DISTINCT FROM 'fantazia' THEN RAISE EXCEPTION 'Заявки доступны только для Fantazia.'; END IF;
 INSERT INTO public.beta_access(user_id,game_id,code_id,state)
 VALUES(me,p_game,NULL,'pending') ON CONFLICT(user_id,game_id) DO NOTHING RETURNING id INTO inserted;
 IF inserted IS NOT NULL THEN INSERT INTO public.beta_audit(actor,action,subject) VALUES(me,'request',inserted); END IF;
 -- Existing rejected/revoked/approved state is NEVER reset by resubmission.
 RETURN jsonb_build_object('ok',true,'status',public.beta_status(p_game));
END;$$;
REVOKE ALL ON FUNCTION public.beta_request(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.beta_request(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.fantazia_owner_status() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE me uuid:=public._beta_user(); BEGIN
 RETURN EXISTS(SELECT 1 FROM public.creator_roles WHERE user_id=me AND role='creator_admin');
END;$$;
REVOKE ALL ON FUNCTION public.fantazia_owner_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fantazia_owner_status() TO authenticated;
