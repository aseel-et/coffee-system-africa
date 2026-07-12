const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: err.errors || []
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      success: false,
      message: 'البيانات مكررة، يرجى التحقق من المعلومات المدخلة'
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(409).json({
      success: false,
      message: 'لا يمكن تنفيذ هذا الإجراء، توجد بيانات مرتبطة'
    });
  }

  res.status(500).json({
    success: false,
    message: 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى'
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `المسار ${req.originalUrl} غير موجود`
  });
};

module.exports = { errorHandler, notFound };
