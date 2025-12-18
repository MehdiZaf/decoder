// api/decode/index.js - Optimized for Node.js 24.x
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }
  
  try {
    const { data: rawData } = req.body;
    
    if (!rawData) {
      return res.status(400).json({
        success: false,
        error: 'No data provided in request body'
      });
    }
    
    console.log(`📥 Received data length: ${rawData.length} characters`);
    
    // 1. Advanced cleaning function
    function cleanAndExtractBase64(input) {
      // Remove all whitespace and control characters
      let cleaned = input.replace(/\s+/g, '');
      
      // Extract all potential base64 segments
      // Improved regex to capture base64 with optional separators
      const base64Regex = /(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})/g;
      
      const matches = cleaned.match(base64Regex) || [];
      
      console.log(`🔍 Found ${matches.length} potential base64 segments`);
      
      // Filter and validate segments
      const validSegments = [];
      
      for (const segment of matches) {
        // Skip very short segments (likely noise)
        if (segment.length < 20) continue;
        
        // Try to decode each segment
        try {
          // Ensure proper padding
          let paddedSegment = segment;
          while (paddedSegment.length % 4 !== 0) {
            paddedSegment += '=';
          }
          
          // Decode and check if it contains JSON structure
          const decoded = Buffer.from(paddedSegment, 'base64').toString('utf-8');
          
          // Check for JSON-like content
          if (decoded.includes('"lines"') || decoded.includes('"busNumber"')) {
            validSegments.push({
              segment: paddedSegment,
              decoded: decoded,
              length: segment.length
            });
          }
        } catch (err) {
          // Skip invalid base64
          continue;
        }
      }
      
      return validSegments;
    }
    
    // 2. Process and decode segments
    const segments = cleanAndExtractBase64(rawData);
    
    if (segments.length === 0) {
      // Fallback: try to decode the entire string as JSON
      try {
        const parsed = JSON.parse(rawData);
        return res.status(200).json({
          success: true,
          data: parsed,
          processingInfo: {
            method: 'direct_json_parse',
            segmentsFound: 0,
            timestamp: new Date().toISOString()
          }
        });
      } catch (jsonError) {
        throw new Error('No valid base64 or JSON data found');
      }
    }
    
    // 3. Try to decode each segment and find the best one
    let bestResult = null;
    let maxLines = 0;
    
    for (const segment of segments) {
      try {
        const decodedJson = JSON.parse(segment.decoded);
        
        // Check structure and count lines
        let lines = [];
        if (decodedJson.lines && Array.isArray(decodedJson.lines)) {
          lines = decodedJson.lines;
        } else if (Array.isArray(decodedJson)) {
          lines = decodedJson;
        }
        
        // Select the result with most lines
        if (lines.length > maxLines) {
          maxLines = lines.length;
          bestResult = {
            lines: lines,
            // Preserve other fields if present
            ...(typeof decodedJson === 'object' && !Array.isArray(decodedJson) 
              ? decodedJson 
              : {})
          };
        }
      } catch (parseError) {
        console.log(`⚠️ Failed to parse segment: ${parseError.message}`);
        continue;
      }
    }
    
    if (!bestResult) {
      throw new Error('Could not parse any valid JSON from base64 segments');
    }
    
    console.log(`✅ Selected result with ${maxLines} bus lines`);
    
    // 4. Clean and standardize the output
    if (bestResult.lines) {
      bestResult.lines = bestResult.lines.map(line => ({
        busNumber: String(line.busNumber || 'نامشخص').trim(),
        title: String(line.title || 'بدون عنوان').trim(),
        etaText: String(line.etaText || '-').trim(),
        etaValue: line.etaValue !== undefined ? line.etaValue : null,
        originName: String(line.originName || 'نامشخص').trim(),
        destinationName: String(line.destinationName || 'نامشخص').trim(),
        iconUrl: String(line.iconUrl || '').trim(),
        slug: line.slug || null,
        // Additional fields for debugging
        _rawLine: line
      }));
    }
    
    // 5. Return the processed data
    return res.status(200).json({
      success: true,
      data: bestResult,
      processingInfo: {
        method: 'base64_extraction',
        segmentsFound: segments.length,
        selectedSegmentLength: segments.find(s => 
          JSON.parse(s.decoded)?.lines?.length === maxLines
        )?.length || 0,
        linesCount: maxLines,
        timestamp: new Date().toISOString(),
        notes: 'Data successfully decoded and cleaned'
      }
    });
    
  } catch (error) {
    console.error('❌ Decoder Error:', error);
    
    return res.status(400).json({
      success: false,
      error: error.message,
      processingInfo: {
        timestamp: new Date().toISOString(),
        notes: 'Error occurred during processing'
      }
    });
  }
}
