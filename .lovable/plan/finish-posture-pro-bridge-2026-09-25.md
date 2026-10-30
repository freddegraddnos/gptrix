# Finish Posture Pro bridge

1. I create a strong random password, save it in InkVision, and show it to you once so you can paste it into Posture Pro under the name POSTURE_PRO_BRIDGE_SECRET.
2. Test the check address: a wrong password is rejected, the right password works.
3. Give you a ready-made message to paste into Posture Pro, then publish.

## Technical details
- Random 48-char value from `openssl rand`, stored with set_secret `POSTURE_PRO_BRIDGE_SECRET`.
- Verify with curl against `/api/public/partner/verify-studio` on localhost.
