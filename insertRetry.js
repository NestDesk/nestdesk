const fs = require('fs');

const code = \
  async function handleRetryOtp() {
    if (!reqId) {
      return handleSendOtp();
    }
    setSendingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reqId, retryChannel: "12" }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? "Could not retry OTP.");
        return;
      }
      toast.success("OTP resent successfully.");
    } catch {
      toast.error("Network error while retrying OTP.");
    } finally {
      setSendingOtp(false);
    }
  }
\;

const filePath = 'src/app/tenant/register/page.tsx';
let data = fs.readFileSync(filePath, 'utf8');

if (!data.includes('handleRetryOtp')) {
  data = data.replace('async function handleVerifyOtp() {', code + '\n  async function handleVerifyOtp() {');
  data = data.replace('onResend={handleSendOtp}', 'onResend={handleRetryOtp}');
  fs.writeFileSync(filePath, data);
}
