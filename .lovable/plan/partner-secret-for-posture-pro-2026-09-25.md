# Partner secret for Posture Pro

## Problem
The `POSTURE_PRO_BRIDGE_SECRET` in InkVision was generated as a random secret. Generated secrets can never be shown or copied — so there is no key to hand over to Posture Pro.

## Fix
You have chosen the key value yourself (provided in chat). I will store it as the new value of `POSTURE_PRO_BRIDGE_SECRET` in InkVision's encrypted secret store, replacing the generated one.

## Steps
1. I save your chosen value as `POSTURE_PRO_BRIDGE_SECRET` in InkVision (replacing the old generated secret).
2. You paste the exact same value into Posture Pro's secret settings as `POSTURE_PRO_BRIDGE_SECRET`.
3. Done — the bridge at `https://inkvision.app/api/public/partner/verify-studio` will accept Posture Pro's calls (after InkVision is published).

## Technical notes
- No code changes needed — the endpoint already reads `POSTURE_PRO_BRIDGE_SECRET` from the environment.
- Recommendation: treat this value as a password — don't share it publicly.
