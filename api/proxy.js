// api/neshan-complete.js
export default async function handler(req, res) {
  console.log('=== NESHAN COMPLETE PROXY - ULTIMATE FIX ===');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const API_URL = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8d2088d8f68e321965da2bd4537a3bb1';
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // 1. درخواست اولیه برای دریافت داده
    let response = await fetch(API_URL, {
      headers: {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://neshan.org/',
        'Origin': 'https://neshan.org',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'DNT': '1'
      },
      timeout: 60000, // 60 ثانیه timeout
      compress: true,
      follow: 10
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 2. دریافت کل داده به صورت متن
    const base64Data = await response.text();
    console.log(`طول داده دریافتی: ${base64Data.length} کاراکتر`);
    
    // 3. اگر داده کمتر از حد انتظار است، retry با پارامترهای مختلف
    let finalData = base64Data;
    
    if (base64Data.length < 3400) { // طول مورد انتظار برای داده کامل
      console.log('داده کوتاه دریافت شد، تلاش مجدد با تنظیمات مختلف...');
      
      // تلاش دوم با headers متفاوت
      response = await fetch(API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity', // غیرفعال کردن compression
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: 60000,
        compress: false, // غیرفعال کردن compression
        follow: 10
      });
      
      const retryData = await response.text();
      console.log(`طول داده در تلاش دوم: ${retryData.length} کاراکتر`);
      
      // استفاده از داده بلندتر
      finalData = retryData.length > base64Data.length ? retryData : base64Data;
    }
    
    // 4. بررسی وجود marker کامل بودن داده
    // داده کامل باید شامل این sequence باشد: }}==eyJsaW5lcyI6W3s=
    const hasCompleteMarker = finalData.includes('}}==eyJsaW5lcyI6W3s=');
    const busCountEstimate = (finalData.match(/busNumber/g) || []).length;
    
    console.log(`دارای marker کامل: ${hasCompleteMarker}`);
    console.log(`تخمین تعداد اتوبوس: ${busCountEstimate}`);
    
    // 5. اگر داده هنوز ناقص است، سعی در ترمیم آن
    let processedData = finalData;
    let wasFixed = false;
    
    if (!hasCompleteMarker && finalData.includes('@')) {
      console.log('در حال ترمیم داده ناقص...');
      
      // حذف everything بعد از @
      const atIndex = finalData.indexOf('@');
      if (atIndex > 0) {
        processedData = finalData.substring(0, atIndex);
        wasFixed = true;
        
        // سعی کن به آخرین structure معتبر برسی
        // پیدا کردن آخرین }}==eyJli (یا pattern مشابه)
        const lastPatternIndex = processedData.lastIndexOf('}}==eyJ');
        if (lastPatternIndex > 0) {
          // اضافه کردن طول pattern کامل
          processedData = processedData.substring(0, lastPatternIndex + 7);
          console.log('بر اساس pattern ترمیم شد');
        }
      }
    }
    
    // 6. بررسی نهایی کیفیت داده
    const finalBusCount = (processedData.match(/busNumber/g) || []).length;
    
    return res.status(200).json({
      success: true,
      data: processedData,
      originalLength: base64Data.length,
      processedLength: processedData.length,
      busCount: finalBusCount,
      hadAtSymbol: finalData.includes('@'),
      hadCompleteEnd: processedData.endsWith('=') || processedData.endsWith('==') || processedData.endsWith('}'),
      fetchedAt: new Date().toISOString(),
      wasFixed: wasFixed,
      hasCompleteMarker: hasCompleteMarker,
      dataPreview: processedData.substring(0, 100) + '...' + processedData.substring(processedData.length - 100)
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
