function paginate(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginatedResponse(rows, total, page, limit) {
  return {
    data: rows,
    pagination: {
      total: parseInt(total),
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

module.exports = { paginate, paginatedResponse };
