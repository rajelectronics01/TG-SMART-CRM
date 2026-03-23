const API_KEY = "FGDangrfzNLC9sb1Zij5dm7E8KWoAwcpOPMRY3QqHx0TtVvlI2LE1u8qJwlsbjXYaxnfS6rGFdRIioOc";

/**
 * Sends an SMS using Fast2SMS GET route.
 * Bypasses database trigger networking issues by sending directly from client.
 */
export async function sendSMS(phone: string, message: string) {
  try {
    // Basic phone cleaning
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) return;

    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${API_KEY}&route=q&message=${encodeURIComponent(message)}&numbers=${cleanPhone}`;
    
    const response = await fetch(url, { 
      method: "GET",
      headers: {
        "cache-control": "no-cache"
      }
    });

    const data = await response.json();
    console.log('SMS sent to', cleanPhone, 'Result:', data);
    return data;
  } catch (error) {
    console.error('Fast2SMS Client Error:', error);
    return null;
  }
}
