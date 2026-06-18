// Consistent JSON response envelope: { success, data, error }

export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
};

export const sendError = (res, message, statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
      ...(errors && { errors }), // field-level errors for validation
    },
  });
};

// Pagination metadata helper
export const sendPaginated = (res, data, pagination) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      totalCount: pagination.totalCount,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(pagination.totalCount / pagination.limit),
    },
    error: null,
  });
};
