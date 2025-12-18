// api/decode/index.js - نسخه بسیار ساده
export default async function handler(req, res) {
  // تنظیم CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'فقط POST مجاز است' });
  }
  
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'داده‌ای ارسال نشده' });
    }
    
    console.log(`📥 دریافت داده با طول: ${data.length}`);
    
    // 1. حذف whitespaceها
    const cleanData = data.trim();
    
    // 2. اگر با eyJ شروع می‌شود (base64 معتبر)
    if (cleanData.startsWith('eyJ')) {
      try {
        // دیکد base64
        const decoded = Buffer.from(cleanData, 'base64').toString('utf-8');
        
        // پارس JSON
        const parsed = JSON.parse(decoded);
        
        console.log(`✅ دیکد موفق. تعداد خطوط: ${parsed.lines?.length || 0}`);
        
        return res.status(200).json({
          success: true,
          data: parsed,
          processing: {
            method: 'base64_decode',
            length: cleanData.length,
            lines_count: parsed.lines?.length || 0
          }
        });
      } catch (decodeError) {
        console.log('⚠️ خطا در دیکد base64:', decodeError.message);
      }
    }
    
    // 3. اگر base64 نبود، سعی کن مستقیماً JSON باشه
    try {
      const directParse = JSON.parse(cleanData);
      console.log(`✅ پارس مستقیم JSON. تعداد خطوط: ${directParse.lines?.length || 0}`);
      
      return res.status(200).json({
        success: true,
        data: directParse,
        processing: {
          method: 'direct_json_parse',
          length: cleanData.length
        }
      });
    } catch (jsonError) {
      console.log('⚠️ خطا در پارس JSON:', jsonError.message);
    }
    
    // 4. اگر هیچ‌کدام کار نکرد
    throw new Error('داده ارسالی نه base64 معتبر است و نه JSON');
    
  } catch (error) {
    console.error('❌ خطا:', error.message);
    
    return res.status(400).json({
      success: false,
      error: error.message,
      note: 'لطفاً داده خام API را بررسی کنید'
    });
  }
}
