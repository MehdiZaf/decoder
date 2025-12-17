// api/neshan-complete.js
export default async function handler(req, res) {
  console.log('=== NESHAN PROXY - COMPLETE BODY FETCH ===');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const API_URL = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8d2088d8f68e321965da2bd4537a3bb1';
  
  // تابع برای دریافت کامل body با timeout
  async function fetchCompleteBody(url) {
    return new Promise(async (resolve, reject) => {
      const { default: fetch } = await import('node-fetch');
      const AbortController = global.AbortController || (await import('abort-controller')).default;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Timeout بعد از 45 ثانیه'));
      }, 45000);
      
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://neshan.org/',
            'Origin': 'https://neshan.org',
            'Connection': 'keep-alive'
          },
          signal: controller.signal,
          compress: true,
          timeout: 45000,
          // غیرفعال کردن redirect limit
          follow: 20
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // دریافت کل body به صورت متن
        const body = await response.text();
        resolve(body);
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  // تابع fallback با روش متفاوت
  async function fetchWithRetry(url, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`تلاش ${i + 1} از ${retries + 1}`);
        
        const { default: fetch } = await import('node-fetch');
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/plain, */*',
            'Accept-Encoding': 'identity', // مهم: غیرفعال کردن compression
            'Cache-Control': 'no-cache'
          },
          timeout: 30000,
          compress: false // مهم: غیرفعال کردن compression
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        // استفاده از stream برای دریافت تدریجی
        let body = '';
        const reader = response.body;
        
        for await (const chunk of reader) {
          body += chunk.toString();
          
          // اگر داده خیلی بزرگ است، continue
          if (body.length > 1024 * 1024 * 10) { // 10MB
            console.warn('داده بیش از حد بزرگ است');
            break;
          }
        }
        
        return body;
        
      } catch (error) {
        console.error(`خطا در تلاش ${i + 1}:`, error.message);
        if (i === retries) throw error;
        
        // صبر قبل از تلاش مجدد
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  try {
    console.log('در حال دریافت داده از API نیشان...');
    
    // ابتدا با روش اصلی تلاش می‌کنیم
    let body;
    try {
      body = await fetchCompleteBody(API_URL);
    } catch (error) {
      console.log('روش اول ناموفق، در حال استفاده از روش fallback...');
      body = await fetchWithRetry(API_URL);
    }
    
    console.log(`دریافت کامل شد. طول: ${body.length} کاراکتر`);
    
    // بررسی وجود @ (نشانه قطع شدن)
    const hasAt = body.includes('@');
    
    // شمارش اتوبوس‌ها از روی رشته base64
    const busCountMatch = body.match(/busNumber/g);
    const busCount = busCountMatch ? busCountMatch.length : 0;
    
    // بررسی پایان معتبر base64
    const hasValidEnd = body.endsWith('=') || body.endsWith('==') || 
                       body.endsWith('}') || body.endsWith(']');
    
    // بررسی marker کامل بودن
    const hasCompleteMarker = body.includes('}}==eyJsaW5lcyI6W3s=') || 
                             (body.match(/busNumber/g) || []).length >= 8;
    
    // اگر داده حاوی @ است، ممکن است ناقص باشد
    let isComplete = !hasAt && hasValidEnd;
    
    // اگر marker کامل وجود دارد، داده کامل است
    if (hasCompleteMarker) {
      isComplete = true;
    }
    
    // اگر busCount کمتر از حد انتظار است، ممکن است ناقص باشد
    if (busCount < 5) {
      console.warn(`تعداد اتوبوس کم است: ${busCount}`);
    }
    
    return res.status(200).json({
      success: true,
      data: body, // کل بدنه به صورت رشته
      originalLength: body.length,
      processedLength: body.length,
      busCount: busCount,
      hadAtSymbol: hasAt,
      hadCompleteEnd: hasValidEnd,
      isComplete: isComplete,
      hasCompleteMarker: hasCompleteMarker,
      fetchedAt: new Date().toISOString(),
      note: 'این رشته base64 است و باید در مرحله decode پردازش شود'
    });
    
  } catch (error) {
    console.error('خطای نهایی در پروکسی:', error.message);
    return res.status(500).json({
      success: false,
      error: `خطا در دریافت داده: ${error.message}`,
      timestamp: new Date().toISOString(),
      suggestion: 'لطفاً از endpoint اصلی مستقیماً درخواست بزنید'
    });
  }
}
