// api/neshan-complete.js
export default async function handler(req, res) {
  console.log('=== NESHAN COMPLETE PROXY ===');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // استفاده از node-fetch برای کنترل بیشتر
    const fetch = (await import('node-fetch')).default;
    
    const url = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8d2088d8f68e321965da2bd4537a3bb1';
    
    console.log('Fetching with browser-like headers...');
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 30000,
      compress: true,
      follow: 10,
      size: 1024 * 1024 * 5 // 5MB
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // دریافت داده به صورت chunked
    let data = '';
    const reader = response.body;
    
    for await (const chunk of reader) {
      data += chunk.toString('utf8');
      // اگر داده خیلی بزرگ شد، متوقف شو
      if (data.length > 1024 * 1024 * 2) { // 2MB
        console.warn('Data too large, truncating...');
        break;
      }
    }
    
    console.log('Total data length:', data.length);
    console.log('First 300 chars:', data.substring(0, 300));
    console.log('Last 300 chars:', data.substring(data.length - 300));
    
    // بررسی کیفیت داده
    const busCount = (data.match(/\"busNumber\"/g) || []).length;
    const hasAt = data.includes('@');
    const hasCompleteEnd = data.includes('}]}') || data.includes('}]');
    
    // اگر داده ناقص است، سعی کن کاملش کنی
    let processedData = data;
    if (hasAt && !hasCompleteEnd) {
      console.log('Data truncated with @, trying to fix...');
      // برش تا آخرین } قبل از @
      const atIndex = data.indexOf('@');
      if (atIndex > 0) {
        const beforeAt = data.substring(0, atIndex);
        const lastBrace = beforeAt.lastIndexOf('}');
        if (lastBrace > 0) {
          processedData = beforeAt.substring(0, lastBrace + 1);
          console.log('Fixed data length:', processedData.length);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      data: processedData,
      originalLength: data.length,
      processedLength: processedData.length,
      busCount: busCount,
      hadAtSymbol: hasAt,
      hadCompleteEnd: hasCompleteEnd,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Complete proxy error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
