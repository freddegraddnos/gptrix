REVOKE EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) TO authenticated, service_role;