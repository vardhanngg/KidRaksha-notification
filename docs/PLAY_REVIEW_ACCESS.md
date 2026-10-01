# Google Play review access

Before submitting KidSuraksha, prepare reviewer access that does not require a private employee account or a payment method.

## Recommended reviewer path
1. Open the public website.
2. Use a dedicated review parent account.
3. Provide a pre-paired or easily pairable test Android device, following Play's review-instructions requirements.
4. Ensure the test account has the intended plan/entitlement without requiring a real card.
5. Explain the child-device disclosure and the visible monitoring notification.
6. Explain how to revoke sharing and unpair the device.

Do not provide production master passwords, deployment SSH keys, payment-provider secrets or private signing credentials.

## Submission checklist

Complete and verify each item in Play Console before submitting:
- Public app URL: [enter verified production URL]
- Reviewer parent account: [create a dedicated account; provide credentials through Play Console only]
- Test device and pairing steps: [provide device availability, app version, and exact steps]
- Test entitlement: [describe the no-payment test path]
- Disclosure and visible monitoring indicator: [describe where the reviewer sees these]
- Stop sharing and unpair: [give exact navigation steps]

Do not submit while any bracketed field remains. These values must come from the deployed release; they cannot be safely invented in repository documentation.
