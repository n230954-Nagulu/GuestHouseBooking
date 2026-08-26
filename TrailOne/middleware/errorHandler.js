
export function notFound(req, res) {

  res.status(404)
      .json({ success: false, 
              message: `Route not found: ${req.method} ${req.originalUrl}` 
            }); 
}

export function errorHandler(error, req, res, next) {

  console.error(error);

  if (error.code === "ER_DUP_ENTRY") 
    return res.status(409)
              .json({ success: false, 
                      message: "That record already exists." 
                    });

  return res.status(error.statusCode || 500)
            .json({ success: false, 
                    message: error.message || "An unexpected server error occurred." });
}
