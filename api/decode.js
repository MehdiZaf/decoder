return res.json({
              success: true,
              method: 'auto_detect',
              data: jsonResult
            });
          } catch (e) {
            // ادامه بده
          }
        }
      }
    } catch (e) {
      console.log('Method 3 failed:', e.message);
    }

    // ------------------------------------------------------------
    // همه روش‌ها شکست خوردند
    // ------------------------------------------------------------
    throw new Error('Could not decode data with any method');

  } catch (error) {
    console.error('Final error:', error);
    
    return res.status(500).json({
      error: 'Decoding failed',
      message: error.message,
      suggestion: 'Check if data is in valid base64 format'
    });
  }
}
