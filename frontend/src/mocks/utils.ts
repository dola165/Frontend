export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const simulateLatency = () => delay(200 + Math.random() * 200);

export const paginate = <T>(items: T[], page: number, size: number) => {
  const start = page * size;
  return {
    content: items.slice(start, start + size),
    pageNumber: page,
    pageSize: size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
};
