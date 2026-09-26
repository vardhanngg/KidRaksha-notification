import crypto from "node:crypto";

console.log("PAIRING_CODE_SECRET=" + crypto.randomBytes(32).toString("base64url"));
console.log("DATA_ENCRYPTION_KEY=" + crypto.randomBytes(32).toString("base64"));
console.log("RAZORPAY_WEBHOOK_SECRET=" + crypto.randomBytes(32).toString("base64url"));
