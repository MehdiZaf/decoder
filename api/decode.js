// api/decode/index.js
export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // تابع پیشرفته برای استخراج و پردازش داده‌ها
    function processEncodedData(rawString) {
      console.log('📥 دریافت داده خام با طول:', rawString.length);
      
      // 1. حذف همه whitespaceهای اضافی
      const cleaned = rawString.trim();
      
      // 2. پیدا کردن تمام بخش‌های base64 معتبر
      // الگو: دنباله‌ای از کاراکترهای base64 که با = پایان می‌یابند
      const base64Pattern = /(?:^|[^A-Za-z0-9+/=])([A-Za-z0-9+/]{30,}=*)(?=[^A-Za-z0-9+/=]|$)/g;
      
      let allMatches = [];
      let match;
      
      while ((match = base64Pattern.exec(cleaned)) !== null) {
        if (match[1]) {
          allMatches.push(match[1]);
        }
      }
      
      console.log(`🔍 یافت ${allMatches.length} بخش base64`);
      
      // 3. امتحان هر بخش برای دیکد
      const validResults = [];
      
      for (let i = 0; i < allMatches.length; i++) {
        const chunk = allMatches[i];
        try {
          // دیکد base64
          const decoded = Buffer.from(chunk, 'base64').toString('utf-8');
          
          // بررسی اینکه آیا JSON معتبر است
          if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
            const parsed = JSON.parse(decoded);
            
            // اگر دارای ساختار مورد انتظار ماست
            if (parsed.lines && Array.isArray(parsed.lines)) {
              validResults.push({
                chunkIndex: i,
                data: parsed,
                linesCount: parsed.lines.length,
                isComplete: parsed.lines.every(line => 
                  line.busNumber && line.title && line.etaText !== undefined
                )
              });
            } else if (Array.isArray(parsed)) {
              // اگر مستقیم آرایه است
              validResults.push({
                chunkIndex: i,
                data: { lines: parsed },
                linesCount: parsed.length,
                isComplete: parsed.every(line => 
                  line.busNumber && line.title && line.etaText !== undefined
                )
              });
            }
          }
        } catch (e) {
          // بخش نامعتبر - رد می‌شود
          continue;
        }
      }
      
      // 4. انتخاب بهترین نتیجه
      if (validResults.length === 0) {
        // تلاش جایگزین: کل رشته را به عنوان JSON پردازش کن
        try {
          const directParse = JSON.parse(cleaned);
          return directParse;
        } catch (e) {
          throw new Error('هیچ داده معتبری یافت نشد');
        }
      }
      
      // اولویت‌بندی: کامل‌ترین نتیجه با بیشترین خطوط
      validResults.sort((a, b) => {
        if (a.isComplete && !b.isComplete) return -1;
        if (!a.isComplete && b.isComplete) return 1;
        return b.linesCount - a.linesCount;
      });
      
      console.log(`✅ انتخاب بهترین نتیجه با ${validResults[0].linesCount} خط`);
      return validResults[0].data;
    }

    // پردازش داده ورودی
    const result = processEncodedData(data);
    
    // 5. پاکسازی و استانداردسازی داده خروجی
    if (result.lines && Array.isArray(result.lines)) {
      result.lines = result.lines.map(line => ({
        busNumber: line.busNumber || 'نامشخص',
        title: line.title || 'بدون عنوان',
        etaText: line.etaText || '-',
        etaValue: line.etaValue !== undefined ? line.etaValue : null,
        originName: line.originName || 'نامشخص',
        destinationName: line.destinationName || 'نامشخص',
        iconUrl: line.iconUrl || '',
        slug: line.slug || null
      }));
    }
    
    return res.status(200).json({
      success: true,
      data: result,
      processingInfo: {
        timestamp: new Date().toISOString(),
        notes: 'داده با موفقیت پردازش شد'
      }
    });
    
  } catch (error) {
    console.error('❌ خطا در پردازش:', error.message);
    
    return res.status(400).json({
      success: false,
      error: error.message,
      processingInfo: {
        timestamp: new Date().toISOString(),
        notes: 'خطا در پردازش داده'
      }
    });
  }
}
