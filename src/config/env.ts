function getPort(): number {
  return Number(process.env.PORT ?? 3000);
}

export { getPort };
