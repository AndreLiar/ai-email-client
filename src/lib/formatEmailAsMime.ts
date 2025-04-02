// lib/formatEmailAsMime.ts
export function formatEmailAsMime(to: string, subject: string, body: string): string {
    const mime = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      body
    ].join('\n');
  
    // Gmail API requires Base64URL encoding
    return Buffer.from(mime)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  