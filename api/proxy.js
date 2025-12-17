// api/neshan-complete.js
export default async function handler(req, res) {
  console.log('=== NESHAN PROXY - FINAL FIX ===');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const API_URL = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8d2088d8f68e321965da2bd4537a3bb1';
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(API_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://neshan.org/',
        'Origin': 'https://neshan.org'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // دریافت داده به صورت متن (base64)
    const base64Data = await response.text();
    
    console.log('طول داده دریافتی (base64):', base64Data.length);
    console.log('نمونه داده (اول 100 کاراکتر):', base64Data.substring(0, 100));
    
    // بررسی اینکه آیا داده base64 معتبر است
    if (!base64Data || base64Data.length < 10) {
      throw new Error('داده دریافتی خیلی کوتاه است');
    }
    
    // شمارش اتوبوس‌ها از روی رشته base64 (تخمینی)
    const busCountEstimate = (base64Data.match(/busNumber/g) || []).length;
    
    return res.status(200).json({
      success: true,
      data: base64Data, // این همان رشته base64 است
      originalLength: base64Data.length,
      processedLength: base64Data.length,
      busCount: busCountEstimate,
      hadAtSymbol: base64Data.includes('@'),
      hadCompleteEnd: base64Data.endsWith('=') || base64Data.endsWith('=='),
      fetchedAt: new Date().toISOString(),
      note: 'این داده base64 است و باید در مرحله decode پردازش شود'
    });
    
  } catch (error) {
    console.error('خطای پروکسی:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
