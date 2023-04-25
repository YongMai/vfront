interface SendMessagePayload {
  text: string;
  parentMessageId?: string;
}

class APIClient {
  async sendMessage(host: string, payload: SendMessagePayload) {
    const abortController = new AbortController();

    try {
      const response = await fetch(`${host}/chatgpt/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

     const data = await response.json();

      return { response,abortController,data};
    } catch (error) {
      console.error('Error:', error);

      return { error };
    }
  }
  
  async  auth(param1: string, param2: string, signature: string) {
  const secretKey = import.meta.env.VITE_SECRET_KEY;

  async function createSha256Hash(ata: string , _secretKey: string) {
    const encoder = new TextEncoder();
    const dataUint8Array = encoder.encode(data);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, dataUint8Array);
    const signatureUint8Array = new Uint8Array(signatureArrayBuffer);
    const signatureHex = Array.from(signatureUint8Array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return signatureHex;
  }

  const data = param1 + param2;
  const generatedSignature = await createSha256Hash(data, secretKey);
  const isValidSignature = generatedSignature === signature;

  /* console.log('SHA-256 hash:', generatedSignature);
  console.log('data:', data); */
  // Add a condition to check if param1 is valid
  //const isParam1Valid = param1 === 'ab';
  // Check if either param1 or pass is correct
  // const isPasswordValid = !realPassword || pass === realPassword || passList.includes(pass);

  if (isValidSignature) {
    // Check if param2 is within the 24-hour range
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const param2Time = parseInt(param2);

    if (currentTime >= param2Time && currentTime <= param2Time + 86400) {
      // Param2 is within the 24-hour range
      return new Response(
        JSON.stringify({
          code: 0,
        })
      );
    } else {
      // Param2 is outside the 24-hour range
      return new Response(
        JSON.stringify({
          code: -2,
        })
      );
    }
  } else {
    // Signature is not valid
    return new Response(
      JSON.stringify({
        code: -1,
      })
    );
  }
}
  
}




const API = new APIClient();

export default API;
