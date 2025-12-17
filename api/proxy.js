// api/proxy.js
export default async function handler(req, res) {
  console.log('=== NESHAN PROXY STARTED ===');
  
  // فعال کردن CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const url = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8e33926b993a09c491581db220c58636';
    
    console.log('Fetching from Neshan API...');
    
    // استفاده از fetch با timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Encoding': 'identity' // مهم: غیرفعال کردن فشرده‌سازی
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.text();
    
    console.log('Data length received:', data.length);
    console.log('First 200 chars:', data.substring(0, 200));
    
    // بررسی کامل بودن داده
    const busCount = (data.match(/\"busNumber\"/g) || []).length;
    const hasCompleteEnd = data.includes('}]}') || data.includes('}]') || data.includes('}}}');
    
    return res.status(200).json({
      success: true,
      data: data,
      length: data.length,
      busCount: busCount,
      hasCompleteEnd: hasCompleteEnd,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
