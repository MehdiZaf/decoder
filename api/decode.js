console.log('📋 First 80 chars:', finalBase64.substring(0, 80));
    console.log('📋 Last 80 chars:', finalBase64.substring(finalBase64.length - 80));
    
    // ------------------------------------------------------------
    // مرحله ۴: Decode نهایی
    // ------------------------------------------------------------
    
    // پاکسازی
    const cleanBase64 = finalBase64.replace(/\s/g, '');
    
    // اضافه کردن padding
    const paddingNeeded = (4 - (cleanBase64.length % 4)) % 4;
    const paddedBase64 = cleanBase64 + '='.repeat(paddingNeeded);
    
    console.log('🔧 Padded base64 length:', paddedBase64.length);
    
    // Decode
    let decodedString;
    try {
      decodedString = Buffer.from(paddedBase64, 'base64').toString('utf8');
      console.log('✅ Base64 decode successful');
    } catch (decodeError) {
      console.error('❌ Buffer decode failed:', decodeError.message);
      
      // روش جایگزین: manual decode
      decodedString = atob(paddedBase64);
      console.log('✅ atob decode successful');
    }
    
    console.log('📖 Decoded length:', decodedString.length);
    console.log('🔍 First 300 chars:', decodedString.substring(0, 300));
    
    // ------------------------------------------------------------
    // مرحله ۵: Parse JSON
    // ------------------------------------------------------------
    
    let jsonData;
    try {
      jsonData = JSON.parse(decodedString);
      console.log('🎉 JSON parse successful!');
      console.log('📊 Keys:', Object.keys(jsonData));
      
      if (jsonData.lines && Array.isArray(jsonData.lines)) {
        console.log(🚌 Found ${jsonData.lines.length} bus lines);
        jsonData.lines.forEach((line, i) => {
          console.log(  ${i + 1}. Bus ${line.busNumber}: ${line.title});
        });
      }
    } catch (jsonError) {
      console.error('❌ JSON parse failed:', jsonError.message);
      
      // شاید نیاز به fix کردن JSON دارد
      try {
        // حذف null characters و fix کردن
        const fixedJson = decodedString
          .replace(/\0/g, '')
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"');
        
        jsonData = JSON.parse(fixedJson);
        console.log('✅ Fixed JSON parse successful');
      } catch (fixError) {
        throw new Error(JSON parse failed: ${jsonError.message}. Fix also failed: ${fixError.message});
      }
    }
    
    // ------------------------------------------------------------
    // مرحله ۶: برگرداندن نتیجه
    // ------------------------------------------------------------
    
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        originalLength: data.length,
        base64Length: finalBase64.length,
        decodedLength: decodedString.length,
        processedAt: new Date().toISOString(),
        format: 'neshan_with_broken_json'
      }
    });

  } catch (error) {
    console.error('💥 FINAL ERROR:', error.message);
    console.error('🔍 Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to decode Neshan data',
      timestamp: new Date().toISOString()
    });
  }
}

// تابع atob برای Node.js (اگر نیاز باشد)
function atob(str) {
  return Buffer.from(str, 'base64').toString('binary');
}
