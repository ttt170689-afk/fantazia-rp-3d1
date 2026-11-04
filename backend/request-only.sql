-- Already applied in MAIN. Audit copy, not a command for launcher users.
ALTER FUNCTION public.beta_redeem(text,text) RENAME TO beta_redeem_legacy_keys_v1;
REVOKE ALL ON FUNCTION public.beta_redeem_legacy_keys_v1(text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.beta_redeem(p_game text,p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public._beta_user();
 IF p_game='fantazia' THEN RETURN jsonb_build_object('ok',false,'error','applications_only'); END IF;
 RETURN public.beta_redeem_legacy_keys_v1(p_game,p_code);
END;$$;
REVOKE ALL ON FUNCTION public.beta_redeem(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.beta_redeem(text,text) TO authenticated;
