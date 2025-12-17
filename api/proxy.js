// api/neshan-complete.js
export default async function handler(req, res) {
  console.log('=== NESHAN COMPLETE PROXY (OPTIMIZED) ===');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const API_URL = 'https://neshan.org/maps/pwa-api/transportation/passing-lines/mashhad/8d2088d8f68e321965da2bd4537a3bb1';
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 45000; // 45 ثانیه
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`تلاش ${attempt} از ${MAX_RETRIES}`);
    
    try {
      // استفاده از node-fetch با پیکربندی بهتر
      const fetchModule = await import('node-fetch');
      const fetch = fetchModule.default;
      
      // ایجاد AbortController برای کنترل timeout
      const AbortController = global.AbortController || (await import('abort-controller')).default;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(API_URL, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://neshan.org/',
          'Origin': 'https://neshan.org',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        signal: controller.signal,
        compress: true,
        follow: 20,
        timeout: TIMEOUT_MS,
        // افزایش buffer size برای دریافت داده‌های بزرگتر
        highWaterMark: 1024 * 1024 * 10 // 10MB buffer
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`خطای HTTP: ${response.status} ${response.statusText}`);
      }
      
      // دریافت کل داده به صورت Buffer
      const buffer = await response.arrayBuffer();
      const rawData = Buffer.from(buffer).toString('utf-8');
      
      console.log(`طول داده دریافتی: ${rawData.length} کاراکتر`);
      
      // بررسی کیفیت داده
      let processedData = rawData;
      let hasAtSymbol = rawData.includes('@');
      let hasCompleteEnd = rawData.trim().endsWith('}') && isValidJSON(rawData);
      
      // اگر داده کامل نیست، سعی در ترمیم آن
      if (hasAtSymbol || !hasCompleteEnd) {
        console.log('داده ناقص دریافت شده، در حال ترمیم...');
        processedData = repairIncompleteJSON(rawData);
        
        // اعتبارسنجی داده ترمیم شده
        if (!isValidJSON(processedData)) {
          throw new Error('داده حتی پس از ترمیم نیز معتبر نیست');
        }
        
        hasCompleteEnd = true;
        console.log('داده با موفقیت ترمیم شد');
      }
      
      // پارس JSON برای شمارش دقیق اتوبوس‌ها
      const parsedData = JSON.parse(processedData);
      const busCount = countBuses(parsedData);
      
      console.log(`تعداد اتوبوس‌های شناسایی شده: ${busCount}`);
      
      // اگر داده کامل و معتبر است، برگردان
      return res.status(200).json({
        success: true,
        data: processedData,
        originalLength: rawData.length,
        processedLength: processedData.length,
        busCount: busCount,
        hadAtSymbol: hasAtSymbol,
        hadCompleteEnd: hasCompleteEnd,
        fetchedAt: new Date().toISOString(),
        attemptUsed: attempt
      });
      
    } catch (error) {
      console.error(`خطا در تلاش ${attempt}:`, error.message);
      
      // اگر آخرین تلاش بود، خطا برگردان
      if (attempt === MAX_RETRIES) {
        return res.status(500).json({
          success: false,
          error: `تمام ${MAX_RETRIES} تلاش ناموفق بودند: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // صبر قبل از تلاش مجدد (افزایشی)
      const waitTime = 1000 * attempt; // 1, 2, 3 ثانیه
      console.log(`صبر برای ${waitTime}ms قبل از تلاش مجدد...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// تابع برای بررسی معتبر بودن JSON
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// تابع برای ترمیم JSON ناقص
function repairIncompleteJSON(incompleteData) {
  let data = incompleteData;
  
  // حذف everything بعد از اولین @
  const atIndex = data.indexOf('@');
  if (atIndex > 0) {
    data = data.substring(0, atIndex);
  }
  
  // پیدا کردن آخرین ساختار JSON معتبر
  let lastValidIndex = -1;
  
  // جستجو برای آخرین } که ممکن است پایان آرایه باشد
  const arrayEndMatch = data.match(/\]\s*\}$/);
  if (arrayEndMatch) {
    lastValidIndex = data.lastIndexOf(']}') + 1;
  } else {
    // یا آخرین } ساده
    const lastBrace = data.lastIndexOf('}');
    if (lastBrace > 0) {
      // بررسی که آیا قبل از } یک ] وجود دارد (برای آرایه‌ها)
      const beforeLastBrace = data.substring(0, lastBrace);
      const lastBracket = beforeLastBrace.lastIndexOf(']');
      
      if (lastBracket > 0) {
        lastValidIndex = lastBrace;
      } else {
        // یا شاید یک شیء ساده باشد
        lastValidIndex = lastBrace;
      }
    }
  }
  
  // اگر موقعیت معتبری پیدا شد، برش بده
  if (lastValidIndex > 0) {
    data = data.substring(0, lastValidIndex + 1);
  }
  
  // اگر هنوز با { شروع نمی‌شود، شروع را پیدا کن
  if (!data.startsWith('{') && data.includes('{')) {
    const firstBrace = data.indexOf('{');
    data = data.substring(firstBrace);
  }
  
  // حذف کاماهای اضافی در پایان
  data = data.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
  
  return data;
}

// تابع برای شمارش دقیق اتوبوس‌ها
function countBuses(parsedData) {
  try {
    // ساختار پاسخ neshan: {lines: [...]}
    if (parsedData.lines && Array.isArray(parsedData.lines)) {
      return parsedData.lines.length;
    }
    
    // یا شاید ساختار دیگری دارد - جستجو در کل شیء
    let count = 0;
    const countInObject = (obj) => {
      if (obj && typeof obj === 'object') {
        if (obj.busNumber) count++;
        Object.values(obj).forEach(value => {
          if (Array.isArray(value)) {
            value.forEach(item => countInObject(item));
          } else if (typeof value === 'object') {
            countInObject(value);
          }
        });
      }
    };
    
    countInObject(parsedData);
    return count;
  } catch (error) {
    // روش جایگزین: شمارش از طریق regex
    const jsonStr = JSON.stringify(parsedData);
    const matches = jsonStr.match(/"busNumber"\s*:/g);
    return matches ? matches.length : 0;
  }
}
